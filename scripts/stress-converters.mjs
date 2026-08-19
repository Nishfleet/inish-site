import assert from "node:assert/strict";
import { convertFileToCsv } from "../functions/lib/extract.js";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
const AUDIO_BYTES = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]).buffer;
const DOC_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]).buffer;

const originalFetch = globalThis.fetch;
let ocrCalls = 0;

globalThis.fetch = async (_url, options) => {
  ocrCalls += 1;
  const body = JSON.parse(options.body);
  const type = body.document?.type;
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        pages: [
          {
            markdown:
              type === "image_url"
                ? [
                    "Cloud Hosting Inc",
                    "Invoice Number INV-2026-042",
                    "Invoice Date 2026-05-10",
                    "Due Date 2026-05-24",
                    "| Date | Item | Amount |",
                    "| --- | --- | --- |",
                    "| 2026-05-01 | Hosting | $12.30 |",
                    "| 2026-05-02 | Domain | $10.46 |",
                    "Tax $22.00",
                    "Grand Total $242.00"
                  ].join("\n")
                : "Central Coffee\nDate 05/12/2026\nLatte $4.50\nTax $0.62\nTOTAL $8.37",
            confidence_scores: { average_page_confidence_score: 0.93 }
          }
        ]
      };
    }
  };
};

const env = {
  MISTRAL_API_KEY: "stress-test",
  CLOUDCONVERT_API_KEY: "stress-test",
  AI: {
    async run() {
      return { text: "Close the books and export clean rows before Friday.", word_count: 9 };
    },
    async toMarkdown(file) {
      return {
        format: "markdown",
        mimetype: file.blob?.type || "application/octet-stream",
        tokens: 64,
        data: "# Stress file\n\n- Upload\n- Preview\n- Download"
      };
    }
  }
};

const scenarios = [
  () => convertFileToCsv(env, "receipt", "receipt.png", "image/png", PNG_BYTES),
  () => convertFileToCsv(env, "screenshot", "table.png", "image/png", PNG_BYTES),
  () => convertFileToCsv(env, "invoice", "invoice.png", "image/png", PNG_BYTES),
  () => convertFileToCsv(env, "invoice", "invoice.png", "image/png", PNG_BYTES, { outputFormat: "json" }),
  () => convertFileToCsv(env, "audio-transcript", "memo.mp3", "audio/mpeg", AUDIO_BYTES),
  () => convertFileToCsv(env, "audio-transcript", "memo.mp3", "audio/mpeg", AUDIO_BYTES, { outputFormat: "json" }),
  () =>
    convertFileToCsv(
      env,
      "document-markdown",
      "plan.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      DOC_BYTES
    ),
  () => convertFileToCsv(env, "screenshot-code", "screen.png", "image/png", PNG_BYTES),
  () =>
    convertFileToCsv(
      env,
      "universal-file",
      "deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      DOC_BYTES,
      { outputFormat: "pdf" }
    )
];

const started = Date.now();
const rounds = Number(process.env.STRESS_ROUNDS || 40);
let conversions = 0;

for (let round = 0; round < rounds; round += 1) {
  for (const scenario of scenarios) {
    const result = await scenario();
    assert.equal(result.ok, true);
    assert.ok(result.content || result.csv);
    conversions += 1;
  }
}

globalThis.fetch = originalFetch;
console.log(
  JSON.stringify(
    {
      ok: true,
      conversions,
      rounds,
      ocrCalls,
      elapsedMs: Date.now() - started
    },
    null,
    2
  )
);
