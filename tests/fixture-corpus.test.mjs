import test from "node:test";
import assert from "node:assert/strict";
import { convertFileToCsv } from "../functions/lib/extract.js";
import { assertSupportedUpload } from "../functions/lib/jobs.js";

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
)).buffer;

test("fixture corpus converts a real selectable-text bank PDF through the native parser", async () => {
  const pdf = buildPdf([
    "Date Description Money Out Money In Balance",
    "2026-05-01 Opening Deposit 0.00 1000.00 1000.00",
    "2026-05-02 Coffee Shop 4.50 0.00 995.50",
    "2026-05-03 Hosting 12.30 0.00 983.20"
  ]);

  const result = await convertFileToCsv({}, "bank", "statement.pdf", "application/pdf", pdf, {
    previewPages: 1,
    estimatedPages: 1
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "native-pdf");
  assert.equal(result.rowCount, 3);
  assert.match(result.csv, /Opening Deposit/);
});

test("fixture corpus accepts real PNG bytes for image-backed AI converters", async () => {
  const file = { name: "receipt.png", type: "image/png", size: ONE_PIXEL_PNG.byteLength };
  assert.equal(assertSupportedUpload(file, ONE_PIXEL_PNG, "receipt"), "");

  mockFetch({
    pages: [
      {
        markdown: "Central Coffee\nDate 2026-05-12\nLatte $4.50\nTax $0.50\nTOTAL $5.00\nVisa",
        confidence_scores: { average_page_confidence_score: 0.94 }
      }
    ]
  });

  const result = await convertFileToCsv({ MISTRAL_API_KEY: "test-key" }, "receipt", "receipt.png", "image/png", ONE_PIXEL_PNG);
  assert.equal(result.ok, true);
  assert.match(result.csv, /Central Coffee/);
  restoreFetch();
});

test("fixture corpus accepts a real WAV container for audio transcript", async () => {
  const wav = buildWav();
  const file = { name: "memo.wav", type: "audio/wav", size: wav.byteLength };
  assert.equal(assertSupportedUpload(file, wav, "audio-transcript"), "");

  const result = await convertFileToCsv(
    {
      AI: {
        async run(_model, input) {
          assert.equal(typeof input.audio, "string");
          return { text: "Export the receipt totals before Friday.", word_count: 6 };
        }
      }
    },
    "audio-transcript",
    "memo.wav",
    "audio/wav",
    wav
  );

  assert.equal(result.ok, true);
  assert.match(result.content, /receipt totals/);
});

let originalFetch = globalThis.fetch;

function mockFetch(payload) {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.ok(JSON.parse(options.body));
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      }
    };
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function buildWav() {
  const dataBytes = 32;
  const bytes = new Uint8Array(44 + dataBytes);
  writeAscii(bytes, 0, "RIFF");
  writeUint32(bytes, 4, 36 + dataBytes);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  writeUint32(bytes, 16, 16);
  writeUint16(bytes, 20, 1);
  writeUint16(bytes, 22, 1);
  writeUint32(bytes, 24, 8000);
  writeUint32(bytes, 28, 16000);
  writeUint16(bytes, 32, 2);
  writeUint16(bytes, 34, 16);
  writeAscii(bytes, 36, "data");
  writeUint32(bytes, 40, dataBytes);
  return bytes.buffer;
}

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

function writeAscii(bytes, offset, value) {
  for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}
