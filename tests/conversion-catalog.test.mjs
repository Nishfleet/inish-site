import test from "node:test";
import assert from "node:assert/strict";
import data from "../src/data/converters.json" with { type: "json" };
import {
  TOP_CONVERSION_REQUESTS,
  availableConversionCount,
  availableConversionCountLabel,
  buildConversionCatalog,
  confidenceDetailsForConverter
} from "../src/conversion-catalog.js";
import { assertSupportedUpload } from "../functions/lib/jobs.js";
import { universalPreviewRow } from "../functions/lib/universal.js";

test("conversion catalog gates provider-backed claims behind configured provider route", () => {
  const disabledCatalog = buildConversionCatalog(data.converters, { universalProviderReady: false });
  const enabledCatalog = buildConversionCatalog(data.converters, { universalProviderReady: true });
  const disabledAvailable = new Set(disabledCatalog.filter((pair) => pair.available).map((pair) => pair.label));
  const enabledAvailable = new Set(enabledCatalog.filter((pair) => pair.available).map((pair) => pair.label));

  assert.ok(disabledAvailable.has("Bank statement PDF to CSV"));
  assert.ok(disabledAvailable.has("JPG to PNG"));
  assert.equal(disabledAvailable.has("PDF to Word"), false);
  assert.ok(enabledAvailable.has("PDF to Word"));
  assert.ok(enabledAvailable.has("HEIC to JPG"));
  assert.ok(enabledAvailable.has("MP4 to MP3"));
  assert.ok(availableConversionCount(data.converters, { universalProviderReady: true }) >= 200);
  assert.equal(availableConversionCountLabel(availableConversionCount(data.converters, { universalProviderReady: true })), "Many conversion options available");
});

test("publicly highlighted top requests exist in the generated catalog", () => {
  const catalog = buildConversionCatalog(data.converters, { universalProviderReady: true });
  const availableLabels = new Set(catalog.filter((pair) => pair.available).map((pair) => pair.label));

  for (const request of TOP_CONVERSION_REQUESTS) {
    assert.ok(availableLabels.has(request.label), `${request.label} should be available in generated catalog`);
  }
});

test("customer-facing conversion catalog does not expose routing vendors", () => {
  const catalog = buildConversionCatalog(data.converters, { universalProviderReady: true });
  const universal = data.converters.find((converter) => converter.id === "universal-file");
  const confidence = confidenceDetailsForConverter(universal, "docx", { universalProviderReady: true });
  const customerText = [
    ...catalog.flatMap((pair) => [pair.category, pair.detail, pair.label]),
    confidence.output,
    confidence.preview,
    confidence.privacy,
    confidence.state
  ].join(" ");

  assert.doesNotMatch(customerText, /provider|CloudConvert|Convertio|universal route|browser-local/i);
});

test("top provider conversion fixtures pass upload validation and preview routing", () => {
  const fixtures = [
    { label: "PDF to Word", name: "statement.pdf", type: "application/pdf", output: "docx", bytes: ascii("%PDF-1.7\n1 0 obj\n") },
    { label: "Word to PDF", name: "contract.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", output: "pdf", bytes: bytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]) },
    { label: "PDF to JPG", name: "flyer.pdf", type: "application/pdf", output: "jpg", bytes: ascii("%PDF-1.7\n1 0 obj\n") },
    { label: "HEIC to JPG", name: "photo.heic", type: "image/heic", output: "jpg", bytes: ascii("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00") },
    { label: "SVG to PNG", name: "logo.svg", type: "image/svg+xml", output: "png", bytes: ascii("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"><rect width=\"1\" height=\"1\"/></svg>") },
    { label: "MP4 to MP3", name: "clip.mp4", type: "video/mp4", output: "mp3", bytes: ascii("\x00\x00\x00\x18ftypisom\x00\x00\x00\x00") },
    { label: "MOV to MP4", name: "capture.mov", type: "video/quicktime", output: "mp4", bytes: ascii("\x00\x00\x00\x18ftypqt  \x00\x00\x00\x00") },
    { label: "GIF to MP4", name: "loop.gif", type: "image/gif", output: "mp4", bytes: ascii("GIF89a\x01\x00\x01\x00") },
    { label: "WAV to MP3", name: "voice.wav", type: "audio/wav", output: "mp3", bytes: ascii("RIFF\x24\x00\x00\x00WAVEfmt ") },
    { label: "XLSX to CSV", name: "sheet.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output: "csv", bytes: bytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]) },
    { label: "CSV to XLSX", name: "rows.csv", type: "text/csv", output: "xlsx", bytes: ascii("Name,Amount\nDemo,12.30\n") }
  ];
  const fixtureLabels = new Set(fixtures.map((fixture) => fixture.label));
  for (const request of TOP_CONVERSION_REQUESTS.filter((item) => item.qaPriority === "provider")) {
    assert.ok(fixtureLabels.has(request.label), `${request.label} should have a provider QA fixture`);
  }

  for (const fixture of fixtures) {
    const file = { name: fixture.name, type: fixture.type, size: fixture.bytes.byteLength };
    assert.equal(assertSupportedUpload(file, fixture.bytes, "universal-file"), "", `${fixture.label} fixture should validate`);
    const preview = universalPreviewRow(fixture.name, fixture.type, fixture.output);
    assert.equal(preview.output, fixture.output.toUpperCase());
    assert.equal(preview.status, "Ready to unlock");
  }
});

function ascii(value) {
  return new TextEncoder().encode(value).buffer;
}

function bytes(values) {
  return new Uint8Array(values).buffer;
}
