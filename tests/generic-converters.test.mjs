import test from "node:test";
import assert from "node:assert/strict";
import { startCloudConvertConversion, refreshCloudConvertConversion } from "../functions/lib/cloudconvert.js";
import { refreshUniversalProviderConversion, startUniversalProviderConversion } from "../functions/lib/universal-providers.js";
import { convertFileToCsv } from "../functions/lib/extract.js";
import { assertSupportedUpload, normalizeOutputFormat } from "../functions/lib/jobs.js";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;

test("receipt converter creates an expense CSV from OCR markdown", async () => {
  const calls = mockFetch({
    pages: [
      {
        markdown: [
          "# Central Coffee",
          "Date 05/12/2026",
          "Latte $4.50",
          "Bagel $3.25",
          "Tax $0.62",
          "Visa **** 4242",
          "TOTAL $8.37"
        ].join("\n"),
        confidence_scores: { average_page_confidence_score: 0.94 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "receipt",
    "receipt.png",
    "image/png",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].document.type, "image_url");
  assert.equal(result.columns[1].key, "vendor");
  assert.match(result.csv, /Central Coffee/);
  assert.match(result.csv, /Meals/);
  assert.match(result.csv, /card/);
  assert.match(result.csv, /0.62/);
  assert.match(result.csv, /8.37/);
  restoreFetch();
});

test("receipt converter exports one row per readable receipt page", async () => {
  mockFetch({
    pages: [
      {
        markdown: "Central Coffee\nDate 05/12/2026\nLatte $4.50\nTOTAL $4.50",
        confidence_scores: { average_page_confidence_score: 0.93 }
      },
      {
        markdown: "Cloud Hosting Inc\nInvoice\nDate 05/13/2026\nSubtotal $20.00\nTax $2.00\nAmount Paid $22.00\nMastercard",
        confidence_scores: { average_page_confidence_score: 0.9 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "receipt",
    "receipts.pdf",
    "application/pdf",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.match(result.csv, /Central Coffee/);
  assert.match(result.csv, /Cloud Hosting Inc/);
  assert.match(result.csv, /Software/);
  restoreFetch();
});

test("screenshot converter uses OCR table blocks when markdown has placeholders", async () => {
  const calls = mockFetch({
    pages: [
      {
        markdown: "[tbl-0.md](tbl-0.md)",
        tables: [
          {
            markdown: [
              "| Date | Item | Amount |",
              "| --- | --- | --- |",
              "| Smoke 2026-05-13T05:29:00.423Z | | |",
              "| 2026-05-01 | Hosting | $12.30 |",
              "| 2026-05-02 | Domain | $10.46 |"
            ].join("\n")
          }
        ],
        confidence_scores: { average_page_confidence_score: 0.91 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "screenshot",
    "table.png",
    "image/png",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].document.type, "image_url");
  assert.deepEqual(result.columns.map((column) => column.label), ["Date", "Item", "Amount"]);
  assert.match(result.csv, /Hosting/);
  assert.match(result.csv, /Domain/);
  restoreFetch();
});

test("screenshot converter parses html tables from OCR output", async () => {
  mockFetch({
    pages: [
      {
        markdown: "<table><tr><th>Date</th><th>Vendor</th><th>Total</th></tr><tr><td>2026-05-01</td><td>Hosting</td><td>$12.30</td></tr></table>",
        confidence_scores: { average_page_confidence_score: 0.9 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "screenshot",
    "table.png",
    "image/png",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.columns.map((column) => column.label), ["Date", "Vendor", "Total"]);
  assert.match(result.csv, /Hosting/);
  restoreFetch();
});

test("screenshot converter recovers obvious rows from plain OCR text", async () => {
  mockFetch({
    pages: [
      {
        markdown: "Date Item Amount 2026-05-01 Hosting $12.30 2026-05-02 Domain $10.46",
        confidence_scores: { average_page_confidence_score: 0.88 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "screenshot",
    "table.png",
    "image/png",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.columns.map((column) => column.label), ["Date", "Description", "Amount"]);
  assert.match(result.csv, /Hosting/);
  assert.match(result.csv, /Domain/);
  restoreFetch();
});

test("invoice converter creates a structured invoice CSV from OCR markdown", async () => {
  mockFetch({
    pages: [
      {
        markdown: [
          "Cloud Hosting Inc",
          "Invoice # INV-2026-042",
          "Invoice Date May 10 2026",
          "Due Date May 24 2026",
          "Hosting plan $220.00",
          "Tax $22.00",
          "Amount Due $242.00",
          "Payment terms Net 14"
        ].join("\n"),
        confidence_scores: { average_page_confidence_score: 0.93 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "invoice",
    "invoice.pdf",
    "application/pdf",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "csv");
  assert.equal(result.columns[0].key, "vendor");
  assert.match(result.csv, /Cloud Hosting Inc/);
  assert.match(result.csv, /INV-2026-042/);
  assert.match(result.csv, /242/);
  assert.match(result.csv, /Net 14/i);
  restoreFetch();
});

test("invoice converter can produce JSON for structured workflows", async () => {
  mockFetch({
    pages: [
      {
        markdown: [
          "Cloud Hosting Inc",
          "Invoice Number INV-2026-042",
          "Invoice Date 2026-05-10",
          "Due Date 2026-05-24",
          "Usage overage $20.00",
          "Subtotal $220.00",
          "Tax $22.00",
          "Grand Total $242.00"
        ].join("\n"),
        confidence_scores: { average_page_confidence_score: 0.93 }
      }
    ]
  });

  const result = await convertFileToCsv(
    { MISTRAL_API_KEY: "test-key" },
    "invoice",
    "invoice.pdf",
    "application/pdf",
    PNG_BYTES,
    { outputFormat: "json" }
  );

  const parsed = JSON.parse(result.content);
  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "json");
  assert.equal(parsed.invoice.invoice_number, "INV-2026-042");
  assert.equal(parsed.invoice.total, 242);
  assert.ok(Array.isArray(parsed.line_items));
  restoreFetch();
});

test("audio converter creates TXT transcript with Workers AI", async () => {
  const result = await convertFileToCsv(
    {
      AI: {
        async run(model, input) {
          assert.equal(model, "@cf/openai/whisper-large-v3-turbo");
          assert.equal(typeof input.audio, "string");
          assert.ok(input.audio.length > 0);
          return { text: "Close the books and export the statement rows.", word_count: 8 };
        }
      }
    },
    "audio-transcript",
    "memo.mp3",
    "audio/mpeg",
    new Uint8Array([0xff, 0xfb, 0x90, 0x64]).buffer
  );

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "txt");
  assert.match(result.content, /Close the books/);
  assert.match(result.csv, /word_count/);
});

test("audio converter sends larger files as one base64 audio file instead of a huge byte array", async () => {
  const calls = [];
  const bytes = new Uint8Array(1024 * 1024 + 8);
  bytes.set([0xff, 0xfb, 0x90, 0x64], 0);

  const result = await convertFileToCsv(
    {
      AI: {
        async run(model, input) {
          calls.push({ model, input });
          assert.equal(typeof input.audio, "string");
          assert.ok(input.audio.length > bytes.byteLength);
          return { text: "whole file transcript", word_count: 3 };
        }
      }
    },
    "audio-transcript",
    "memo.mp3",
    "audio/mpeg",
    bytes.buffer
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(result.content, /whole file transcript/);
  assert.deepEqual(result.warnings, []);
});

test("audio upload validation accepts ADTS AAC files that are advertised in the UI", () => {
  const bytes = new Uint8Array([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f, 0xfc, 0x00]);
  const file = { name: "voice.aac", type: "audio/aac", size: bytes.byteLength };
  assert.equal(assertSupportedUpload(file, bytes.buffer, "audio-transcript"), "");
});

test("audio converter can produce JSON transcript", async () => {
  const result = await convertFileToCsv(
    {
      AI: {
        async run() {
          return { text: "Review the invoice before Friday.", word_count: 6, vtt: "WEBVTT" };
        }
      }
    },
    "audio-transcript",
    "memo.mp3",
    "audio/mpeg",
    new Uint8Array([0xff, 0xfb, 0x90, 0x64]).buffer,
    { outputFormat: "json" }
  );

  const parsed = JSON.parse(result.content);
  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "json");
  assert.equal(parsed.word_count, 6);
  assert.match(parsed.transcript, /invoice/);
});

test("document converter creates Markdown from Workers AI markdown conversion", async () => {
  const result = await convertFileToCsv(
    {
      AI: {
        async toMarkdown(file) {
          assert.equal(file.name, "plan.docx");
          assert.ok(file.blob);
          return {
            format: "markdown",
            mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            tokens: 42,
            data: "# Operating plan\n\n- Close books\n- Export rows"
          };
        }
      }
    },
    "document-markdown",
    "plan.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer
  );

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "md");
  assert.match(result.content, /Operating plan/);
  assert.match(result.csv, /tokens/);
});

test("screenshot to HTML creates an honest starter file", async () => {
  const result = await convertFileToCsv(
    {
      AI: {
        async toMarkdown() {
          return {
            format: "markdown",
            mimetype: "image/png",
            tokens: 35,
            data: "# Settings\n\n- Profile\n- Billing\n\nSave changes"
          };
        }
      }
    },
    "screenshot-code",
    "settings.png",
    "image/png",
    PNG_BYTES
  );

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "html");
  assert.match(result.content, /<!doctype html>/);
  assert.match(result.content, /Settings/);
  assert.match(result.warnings.join(" "), /not a pixel-perfect clone/);
});

test("paid screenshot to HTML uses Workers AI vision for standalone HTML", async () => {
  const result = await convertFileToCsv(
    {
      AI: {
        async run(model, input) {
          assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
          assert.equal(input.prompt.includes("standalone HTML"), true);
          assert.equal(Array.isArray(input.image), true);
          assert.equal(input.image[0], 0x89);
          return {
            response:
              "<!doctype html><html><head><title>Settings</title><style>body{font-family:sans-serif}</style></head><body><main><h1>Settings</h1><button>Save</button></main></body></html>"
          };
        }
      }
    },
    "screenshot-code",
    "settings.png",
    "image/png",
    PNG_BYTES,
    { allowPaidFallback: true }
  );

  assert.equal(result.ok, true);
  assert.equal(result.outputFormat, "html");
  assert.equal(result.provider, "workers-ai-vision-html");
  assert.match(result.content, /<button>Save<\/button>/);
  assert.match(result.warnings.join(" "), /not guaranteed pixel-perfect/);
});

test("universal converter creates a provider-backed route preview when CloudConvert is configured", async () => {
  const result = await convertFileToCsv(
    { CLOUDCONVERT_API_KEY: "test-key" },
    "universal-file",
    "deck.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
    { outputFormat: "pdf" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.provider, "cloudconvert-preview");
  assert.equal(result.columns[0].key, "file");
  assert.match(result.csv, /deck.pptx/);
  assert.match(result.csv, /PDF/);
  assert.equal(normalizeOutputFormat("mp4", "universal-file"), "mp4");
});

test("universal converter creates a provider-backed route preview when only Convertio is configured", async () => {
  const result = await convertFileToCsv(
    { CONVERTIO_API_KEY: "test-key" },
    "universal-file",
    "deck.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
    { outputFormat: "pdf" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.provider, "convertio-preview");
  assert.equal(result.previewRows[0].route, "Preview ready");
  assert.match(result.csv, /PDF/);
});

test("universal converter fails closed without a provider configuration", async () => {
  const result = await convertFileToCsv(
    {},
    "universal-file",
    "deck.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
    { outputFormat: "pdf" }
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /not ready/);
});

test("universal upload validation accepts provider document, media, and archive signatures", () => {
  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  assert.equal(
    assertSupportedUpload(
      {
        name: "deck.pptx",
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: docx.byteLength
      },
      docx.buffer,
      "universal-file"
    ),
    ""
  );

  const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.equal(
    assertSupportedUpload({ name: "clip.mp4", type: "video/mp4", size: mp4.byteLength }, mp4.buffer, "universal-file"),
    ""
  );

  const archive = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
  assert.equal(
    assertSupportedUpload({ name: "files.7z", type: "application/x-7z-compressed", size: archive.byteLength }, archive.buffer, "universal-file"),
    ""
  );
});

test("CloudConvert start uses import/upload and records an async provider job", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.cloudconvert.com/v2/users/me",
      response: {
        data: { id: "user-1", credits: 20 }
      }
    },
    {
      match: "https://api.cloudconvert.com/v2/jobs",
      response: {
        data: {
          id: "cc-job-1",
          status: "waiting",
          tasks: [
            {
              id: "upload-task-1",
              operation: "import/upload",
              result: {
                form: {
                  url: "https://upload.cloudconvert.test/job",
                  parameters: { signature: "sig", expires: "1" }
                }
              }
            }
          ]
        }
      }
    },
    {
      match: "https://upload.cloudconvert.test/job",
      response: {}
    }
  ]);
  const env = mockJobEnv();
  const result = await startCloudConvertConversion(env, mockUniversalJob(), new Uint8Array([1, 2, 3]).buffer);

  assert.equal(result.pending, true);
  assert.equal(result.status, "converting_full");
  assert.equal(fetchCalls.length, 3);
  assert.deepEqual(fetchCalls[1].body.tasks["convert-file"].output_format, "pdf");
  assert.equal(fetchCalls[1].body.tasks["convert-file"].input, "upload-source");
  assert.equal(fetchCalls[2].body instanceof FormData, true);
  assert.equal(env.updates.at(-1).fields.external_job_id, "cc-job-1");
  restoreFetch();
});

test("CloudConvert daily cap blocks new provider jobs before conversion spend", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.cloudconvert.com/v2/users/me",
      response: {
        data: { id: "user-1", credits: 20 }
      }
    }
  ]);
  const env = mockJobEnv({
    cloudConvertUsage: { started: 10, complete: 8, failed: 1, converting: 1 },
    vars: { CLOUDCONVERT_DAILY_JOB_LIMIT: "10" }
  });
  const result = await startCloudConvertConversion(env, mockUniversalJob(), new Uint8Array([1, 2, 3]).buffer);

  assert.equal(result.ok, false);
  assert.match(result.message, /daily cap reached/i);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://api.cloudconvert.com/v2/users/me");
  assert.equal(env.updates.length, 0);
  restoreFetch();
});

test("CloudConvert credit reserve blocks new provider jobs before conversion spend", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.cloudconvert.com/v2/users/me",
      response: {
        data: { id: "user-1", credits: 1 }
      }
    }
  ]);
  const env = mockJobEnv({
    vars: { CLOUDCONVERT_MIN_CREDITS: "1", CLOUDCONVERT_DAILY_JOB_LIMIT: "10" }
  });
  const result = await startCloudConvertConversion(env, mockUniversalJob(), new Uint8Array([1, 2, 3]).buffer);

  assert.equal(result.ok, false);
  assert.match(result.message, /credits are at or below/i);
  assert.equal(fetchCalls.length, 1);
  assert.equal(env.updates.length, 0);
  restoreFetch();
});

test("universal provider route falls back to Convertio when CloudConvert cap is reached", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.cloudconvert.com/v2/users/me",
      response: {
        data: { id: "user-1", credits: 20 }
      }
    },
    {
      match: "https://api.convertio.co/convert",
      response: {
        status: "ok",
        data: { id: "convertio-job-77", minutes: 1 }
      }
    },
    {
      match: "https://api.convertio.co/convert/convertio-job-77/deck.pptx",
      response: {
        status: "ok",
        data: { file: "deck.pptx" }
      }
    }
  ]);
  const env = mockJobEnv({
    cloudConvertUsage: { started: 10, complete: 8, failed: 1, converting: 1 },
    vars: {
      CLOUDCONVERT_DAILY_JOB_LIMIT: "10",
      CONVERTIO_API_KEY: "convertio-test-key",
      CONVERTIO_DAILY_JOB_LIMIT: "10"
    }
  });
  const result = await startUniversalProviderConversion(env, mockUniversalJob(), new Uint8Array([1, 2, 3]).buffer);

  assert.equal(result.pending, true);
  assert.equal(result.provider, "convertio");
  assert.equal(result.previewRows[0].route, "Converting");
  assert.equal(fetchCalls.length, 3);
  assert.equal(fetchCalls[1].body.outputformat, "pdf");
  assert.equal(fetchCalls[2].body instanceof ArrayBuffer, true);
  assert.equal(env.updates.at(-1).fields.external_provider, "convertio");
  restoreFetch();
});

test("Convertio backup refresh downloads the exported file into private result storage", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.convertio.co/convert/convertio-job-77/status",
      response: {
        status: "ok",
        data: {
          id: "convertio-job-77",
          step: "finish",
          output: { url: "https://storage.convertio.test/deck.pdf", size: 4 }
        }
      }
    },
    {
      match: "https://storage.convertio.test/deck.pdf",
      response: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
      contentType: "application/pdf"
    },
    {
      match: "https://api.convertio.co/convert/convertio-job-77",
      response: {
        status: "ok"
      }
    }
  ]);
  const env = mockJobEnv({ vars: { CONVERTIO_API_KEY: "convertio-test-key" } });
  const job = { ...mockUniversalJob(), status: "converting_full", external_provider: "convertio", external_job_id: "convertio-job-77" };
  const result = await refreshUniversalProviderConversion(env, job);

  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(result.provider, "convertio");
  assert.equal(fetchCalls.length, 3);
  assert.equal(env.bucketPuts[0].key, "jobs/job_test/result.pdf");
  assert.equal(env.bucketPuts[0].metadata.httpMetadata.contentType, "application/pdf");
  assert.equal(env.updates.at(-1).fields.status, "complete");
  restoreFetch();
});

test("CloudConvert refresh downloads the exported file into private result storage", async () => {
  const fetchCalls = mockCloudConvertFetch([
    {
      match: "https://api.cloudconvert.com/v2/jobs/cc-job-1",
      response: {
        data: {
          id: "cc-job-1",
          status: "finished",
          tasks: [
            {
              id: "export-task-1",
              operation: "export/url",
              status: "finished",
              result: {
                files: [{ filename: "deck.pdf", url: "https://storage.cloudconvert.test/deck.pdf" }]
              }
            }
          ]
        }
      }
    },
    {
      match: "https://storage.cloudconvert.test/deck.pdf",
      response: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
      contentType: "application/pdf"
    }
  ]);
  const env = mockJobEnv();
  const job = { ...mockUniversalJob(), status: "converting_full", external_job_id: "cc-job-1" };
  const result = await refreshCloudConvertConversion(env, job);

  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(fetchCalls.length, 2);
  assert.equal(env.bucketPuts[0].key, "jobs/job_test/result.pdf");
  assert.equal(env.bucketPuts[0].metadata.httpMetadata.contentType, "application/pdf");
  assert.equal(env.updates.at(-1).fields.status, "complete");
  restoreFetch();
});

let originalFetch = globalThis.fetch;

function mockFetch(payload) {
  const calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      }
    };
  };
  return calls;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function mockCloudConvertFetch(sequence) {
  const calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const next = sequence.shift();
    assert.ok(next, `Unexpected fetch ${url}`);
    assert.equal(String(url), next.match);
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    calls.push({ url: String(url), options, body });
    return {
      ok: true,
      status: 200,
      headers: new Headers(next.contentType ? { "Content-Type": next.contentType } : {}),
      async json() {
        return next.response || {};
      },
      async arrayBuffer() {
        return next.response instanceof ArrayBuffer ? next.response : new ArrayBuffer(0);
      }
    };
  };
  return calls;
}

function mockJobEnv(options = {}) {
  let dailyCounter = options.cloudConvertReserved || 0;
  const env = {
    CLOUDCONVERT_API_KEY: "test-key",
    ...(options.vars || {}),
    updates: [],
    bucketPuts: [],
    AICONVERTER_DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                const text = String(sql);
                if (text.includes("COUNT(*) AS started")) {
                  return {
                    started: options.cloudConvertUsage?.started || 0,
                    complete: options.cloudConvertUsage?.complete || 0,
                    failed: options.cloudConvertUsage?.failed || 0,
                    converting: options.cloudConvertUsage?.converting || 0
                  };
                }
                if (text.includes("RETURNING count")) {
                  const limit = Number(values.at(-1));
                  if (dailyCounter < limit) {
                    dailyCounter += 1;
                    return { count: dailyCounter };
                  }
                  return null;
                }
                if (text.includes("SELECT count FROM rate_limits")) {
                  return { count: dailyCounter };
                }
                return {};
              },
              async run() {
                env.updates.push({ values, fields: extractUpdateFields(values) });
              }
            };
          }
        };
      }
    },
    AICONVERTER_BUCKET: {
      async put(key, body, metadata) {
        env.bucketPuts.push({ key, body, metadata });
      },
      async delete() {}
    }
  };
  return env;
}

function mockUniversalJob() {
  return {
    id: "job_test",
    result_key: "jobs/job_test/result.pdf",
    source_key: "sources/job_test/universal.pptx",
    original_file_name: "deck.pptx",
    input_mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    expires_at: "2026-05-17T00:00:00.000Z",
    paid_at: "2026-05-16T00:00:00.000Z",
    download_count: 0
  };
}

function extractUpdateFields(values) {
  const fields = {};
  const names = [
    "status",
    "extractor",
    "external_provider",
    "external_job_id",
    "external_task_id",
    "external_status",
    "external_updated_at",
    "confidence",
    "row_count",
    "completed_at",
    "external_result_name",
    "external_result_url"
  ];
  names.forEach((name, index) => {
    if (index < values.length - 2) fields[name] = values[index];
  });
  return fields;
}
