import test from "node:test";
import assert from "node:assert/strict";
import { convertPdfToCsv, detectPdfPageCount } from "../functions/lib/extract.js";
import { MAX_PAGE_COUNT } from "../functions/lib/jobs.js";

test("detects and blocks PDFs above the 500 page pack limit", async () => {
  const pdf = makeBlankPdf(MAX_PAGE_COUNT + 1);
  const pageCount = await detectPdfPageCount(pdf);

  assert.equal(pageCount, MAX_PAGE_COUNT + 1);

  const result = await convertPdfToCsv({}, "oversized.pdf", pdf, {});
  assert.equal(result.ok, false);
  assert.match(result.message, /500 pages/);
  assert.equal(result.provider, "page-limit");
});

function makeBlankPdf(pageCount) {
  const objects = [];
  const kids = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  for (let index = 0; index < pageCount; index += 1) {
    const objectNumber = index + 3;
    kids.push(`${objectNumber} 0 R`);
    objects.push(`${objectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n`);
  }

  objects.splice(1, 0, `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>\nendobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf)).buffer;
}
