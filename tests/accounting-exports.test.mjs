import test from "node:test";
import assert from "node:assert/strict";
import {
  bankDownloadFileName,
  exportBankRows,
  missingBankMetadata,
  normalizeBankOutputFormat
} from "../functions/lib/accounting-exports.js";
import { convertFileToCsv } from "../functions/lib/extract.js";

const rows = [
  { date: "2026-05-01", description: "Stripe payout", money_in: 1000, money_out: "", balance: 1000, confidence: 0.9 },
  { date: "2026-05-02", description: "Amazon Web Services", money_in: "", money_out: 25.5, balance: 974.5, confidence: 0.88 }
];

const metadata = {
  bankName: "Test Bank",
  bankId: "123456789",
  accountId: "987654321",
  accountType: "CHECKING",
  currency: "USD",
  intuitBankId: "3000"
};

test("accounting CSV presets use destination-specific headers and signed amounts", () => {
  const quickbooks = exportBankRows(rows, "quickbooks-csv");
  assert.equal(quickbooks.ok, true);
  assert.match(quickbooks.content, /^Date,Description,Amount\n/);
  assert.match(quickbooks.content, /05\/02\/2026,Amazon Web Services,-25.50/);

  const xero = exportBankRows(rows, "xero-csv");
  assert.match(xero.content, /^Date,Amount,Payee,Description,Reference\n/);
  assert.match(xero.content, /2026\/05\/01,1000.00,Stripe payout/);

  const wave = exportBankRows(rows, "wave-csv");
  assert.match(wave.content, /^Date,Description,Amount\n/);
  assert.match(wave.content, /2026-05-02,Amazon Web Services,-25.50/);

  const gnucash = exportBankRows(rows, "gnucash-csv");
  assert.match(gnucash.content, /^Date,Description,Deposit,Withdrawal\n/);
  assert.match(gnucash.content, /2026-05-02,Amazon Web Services,,25.50/);
});

test("OFX and QBO require account metadata while QIF does not", () => {
  assert.deepEqual(missingBankMetadata("ofx", {}), ["bankId", "accountId"]);
  assert.deepEqual(missingBankMetadata("qbo", { bankId: "123", accountId: "456" }), ["intuitBankId"]);
  assert.deepEqual(missingBankMetadata("qif", {}), []);

  const ofx = exportBankRows(rows, "ofx", { accountingMetadata: metadata });
  assert.equal(ofx.ok, true);
  assert.match(ofx.content, /<BANKID>123456789/);
  assert.match(ofx.content, /<ACCTID>987654321/);
  assert.match(ofx.content, /<FITID>2026050100001/);

  const qbo = exportBankRows(rows, "qbo", { accountingMetadata: metadata });
  assert.equal(qbo.ok, true);
  assert.match(qbo.content, /<INTU\.BID>3000/);

  const qif = exportBankRows(rows, "qif");
  assert.equal(qif.ok, true);
  assert.match(qif.content, /^!Type:Bank\n/);
  assert.match(qif.content, /T-25.50/);
});

test("bank exports carry validation report and stable download names", () => {
  const exported = exportBankRows(rows, "quickbooks-csv", { sourceFileName: "May Statement.pdf" });
  assert.match(exported.validationReport, /Rows extracted: 2/);
  assert.match(exported.validationReport, /Review before import/);
  assert.equal(bankDownloadFileName("quickbooks-csv", "May Statement.pdf"), "aiconverter-May-Statement-quickbooks.csv");
  assert.equal(bankDownloadFileName("ofx", "May Statement.pdf"), "aiconverter-May-Statement-ofx.ofx");
});

test("bank output format normalization keeps accounting presets distinct", () => {
  assert.equal(normalizeBankOutputFormat("quickbooks-csv"), "quickbooks-csv");
  assert.equal(normalizeBankOutputFormat("qbo"), "qbo");
  assert.equal(normalizeBankOutputFormat("docx"), "csv");
});

test("bank PDF conversion can emit QuickBooks CSV from extracted rows", async () => {
  const pdf = buildPdf([
    "Date Description Money Out Money In Balance",
    "2026-05-01 Stripe payout 0.00 1000.00 1000.00",
    "2026-05-02 Amazon Web Services 25.50 0.00 974.50"
  ]);

  const result = await convertFileToCsv({}, "bank", "statement.pdf", "application/pdf", pdf, {
    previewPages: 1,
    estimatedPages: 1,
    outputFormat: "quickbooks-csv"
  });

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "quickbooks-csv");
  assert.match(result.content, /^Date,Description,Amount\n/);
  assert.match(result.validationReport, /Rows extracted:/);
});

function buildPdf(lines) {
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 760 Td",
    ...lines.flatMap((line, index) => [
      ...(index ? ["0 -16 Td"] : []),
      `(${pdfTextEscape(line)}) Tj`
    ]),
    "ET"
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf).buffer;
}

function pdfTextEscape(value) {
  return String(value).replace(/([\\()])/g, "\\$1");
}
