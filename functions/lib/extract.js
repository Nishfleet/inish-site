import { extractText, getDocumentProxy } from "unpdf";
import { hasAzureConfig, hasMistralConfig, MAX_PAGE_COUNT, normalizeConverterId, rowsToCsv } from "./jobs.js";
import { hasCloudConvertConfig } from "./cloudconvert.js";
import { hasConvertioConfig } from "./convertio.js";
import {
  bankOutputContentType,
  bankOutputFileExtension,
  exportBankRows,
  normalizeBankOutputFormat
} from "./accounting-exports.js";
import {
  isUniversalConverter,
  normalizeUniversalOutputFormat,
  UNIVERSAL_COLUMNS,
  universalPreviewRow
} from "./universal.js";
import { validateStatementRows } from "./validate-statement.js";

const DEFAULT_AZURE_MODEL = "prebuilt-bankStatement.us";
const DEFAULT_AZURE_API_VERSION = "2024-11-30";
const DEFAULT_MISTRAL_MODEL = "mistral-ocr-latest";
const DEFAULT_WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";
const DEFAULT_SCREENSHOT_CODE_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const extractionSchema = {
  type: "object",
  properties: {
    confidence: { type: "number" },
    currency: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          money_in: { type: ["number", "null"] },
          money_out: { type: ["number", "null"] },
          balance: { type: ["number", "null"] },
          page: { type: ["number", "null"] },
          confidence: { type: "number" }
        },
        required: ["date", "description", "money_in", "money_out", "balance", "page", "confidence"]
      }
    }
  },
  required: ["confidence", "transactions", "warnings"]
};

const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12"
};

const DATE_PATTERN =
  /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?(?:\s+\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/i;

const MONEY_PATTERN = /[-+]?\s*(?:[$€£₹]\s*)?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|[-+]?\s*(?:[$€£₹]\s*)?\(?\d+\.\d{2}\)?/g;

export const CONVERTER_COLUMNS = {
  bank: [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "money_in", label: "In" },
    { key: "money_out", label: "Out" },
    { key: "balance", label: "Balance" }
  ],
  receipt: [
    { key: "date", label: "Date" },
    { key: "vendor", label: "Vendor" },
    { key: "category", label: "Category" },
    { key: "total", label: "Total" },
    { key: "currency", label: "Currency" },
    { key: "subtotal", label: "Subtotal" },
    { key: "tax", label: "Tax" },
    { key: "payment_method", label: "Payment method" },
    { key: "notes", label: "Notes" }
  ],
  screenshot: [
    { key: "column_1", label: "Column 1" },
    { key: "column_2", label: "Column 2" },
    { key: "column_3", label: "Column 3" },
    { key: "column_4", label: "Column 4" },
    { key: "column_5", label: "Column 5" }
  ],
  invoice: [
    { key: "vendor", label: "Vendor" },
    { key: "invoice_number", label: "Invoice #" },
    { key: "invoice_date", label: "Invoice date" },
    { key: "due_date", label: "Due date" },
    { key: "total", label: "Total" },
    { key: "currency", label: "Currency" },
    { key: "subtotal", label: "Subtotal" },
    { key: "tax", label: "Tax" },
    { key: "payment_terms", label: "Payment terms" },
    { key: "notes", label: "Notes" }
  ],
  "audio-transcript": [
    { key: "transcript", label: "Transcript" },
    { key: "word_count", label: "Words" },
    { key: "format", label: "Format" }
  ],
  "document-markdown": [
    { key: "name", label: "File" },
    { key: "type", label: "Type" },
    { key: "tokens", label: "Tokens" },
    { key: "preview", label: "Preview" }
  ],
  "screenshot-code": [
    { key: "component", label: "Component" },
    { key: "source", label: "Source" },
    { key: "preview", label: "Preview" }
  ],
  "universal-file": UNIVERSAL_COLUMNS
};

export async function convertFileToCsv(env, converterId, fileName, contentType, arrayBuffer, options = {}) {
  const normalized = normalizeConverterId(converterId);
  if (normalized === "receipt") {
    return convertReceiptToCsv(env, fileName, contentType, arrayBuffer, options);
  }
  if (normalized === "screenshot") {
    return convertScreenshotTableToCsv(env, fileName, contentType, arrayBuffer, options);
  }
  if (normalized === "invoice") {
    return convertInvoiceToStructuredFile(env, fileName, contentType, arrayBuffer, options);
  }
  if (normalized === "audio-transcript") {
    return convertAudioToTranscript(env, fileName, contentType, arrayBuffer, options);
  }
  if (normalized === "document-markdown") {
    return convertDocumentToMarkdown(env, fileName, contentType, arrayBuffer, options);
  }
  if (normalized === "screenshot-code") {
    return convertScreenshotToHtml(env, fileName, contentType, arrayBuffer, options);
  }
  if (isUniversalConverter(normalized)) {
    return convertUniversalFile(env, fileName, contentType, arrayBuffer, options);
  }
  return convertPdfToCsv(env, fileName, arrayBuffer, options);
}

export async function convertPdfToCsv(env, fileName, arrayBuffer, options = {}) {
  const pageCount = await detectPdfPageCount(arrayBuffer).catch(() => 0);
  if (pageCount > MAX_PAGE_COUNT) {
    return {
      ok: false,
      message: `This PDF appears to have ${pageCount} pages. Split files above ${MAX_PAGE_COUNT} pages before uploading.`,
      confidence: 0,
      trustScore: 0,
      rowCount: 0,
      warnings: [],
      provider: "page-limit"
    };
  }

  const extracted = await extractWithBestProvider(env, fileName, arrayBuffer, options);

  if (!extracted.ok) {
    return {
      ok: false,
      message: extracted.message,
      confidence: extracted.confidence || 0,
      trustScore: extracted.trustScore || extracted.confidence || 0,
      rowCount: extracted.rowCount || 0,
      warnings: extracted.warnings || [],
      provider: extracted.provider || "none"
    };
  }

  const rows = normalizeRows(extracted.transactions);
  const outputFormat = normalizeBankOutputFormat(options.outputFormat || "csv");
  const exported = exportBankRows(rows, outputFormat, {
    accountingMetadata: options.accountingMetadata,
    sourceFileName: fileName,
    validation: {
      confidence: extracted.confidence,
      trustScore: extracted.trustScore || extracted.confidence,
      checks: extracted.validationChecks || {},
      warnings: extracted.warnings || [],
      provider: extracted.provider || "unknown"
    }
  });
  if (!exported.ok) {
    return {
      ok: false,
      message: exported.message,
      confidence: extracted.confidence,
      trustScore: extracted.trustScore || extracted.confidence,
      rowCount: rows.length,
      warnings: extracted.warnings || [],
      provider: extracted.provider || "unknown"
    };
  }
  return {
    ok: true,
    csv: exported.csv,
    content: exported.content,
    contentType: exported.contentType || bankOutputContentType(outputFormat),
    fileExtension: exported.fileExtension || bankOutputFileExtension(outputFormat),
    outputFormat,
    previewRows: exported.previewRows || rows.slice(0, 5),
    columns: exported.columns || CONVERTER_COLUMNS.bank,
    confidence: extracted.confidence,
    trustScore: extracted.trustScore || extracted.confidence,
    rowCount: rows.length,
    warnings: extracted.warnings || [],
    provider: extracted.provider || "unknown",
    validationReport: exported.validationReport
  };
}

async function convertReceiptToCsv(env, fileName, contentType, arrayBuffer, options = {}) {
  if (!hasMistralConfig(env)) {
    return failConversion("Receipt conversion needs OCR configuration before it can run.", "receipt-ocr");
  }

  const ocr = await runMistralOcr(env, contentType, arrayBuffer, options);
  const markdown = ocr.pages.join("\n");
  const pageRows = dedupeReceiptRows(ocr.pages.map((page) => parseReceipt(page)).filter((row) => row?.total));
  const joinedRow = parseReceipt(markdown);
  const rows = pageRows.length > 1
    ? pageRows
    : pageRows.length === 1 && joinedRow?.total
      ? [mergeReceiptRows(pageRows[0], joinedRow)]
      : joinedRow?.total
        ? [joinedRow]
        : [];

  if (!rows.length) {
    return failConversion("The receipt converter could not safely find a vendor and total.", "receipt-ocr");
  }

  const confidence = clamp(
    (ocr.confidence || 0.82) * average(rows.map(receiptStructureScore)) * (rows.length > 1 ? 0.97 : 1),
    0,
    0.98
  );
  if (confidence < 0.55) {
    return failConversion("The receipt trust score was too low for export.", "receipt-ocr", confidence, rows.length);
  }

  return {
    ok: true,
    csv: rowsToCsv(rows, CONVERTER_COLUMNS.receipt),
    previewRows: rows,
    columns: CONVERTER_COLUMNS.receipt,
    confidence,
    trustScore: confidence,
    rowCount: rows.length,
    warnings: ocr.warnings,
    provider: "mistral-ocr-receipt"
  };
}

async function convertScreenshotTableToCsv(env, fileName, contentType, arrayBuffer, options = {}) {
  if (!hasMistralConfig(env)) {
    return failConversion("Screenshot/table conversion needs OCR configuration before it can run.", "screenshot-ocr");
  }

  const ocr = await runMistralOcr(env, contentType, arrayBuffer, options);
  const parsed = parseMarkdownTable(ocr.pages.join("\n"));
  if (!parsed.rows.length) {
    return failConversion("The screenshot converter could not safely find a table.", "screenshot-ocr");
  }

  const confidence = clamp((ocr.confidence || 0.78) * tableStructureScore(parsed), 0, 0.97);
  if (confidence < 0.55) {
    return failConversion("The table trust score was too low for export.", "screenshot-ocr", confidence, parsed.rows.length);
  }

  return {
    ok: true,
    csv: rowsToCsv(parsed.rows, parsed.columns),
    previewRows: parsed.rows.slice(0, 5),
    columns: parsed.columns,
    confidence,
    trustScore: confidence,
    rowCount: parsed.rows.length,
    warnings: ocr.warnings,
    provider: "mistral-ocr-table"
  };
}

async function convertInvoiceToStructuredFile(env, fileName, contentType, arrayBuffer, options = {}) {
  if (!hasMistralConfig(env)) {
    return failConversion("Invoice conversion needs OCR configuration before it can run.", "invoice-ocr");
  }

  const ocr = await runMistralOcr(env, contentType, arrayBuffer, options);
  const markdown = ocr.pages.join("\n");
  const invoice = parseInvoice(markdown);
  if (!invoice || (!invoice.total && !invoice.invoice_number)) {
    return failConversion("The invoice converter could not safely find invoice fields.", "invoice-ocr");
  }

  const confidence = clamp((ocr.confidence || 0.82) * invoiceStructureScore(invoice), 0, 0.98);
  if (confidence < 0.56) {
    return failConversion("The invoice trust score was too low for export.", "invoice-ocr", confidence, 1);
  }

  const row = invoiceSummaryRow(invoice, confidence);
  const csv = rowsToCsv([row], CONVERTER_COLUMNS.invoice);
  const outputFormat = options.outputFormat === "json" ? "json" : "csv";
  const json = JSON.stringify(
    {
      invoice: row,
      line_items: invoice.line_items || [],
      warnings: ocr.warnings || [],
      confidence
    },
    null,
    2
  );

  return {
    ok: true,
    csv,
    content: outputFormat === "json" ? json : csv,
    contentType: outputFormat === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    fileExtension: outputFormat === "json" ? "json" : "csv",
    outputFormat,
    previewRows: [row],
    columns: CONVERTER_COLUMNS.invoice,
    confidence,
    trustScore: confidence,
    rowCount: 1,
    warnings: ocr.warnings,
    provider: "mistral-ocr-invoice"
  };
}

async function convertAudioToTranscript(env, fileName, contentType, arrayBuffer, options = {}) {
  if (!env?.AI?.run) {
    return failConversion("Audio transcription is not ready yet.", "workers-ai-whisper");
  }

  const model = env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL;
  const response = await env.AI.run(model, {
    audio: arrayBufferToBase64(arrayBuffer),
    task: "transcribe"
  });

  const transcript = String(response?.text || response?.transcription || response?.result?.text || "").trim();
  if (!transcript) {
    return failConversion("The audio converter could not safely transcribe this file.", "workers-ai-whisper");
  }

  const wordCount = Number(response?.word_count || countWords(transcript));
  const outputFormat = options.outputFormat === "json" ? "json" : "txt";
  const json = JSON.stringify(
    {
      transcript,
      word_count: wordCount,
      vtt: response?.vtt || "",
      words: Array.isArray(response?.words) ? response.words.slice(0, 2000) : []
    },
    null,
    2
  );
  const content = outputFormat === "json" ? json : `${transcript}\n`;
  const row = {
    transcript: transcript.replace(/\s+/g, " ").slice(0, 260),
    word_count: wordCount,
    format: outputFormat.toUpperCase()
  };

  return {
    ok: true,
    csv: rowsToCsv([row], CONVERTER_COLUMNS["audio-transcript"]),
    content,
    contentType: outputFormat === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    fileExtension: outputFormat,
    outputFormat,
    previewRows: [row],
    columns: CONVERTER_COLUMNS["audio-transcript"],
    confidence: 0.88,
    trustScore: 0.88,
    rowCount: wordCount,
    warnings: [],
    provider: "workers-ai-whisper"
  };
}

async function convertDocumentToMarkdown(env, fileName, contentType, arrayBuffer) {
  const markdown = await documentToMarkdown(env, fileName, contentType, arrayBuffer);
  if (!markdown.ok) return markdown;

  const row = {
    name: fileName,
    type: markdown.mimeType || contentType || "document",
    tokens: markdown.tokens || "",
    preview: markdown.content.replace(/\s+/g, " ").slice(0, 260)
  };

  return {
    ok: true,
    csv: rowsToCsv([row], CONVERTER_COLUMNS["document-markdown"]),
    content: `${markdown.content.trim()}\n`,
    contentType: "text/markdown; charset=utf-8",
    fileExtension: "md",
    outputFormat: "md",
    previewRows: [row],
    columns: CONVERTER_COLUMNS["document-markdown"],
    confidence: markdown.content.trim().length > 80 ? 0.9 : 0.68,
    trustScore: markdown.content.trim().length > 80 ? 0.9 : 0.68,
    rowCount: Math.max(1, countWords(markdown.content)),
    warnings: markdown.warnings,
    provider: "workers-ai-markdown"
  };
}

async function convertScreenshotToHtml(env, fileName, contentType, arrayBuffer, options = {}) {
  if (options.allowPaidFallback && env?.AI?.run && String(contentType || "").toLowerCase().startsWith("image/")) {
    return convertScreenshotToVisionHtml(env, fileName, contentType, arrayBuffer);
  }

  const markdown = await documentToMarkdown(env, fileName, contentType, arrayBuffer);
  if (!markdown.ok) return markdown;

  const html = htmlStarterFromMarkdown(markdown.content, fileName);
  const row = {
    component: "HTML starter",
    source: markdown.mimeType || contentType || "screenshot",
    preview: markdown.content.replace(/\s+/g, " ").slice(0, 260)
  };

  return {
    ok: true,
    csv: rowsToCsv([row], CONVERTER_COLUMNS["screenshot-code"]),
    content: html,
    contentType: "text/html; charset=utf-8",
    fileExtension: "html",
    outputFormat: "html",
    previewRows: [row],
    columns: CONVERTER_COLUMNS["screenshot-code"],
    confidence: markdown.content.trim().length > 80 ? 0.78 : 0.6,
    trustScore: markdown.content.trim().length > 80 ? 0.78 : 0.6,
    rowCount: 1,
    warnings: [
      "Preview HTML is a clean starter based on detected content and structure, not a pixel-perfect clone. Paid image exports use the vision route when configured.",
      ...(markdown.warnings || [])
    ],
    provider: "workers-ai-markdown-html"
  };
}

async function convertScreenshotToVisionHtml(env, fileName, contentType, arrayBuffer) {
  const model = env.SCREENSHOT_CODE_MODEL || DEFAULT_SCREENSHOT_CODE_MODEL;
  const prompt = [
    "Convert this UI screenshot into one complete, standalone HTML document.",
    "Return only HTML. Include <!doctype html>, <html>, <head>, responsive CSS, and <body>.",
    "Use semantic HTML, accessible labels where obvious, and CSS that approximates layout, spacing, colors, typography, and visible UI states.",
    "Do not use external images, scripts, CDNs, frameworks, or SVG placeholder art.",
    "If exact content is unreadable, use concise neutral placeholders instead of inventing specific private data."
  ].join(" ");

  const response = await env.AI.run(model, {
    prompt,
    image: [...new Uint8Array(arrayBuffer)],
    max_tokens: Number(env.SCREENSHOT_CODE_MAX_TOKENS || 4096),
    temperature: 0.15
  });
  const raw = String(response?.response || response?.text || response?.result?.response || response?.output || "").trim();
  const html = extractHtmlDocument(raw);
  if (!html) {
    return failConversion("The vision HTML generator could not safely produce a complete HTML file.", "workers-ai-vision-html");
  }

  const row = {
    component: "Vision HTML",
    source: contentType || "image",
    preview: `Standalone HTML generated from ${fileName || "uploaded screenshot"}.`
  };

  return {
    ok: true,
    csv: rowsToCsv([row], CONVERTER_COLUMNS["screenshot-code"]),
    content: html,
    contentType: "text/html; charset=utf-8",
    fileExtension: "html",
    outputFormat: "html",
    previewRows: [row],
    columns: CONVERTER_COLUMNS["screenshot-code"],
    confidence: 0.84,
    trustScore: 0.84,
    rowCount: 1,
    warnings: ["Generated HTML should be reviewed before reuse. It is not guaranteed pixel-perfect."],
    provider: "workers-ai-vision-html"
  };
}

function extractHtmlDocument(value) {
  const text = String(value || "").trim();
  const fenced = text.match(/```html\s*([\s\S]*?)```/i)?.[1] || text.match(/```\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.search(/<!doctype html>|<html[\s>]/i);
  if (start < 0) return "";
  const html = fenced.slice(start).trim();
  return /<html[\s>]/i.test(html) && /<\/html>/i.test(html) && /<body[\s>]/i.test(html) ? html : "";
}

async function convertUniversalFile(env, fileName, contentType, arrayBuffer, options = {}) {
  const cloudConvertReady = hasCloudConvertConfig(env);
  const convertioReady = hasConvertioConfig(env);
  if (!cloudConvertReady && !convertioReady) {
    return failConversion("This conversion option is not ready yet.", "provider");
  }

  const outputFormat = normalizeUniversalOutputFormat(options.outputFormat);
  const row = universalPreviewRow(fileName, contentType, outputFormat, "Preview ready");
  return {
    ok: true,
    csv: rowsToCsv([row], UNIVERSAL_COLUMNS),
    previewRows: [row],
    columns: UNIVERSAL_COLUMNS,
    confidence: 0.9,
    trustScore: 0.9,
    rowCount: 1,
    warnings: [
      "Preview confirms this file can be converted. The full file is generated after unlock."
    ],
    provider: cloudConvertReady ? "cloudconvert-preview" : "convertio-preview"
  };
}

async function documentToMarkdown(env, fileName, contentType, arrayBuffer) {
  if (!env?.AI?.toMarkdown) {
    return failConversion("Document Markdown conversion is not ready yet.", "workers-ai-markdown");
  }

  const result = await env.AI.toMarkdown({
    name: fileName || "document",
    blob: new Blob([arrayBuffer], {
      type: contentType || mimeTypeFromFileName(fileName)
    })
  });
  const converted = Array.isArray(result) ? result[0] : Array.isArray(result?.results) ? result.results[0] : result;
  if (!converted || converted.format === "error") {
    return failConversion(converted?.error || "The document converter could not safely convert this file to Markdown.", "workers-ai-markdown");
  }

  const content = String(converted.data || "").trim();
  if (content.length < 12) {
    return failConversion("The document converter found too little content to export.", "workers-ai-markdown");
  }

  return {
    ok: true,
    content,
    mimeType: converted.mimetype || contentType || "",
    tokens: converted.tokens || "",
    warnings: []
  };
}

function htmlStarterFromMarkdown(markdown, fileName) {
  const title = titleFromMarkdown(markdown) || "Converted screen";
  const lines = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
  const blocks = lines
    .map((line) => {
      if (/^#{1,3}\s+/.test(line)) return `<h2>${escapeHtml(line.replace(/^#{1,3}\s+/, ""))}</h2>`;
      if (/^[-*]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`;
      if (line.includes("|")) return `<p class="detected-table">${escapeHtml(line)}</p>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n        ");
  const listNormalized = blocks.replace(/(<li>[\s\S]*?<\/li>)(\n\s*<li>[\s\S]*?<\/li>)*/g, (match) => `<ul>${match}</ul>`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #f6f8f5; color: #111512; }
      main { width: min(920px, calc(100% - 32px)); margin: 40px auto; display: grid; gap: 18px; }
      section { background: #fff; border: 1px solid #dce4dc; border-radius: 8px; padding: 24px; box-shadow: 0 18px 48px rgba(28, 38, 30, 0.1); }
      h1 { margin: 0; font-size: clamp(34px, 6vw, 64px); line-height: 0.98; }
      h2 { margin: 24px 0 8px; font-size: 22px; }
      p, li { color: #465148; font-size: 16px; line-height: 1.55; }
      ul { margin: 10px 0 0; padding-left: 20px; }
      .detected-table { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-x: auto; white-space: pre; background: #f2f6f2; padding: 10px; border-radius: 8px; }
      .source { color: #68716a; font-size: 13px; font-weight: 760; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="source">Generated from ${escapeHtml(fileName || "uploaded screenshot")}</div>
        <h1>${escapeHtml(title)}</h1>
      </header>
      <section>
        ${listNormalized || "<p>No readable content was detected.</p>"}
      </section>
    </main>
  </body>
</html>
`;
}

function titleFromMarkdown(markdown) {
  const heading = String(markdown || "").match(/^#{1,2}\s+(.+)$/m)?.[1];
  if (heading) return cleanMarkdownText(heading).slice(0, 80);
  const first = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => cleanMarkdownText(line))
    .find((line) => line.length >= 4 && line.length <= 80);
  return first || "";
}

function mimeTypeFromFileName(fileName = "") {
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

function countWords(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function detectPdfPageCount(arrayBuffer) {
  let pdf;
  try {
    pdf = await getDocumentProxy(copyPdfBytes(arrayBuffer));
    return Number(pdf.numPages || 0);
  } finally {
    await pdf?.destroy?.();
  }
}

async function extractWithBestProvider(env, fileName, arrayBuffer, options) {
  const failures = [];
  const providers = providerOrder(env, options);

  for (const provider of providers) {
    try {
      const extracted = await provider.run(env, fileName, arrayBuffer, options);
      const validation = validateStatementRows(extracted.transactions || [], extracted.confidence || 0, {
        estimatedPages: options.estimatedPages,
        previewPages: options.previewPages,
        parsedPages: extracted.pagesParsed,
        totalPages: extracted.totalPages,
        provider: provider.id
      });
      if (validation.ok) {
        return {
          ok: true,
          ...extracted,
          confidence: validation.confidence,
          trustScore: validation.trustScore,
          rowCount: validation.rowCount,
          validationChecks: validation.checks,
          warnings: [
            ...(extracted.warnings || []),
            ...(validation.warnings || []),
            ...failures.map((failure) => failure.warning)
          ].filter(Boolean)
        };
      }
      failures.push({
        provider: provider.id,
        warning: `${provider.label}: ${[validation.message, ...(validation.warnings || [])].filter(Boolean).join(" ")}`,
        confidence: validation.confidence,
        rowCount: validation.rowCount,
        message: validation.message
      });
    } catch (error) {
      failures.push({
        provider: provider.id,
        warning: `${provider.label}: ${error?.message || "failed"}`,
        confidence: 0,
        rowCount: 0,
        message: error?.message || "Extraction failed."
      });
    }
  }

  const best = failures
    .slice()
    .sort((a, b) => b.rowCount - a.rowCount || b.confidence - a.confidence)[0];

  return {
    ok: false,
    provider: best?.provider || "none",
    confidence: best?.confidence || 0,
    trustScore: best?.confidence || 0,
    rowCount: best?.rowCount || 0,
    message:
      best?.message ||
      "The converter could not safely extract this file. No charge was made.",
    warnings: failures.map((failure) => failure.warning)
  };
}

function providerOrder(env, options = {}) {
  const cloudflareFallback = env.ALLOW_CLOUDFLARE_FALLBACK === "true" && env.AI;
  const paidFallbackAllowed = options.allowPaidFallback || env.ENABLE_AZURE_FALLBACK === "true";
  const providers = [];

  if (options.forceProvider === "mistral") {
    if (hasMistralConfig(env)) providers.push({ id: "mistral-ocr", label: "OCR fallback", run: extractWithMistralOcr });
    if (paidFallbackAllowed && hasAzureConfig(env)) providers.push({ id: "azure", label: "Paid fallback", run: extractWithAzure });
    if (cloudflareFallback) providers.push({ id: "cloudflare-ai", label: "AI fallback", run: extractWithCloudflareAi });
    return providers;
  }

  providers.push({ id: "native-pdf", label: "Built-in PDF parser", run: extractWithNativePdf });
  if (hasMistralConfig(env)) providers.push({ id: "mistral-ocr", label: "OCR fallback", run: extractWithMistralOcr });
  if (paidFallbackAllowed && hasAzureConfig(env)) providers.push({ id: "azure", label: "Paid fallback", run: extractWithAzure });
  if (cloudflareFallback) providers.push({ id: "cloudflare-ai", label: "AI fallback", run: extractWithCloudflareAi });
  return providers;
}

async function extractWithNativePdf(env, fileName, arrayBuffer, options = {}) {
  const { pages, totalPages } = await readPdfTextPages(arrayBuffer);
  if (totalPages > MAX_PAGE_COUNT) {
    throw new Error(`This PDF appears to have ${totalPages} pages. Split files above ${MAX_PAGE_COUNT} pages before uploading.`);
  }
  const selectedPages = pages.slice(0, options.previewPages || pages.length);
  const textLength = selectedPages.join("\n").replace(/\s+/g, "").length;
  if (textLength < 80) {
    throw new Error("The PDF has too little selectable text.");
  }

  const transactions = parseTransactionsFromPages(selectedPages);
  const confidence = scoreParserConfidence(transactions, selectedPages, totalPages);
  return {
    provider: "native-pdf",
    confidence,
    pagesParsed: selectedPages.length,
    totalPages,
    warnings: totalPages > selectedPages.length ? [`Parsed ${selectedPages.length} of ${totalPages} pages for preview.`] : [],
    transactions
  };
}

async function readPdfTextPages(arrayBuffer) {
  let pdf;
  try {
    pdf = await getDocumentProxy(copyPdfBytes(arrayBuffer));
    const result = await extractText(pdf, { mergePages: false });
    return {
      totalPages: result.totalPages || pdf.numPages || 0,
      pages: Array.isArray(result.text) ? result.text : [String(result.text || "")]
    };
  } finally {
    await pdf?.destroy?.();
  }
}

function copyPdfBytes(arrayBuffer) {
  return new Uint8Array(arrayBuffer.slice(0));
}

async function extractWithMistralOcr(env, fileName, arrayBuffer, options = {}) {
  const ocr = await runMistralOcr(env, "application/pdf", arrayBuffer, options);
  const transactions = parseTransactionsFromPages(ocr.pages);

  return {
    provider: "mistral-ocr",
    confidence: ocr.confidence || scoreParserConfidence(transactions, ocr.pages, ocr.pages.length),
    pagesParsed: ocr.pages.length,
    totalPages: ocr.pages.length,
    warnings: transactions.length ? [] : ["OCR returned text but no transaction rows matched the parser."],
    transactions
  };
}

async function runMistralOcr(env, contentType, arrayBuffer, options = {}) {
  const configuredPreviewLimit = Number(env.MISTRAL_PREVIEW_PAGE_LIMIT || env.OCR_PREVIEW_PAGE_LIMIT || 1);
  const previewPageLimit = Math.max(
    1,
    Math.min(
      Number(options.previewPages || 1),
      Number.isFinite(configuredPreviewLimit) ? configuredPreviewLimit : 1
    )
  );
  const mimeType = String(contentType || "application/pdf").toLowerCase();
  const isImage = mimeType.startsWith("image/");
  const documentType = isImage ? "image_url" : "document_url";
  const body = {
    model: env.MISTRAL_OCR_MODEL || DEFAULT_MISTRAL_MODEL,
    document: {
      type: documentType,
      [documentType]: `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`
    },
    table_format: "markdown",
    include_image_base64: false,
    confidence_scores_granularity: "page"
  };

  if (options.previewPages && !isImage) {
    body.pages = Array.from({ length: previewPageLimit }, (_, index) => index);
  }

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `OCR failed (${response.status}).`);
  }

  const pages = (payload.pages || []).map((page) => ocrPageText(page));
  const pageScores = (payload.pages || [])
    .map((page) => Number(page.confidence_scores?.average_page_confidence_score))
    .filter(Number.isFinite);

  return {
    pages,
    confidence: average(pageScores) || 0.82,
    warnings: pages.length ? [] : ["OCR returned no readable text."]
  };
}

function ocrPageText(page) {
  const chunks = [String(page?.markdown || "")];
  const tables = Array.isArray(page?.tables) ? page.tables : [];
  for (const table of tables) {
    if (typeof table === "string") {
      chunks.push(table);
    } else if (table?.markdown) {
      chunks.push(String(table.markdown));
    } else if (table?.html) {
      chunks.push(String(table.html));
    } else if (table?.content) {
      chunks.push(String(table.content));
    }
  }
  return chunks.filter(Boolean).join("\n");
}

function parseReceipt(markdown) {
  const text = String(markdown || "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => cleanMarkdownText(line))
    .filter(Boolean)
    .filter((line) => !/^(#+|\|?\s*-{2,}|date\s+description)/i.test(line));

  const year = inferStatementYear(text);
  const dateMatch = text.match(DATE_PATTERN);
  const date = dateMatch ? parseDateToken(dateMatch[0], year) : "";
  const vendor = inferReceiptVendor(lines);
  const totalLine = inferReceiptTotalLine(lines);
  const subtotalLine = inferReceiptSubtotalLine(lines);
  const taxLine = inferReceiptTaxLine(lines);
  const totalToken = totalLine ? lastMoneyToken(totalLine) : largestMoneyToken(text);
  if (!vendor || !totalToken) return null;
  const subtotalToken = subtotalLine ? lastMoneyToken(subtotalLine) : null;
  const taxToken = taxLine ? lastMoneyToken(taxLine) : null;
  const notes = inferReceiptNotes(lines, totalLine);

  return {
    date,
    vendor,
    category: inferExpenseCategory({ vendor, notes, lines }),
    total: Math.abs(totalToken.value),
    currency: currencyFromText(totalToken.raw),
    subtotal: subtotalToken ? Math.abs(subtotalToken.value) : "",
    tax: taxToken ? Math.abs(taxToken.value) : "",
    payment_method: inferPaymentMethod(lines),
    notes,
    confidence: receiptRowConfidence({ date, vendor, total: totalToken.value })
  };
}

function inferReceiptVendor(lines) {
  const ignored = /^(receipt|invoice|tax invoice|sale|transaction|merchant copy|customer copy|date|time|subtotal|sub total|total|amount|balance|qty|item|description|order|table|server|cashier|terminal|approval|auth|card|visa|mastercard|amex)\b/i;
  return (
    lines.find((line) => line.length >= 3 && line.length <= 80 && !ignored.test(line) && !extractMoneyTokens(line).length) ||
    lines.find((line) => line.length >= 3 && line.length <= 80 && !ignored.test(line)) ||
    ""
  ).replace(/[*_`#|]+/g, "").trim();
}

function inferReceiptTotalLine(lines) {
  const strongTotalLines = lines.filter(
    (line) =>
      /\b(?:grand\s+total|amount\s+paid|amount\s+due|balance\s+due|total\s+due|card\s+total|sale\s+total)\b/i.test(line) &&
      !/\b(?:subtotal|sub\s+total|tax|tip|change|cash\s+tendered)\b/i.test(line) &&
      extractMoneyTokens(line).length
  );
  if (strongTotalLines.length) return strongTotalLines[strongTotalLines.length - 1];

  const totalLines = lines.filter(
    (line) =>
      /\btotal\b/i.test(line) &&
      !/\b(?:subtotal|sub\s+total|tax|tip|change|cash\s+tendered)\b/i.test(line) &&
      extractMoneyTokens(line).length
  );
  return totalLines[totalLines.length - 1] || "";
}

function inferReceiptSubtotalLine(lines) {
  const subtotalLines = lines.filter((line) => /\b(?:subtotal|sub\s+total)\b/i.test(line) && extractMoneyTokens(line).length);
  return subtotalLines[subtotalLines.length - 1] || "";
}

function inferReceiptTaxLine(lines) {
  const taxLines = lines.filter((line) => /\b(?:tax|vat|gst|hst|pst|sales\s+tax)\b/i.test(line) && extractMoneyTokens(line).length);
  return taxLines[taxLines.length - 1] || "";
}

function inferPaymentMethod(lines) {
  const joined = lines.join(" ");
  if (/\b(?:visa|mastercard|amex|american express|discover|card|credit|debit)\b/i.test(joined)) return "card";
  if (/\b(?:cash)\b/i.test(joined)) return "cash";
  if (/\b(?:paypal|stripe|apple pay|google pay|upi)\b/i.test(joined)) return "digital";
  if (/\b(?:bank transfer|wire|ach)\b/i.test(joined)) return "bank transfer";
  return "";
}

function inferExpenseCategory({ vendor, notes, lines }) {
  const text = `${vendor} ${notes} ${lines.join(" ")}`.toLowerCase();
  const categories = [
    ["Meals", /\b(coffee|cafe|restaurant|kitchen|bar|grill|pizza|burger|food|meal|latte|bagel|uber eats|doordash|swiggy|zomato)\b/],
    ["Travel", /\b(hotel|airline|flight|uber|lyft|taxi|parking|fuel|gas station|train|metro|booking\.com|airbnb)\b/],
    ["Software", /\b(software|saas|cloud|hosting|domain|api|openai|mistral|azure|aws|google cloud|github|notion|slack|figma)\b/],
    ["Office", /\b(office|stationery|supplies|printer|paper|staples|desk|chair)\b/],
    ["Marketing", /\b(adwords|google ads|meta ads|facebook ads|linkedin ads|marketing|campaign)\b/],
    ["Utilities", /\b(electric|utility|internet|broadband|mobile|phone|water|power)\b/]
  ];
  return categories.find(([, pattern]) => pattern.test(text))?.[0] || "Other";
}

function inferReceiptNotes(lines, totalLine) {
  const itemLines = lines.filter((line) => {
    if (line === totalLine) return false;
    if (/\b(?:subtotal|tax|change|cash|card|visa|mastercard|total)\b/i.test(line)) return false;
    return extractMoneyTokens(line).length && /[a-z]/i.test(line);
  });
  return itemLines.slice(0, 3).map((line) => line.replace(/\s+/g, " ")).join("; ");
}

function receiptStructureScore(row) {
  let score = 0.62;
  if (row.date) score += 0.1;
  if (row.vendor?.length >= 3) score += 0.12;
  if (Number(row.total) > 0) score += 0.14;
  if (row.category && row.category !== "Other") score += 0.04;
  if (row.tax !== "") score += 0.03;
  if (row.payment_method) score += 0.02;
  return clamp(score, 0, 1);
}

function receiptRowConfidence(row) {
  return receiptStructureScore(row);
}

function mergeReceiptRows(primary, fallback) {
  return {
    ...fallback,
    ...primary,
    notes: primary.notes || fallback.notes || "",
    subtotal: primary.subtotal || fallback.subtotal || "",
    tax: primary.tax || fallback.tax || "",
    payment_method: primary.payment_method || fallback.payment_method || "",
    category: primary.category === "Other" ? fallback.category || primary.category : primary.category
  };
}

function dedupeReceiptRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [normalizeDate(row.date), normalizeKey(row.vendor), row.total].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseInvoice(markdown) {
  const text = String(markdown || "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => cleanMarkdownText(line))
    .filter(Boolean)
    .filter((line) => !/^(#+|\|?\s*-{2,})/i.test(line));

  const year = inferStatementYear(text);
  const invoiceDate = inferDateNearLabel(lines, /\b(?:invoice\s+date|date\s+issued|issued\s+on|bill\s+date)\b/i, year) ||
    inferFirstUsefulDate(lines, year);
  const dueDate = inferDateNearLabel(lines, /\b(?:due\s+date|payment\s+due|pay\s+by)\b/i, year);
  const vendor = inferInvoiceVendor(lines);
  const invoiceNumber = inferInvoiceNumber(lines);
  const totalLine = inferInvoiceTotalLine(lines);
  const subtotalLine = inferInvoiceSubtotalLine(lines);
  const taxLine = inferReceiptTaxLine(lines);
  const totalToken = totalLine ? lastMoneyToken(totalLine) : largestMoneyToken(text);
  const subtotalToken = subtotalLine ? lastMoneyToken(subtotalLine) : null;
  const taxToken = taxLine ? lastMoneyToken(taxLine) : null;
  const paymentTerms = inferPaymentTerms(lines);
  const lineItems = inferInvoiceLineItems(lines, totalLine);

  if (!vendor && !invoiceNumber && !totalToken) return null;

  return {
    vendor,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    total: totalToken ? Math.abs(totalToken.value) : "",
    currency: currencyFromText(totalToken?.raw || subtotalToken?.raw || taxToken?.raw || text),
    subtotal: subtotalToken ? Math.abs(subtotalToken.value) : "",
    tax: taxToken ? Math.abs(taxToken.value) : "",
    payment_terms: paymentTerms,
    notes: inferInvoiceNotes(lines),
    line_items: lineItems
  };
}

function inferInvoiceVendor(lines) {
  const ignored = /^(invoice|tax invoice|bill|statement|receipt|date|due date|invoice date|invoice number|invoice no|bill to|ship to|sold to|from|to|subtotal|total|amount due|balance due|payment|terms|description|qty|quantity|unit|price|amount)\b/i;
  return (
    lines.find((line) => line.length >= 3 && line.length <= 90 && !ignored.test(line) && !extractMoneyTokens(line).length && /[a-z]{2,}/i.test(line)) ||
    lines.find((line) => line.length >= 3 && line.length <= 90 && !ignored.test(line) && /[a-z]{2,}/i.test(line)) ||
    ""
  ).replace(/[*_`#|]+/g, "").trim();
}

function inferInvoiceNumber(lines) {
  const patterns = [
    /\b(?:invoice|inv|bill)\s*(?:number|no|#|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})\b/i,
    /\b(?:number|no)\s*[:#-]\s*([A-Z0-9][A-Z0-9._/-]{2,})\b/i
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1] && !/^(date|total|amount|due)$/i.test(match[1])) return match[1].replace(/[.,;]+$/, "");
    }
  }
  return "";
}

function inferDateNearLabel(lines, labelPattern, year) {
  for (const line of lines) {
    if (!labelPattern.test(line)) continue;
    const dateMatch = line.match(DATE_PATTERN);
    if (dateMatch) return parseDateToken(dateMatch[0], year);
  }
  return "";
}

function inferFirstUsefulDate(lines, year) {
  const line = lines.find((value) => !/\b(?:due|pay\s+by|paid)\b/i.test(value) && value.match(DATE_PATTERN));
  const dateMatch = line?.match(DATE_PATTERN);
  return dateMatch ? parseDateToken(dateMatch[0], year) : "";
}

function inferInvoiceTotalLine(lines) {
  const strongTotalLines = lines.filter(
    (line) =>
      /\b(?:amount\s+due|balance\s+due|total\s+due|invoice\s+total|grand\s+total|amount\s+paid)\b/i.test(line) &&
      !/\b(?:subtotal|sub\s+total|tax|vat|gst|discount|previous|paid)\b/i.test(line) &&
      extractMoneyTokens(line).length
  );
  if (strongTotalLines.length) return strongTotalLines[strongTotalLines.length - 1];

  const totalLines = lines.filter(
    (line) =>
      /\btotal\b/i.test(line) &&
      !/\b(?:subtotal|sub\s+total|tax|vat|gst|discount|previous|paid)\b/i.test(line) &&
      extractMoneyTokens(line).length
  );
  return totalLines[totalLines.length - 1] || "";
}

function inferInvoiceSubtotalLine(lines) {
  const subtotalLines = lines.filter((line) => /\b(?:subtotal|sub\s+total)\b/i.test(line) && extractMoneyTokens(line).length);
  return subtotalLines[subtotalLines.length - 1] || "";
}

function inferPaymentTerms(lines) {
  const termsLine = lines.find((line) => /\b(?:net\s+\d+|due\s+on\s+receipt|payment\s+terms|terms\s*:|due\s+within\s+\d+)\b/i.test(line));
  if (!termsLine) return "";
  const net = termsLine.match(/\bnet\s+\d+\b/i)?.[0];
  if (net) return net.replace(/\s+/, " ");
  const dueReceipt = termsLine.match(/\bdue\s+on\s+receipt\b/i)?.[0];
  if (dueReceipt) return "Due on receipt";
  return termsLine.replace(/^payment\s+terms\s*[:#-]?\s*/i, "").slice(0, 80).trim();
}

function inferInvoiceLineItems(lines, totalLine) {
  return lines
    .filter((line) => {
      if (line === totalLine) return false;
      if (!extractMoneyTokens(line).length || !/[a-z]{2,}/i.test(line)) return false;
      if (/\b(?:subtotal|sub\s+total|tax|vat|gst|total|amount\s+due|balance\s+due|paid|payment)\b/i.test(line)) return false;
      return true;
    })
    .slice(0, 12)
    .map((line) => {
      const money = lastMoneyToken(line);
      const description = line.slice(0, money?.index || line.length).replace(/\s+/g, " ").trim();
      return {
        description,
        amount: money ? Math.abs(money.value) : "",
        currency: money ? currencyFromText(money.raw) : ""
      };
    })
    .filter((item) => item.description && item.amount);
}

function inferInvoiceNotes(lines) {
  const references = lines
    .filter((line) => /\b(?:po\s*(?:number|#)?|purchase\s+order|reference|memo|project|account)\b/i.test(line))
    .slice(0, 3);
  return references.join("; ");
}

function invoiceSummaryRow(invoice, confidence) {
  return {
    vendor: invoice.vendor || "",
    invoice_number: invoice.invoice_number || "",
    invoice_date: invoice.invoice_date || "",
    due_date: invoice.due_date || "",
    total: invoice.total || "",
    currency: invoice.currency || "",
    subtotal: invoice.subtotal || "",
    tax: invoice.tax || "",
    payment_terms: invoice.payment_terms || "",
    notes: invoice.notes || "",
    confidence
  };
}

function invoiceStructureScore(invoice) {
  let score = 0.48;
  if (invoice.vendor) score += 0.12;
  if (invoice.invoice_number) score += 0.1;
  if (invoice.invoice_date || invoice.due_date) score += 0.08;
  if (Number(invoice.total) > 0) score += 0.16;
  if (invoice.tax !== "" || invoice.subtotal !== "") score += 0.04;
  if (invoice.payment_terms) score += 0.03;
  if (invoice.line_items?.length) score += 0.05;
  return clamp(score, 0, 1);
}

function parseMarkdownTable(markdown) {
  const htmlTable = parseHtmlTable(markdown);
  if (htmlTable.rows.length) return htmlTable;

  const lines = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tableLines = lines.filter((line) => line.includes("|") && splitTableCells(line).length >= 2);
  const separatorIndex = tableLines.findIndex((line) => splitTableCells(line).every((cell) => /^:?-{2,}:?$/.test(cell)));
  if (tableLines.length >= 2) {
    const headerLine = separatorIndex > 0 ? tableLines[separatorIndex - 1] : tableLines[0];
    const dataLines = (separatorIndex >= 0 ? tableLines.slice(separatorIndex + 1) : tableLines.slice(1)).filter(
      (line) => !splitTableCells(line).every((cell) => /^:?-{2,}:?$/.test(cell))
    );
    const headerCells = splitTableCells(headerLine).slice(0, 8);
    const columns = headerCells.map((header, index) => ({
      key: `column_${index + 1}`,
      label: normalizeColumnLabel(header, index)
    }));
    const rows = dataLines
      .map((line) => rowFromCells(splitTableCells(line), columns))
      .filter(isUsefulTableRow);
    if (rows.length) return { columns, rows, fromMarkdownTable: true };
  }

  const fallbackLines = lines.flatMap((line) => {
    const datedSegments = splitLineOnDates(line).map((segment) => segment.trim()).filter(Boolean);
    return datedSegments.length > 1 ? datedSegments : [line];
  });
  const looseRows = fallbackLines
    .map((line) => parseLooseTableCells(line))
    .filter((cells) => cells.length >= 2);
  const width = Math.min(8, Math.max(0, ...looseRows.map((cells) => cells.length)));
  const columns = inferLooseColumns(looseRows, width);
  const rows = looseRows.map((cells) => rowFromCells(cells, columns));
  return { columns, rows, fromMarkdownTable: false };
}

function parseHtmlTable(markdown) {
  const tableMatches = [...String(markdown || "").matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const match of tableMatches) {
    const tableHtml = match[0];
    const rowMatches = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    const rawRows = rowMatches
      .map((rowMatch) => {
        const rowHtml = rowMatch[0];
        const cellMatches = [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)];
        return cellMatches.map((cellMatch) => cleanMarkdownText(cellMatch[1]));
      })
      .filter((cells) => cells.some(Boolean));
    if (rawRows.length < 2) continue;

    const headerCells = rawRows[0].slice(0, 8);
    const columns = headerCells.map((header, index) => ({
      key: `column_${index + 1}`,
      label: normalizeColumnLabel(header, index)
    }));
    const rows = rawRows
      .slice(1)
      .map((cells) => rowFromCells(cells, columns))
      .filter(isUsefulTableRow);
    if (rows.length) return { columns, rows, fromMarkdownTable: true };
  }

  return { columns: [], rows: [], fromMarkdownTable: false };
}

function parseLooseTableCells(line) {
  const multiSpaceCells = String(line || "")
    .split(/\s{2,}|\t|,/)
    .map((cell) => cleanMarkdownText(cell))
    .filter(Boolean);
  if (multiSpaceCells.length >= 2) return multiSpaceCells;

  const text = cleanMarkdownText(line);
  if (isMetadataLikeLine(text)) return [];
  if (/^date\s+.*(?:amount|total|price|balance)/i.test(text)) return [];

  const dateMatch = text.match(DATE_PATTERN);
  const moneyTokens = extractMoneyTokens(text);
  if (dateMatch && moneyTokens.length) {
    const year = inferStatementYear(text);
    const date = parseDateToken(dateMatch[0], year) || dateMatch[0];
    const firstMoney = moneyTokens[0];
    const moneyCells = moneyTokens.length >= 2 ? moneyTokens.slice(-2) : moneyTokens.slice(-1);
    const description = text
      .slice((dateMatch.index || 0) + dateMatch[0].length, firstMoney.index)
      .replace(/\s+/g, " ")
      .trim();
    if (!/[a-z]{2,}/i.test(description)) return [];
    return [date, description, ...moneyCells.map((token) => token.raw.trim())].filter(Boolean);
  }

  const money = lastMoneyToken(text);
  if (money && /[a-z]/i.test(text)) {
    const beforeMoney = text.slice(0, money.index).replace(/\s+/g, " ").trim();
    if (beforeMoney) return [beforeMoney, money.raw.trim()];
  }

  return [];
}

function isUsefulTableRow(row) {
  const values = Object.values(row).map((value) => String(value || "").trim()).filter(Boolean);
  if (!values.length) return false;
  return !isMetadataLikeLine(values.join(" "));
}

function isMetadataLikeLine(text) {
  return /^\s*(?:smoke|generated|created|printed|exported|page\s+\d+)\b/i.test(text) ||
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);
}

function inferLooseColumns(rows, width) {
  const defaultColumns = Array.from({ length: width }, (_, index) => ({
    key: `column_${index + 1}`,
    label: `Column ${index + 1}`
  }));
  if (!rows.length || width < 2) return defaultColumns;

  const dateCoverage = ratio(rows, (cells) => Boolean(String(cells[0] || "").match(DATE_PATTERN)));
  const lastMoneyCoverage = ratio(rows, (cells) => extractMoneyTokens(cells[cells.length - 1] || "").length > 0);
  const penultimateMoneyCoverage = ratio(rows, (cells) => extractMoneyTokens(cells[cells.length - 2] || "").length > 0);

  if (dateCoverage >= 0.6 && lastMoneyCoverage >= 0.6) {
    if (width >= 4 && penultimateMoneyCoverage >= 0.45) {
      return [
        { key: "column_1", label: "Date" },
        { key: "column_2", label: "Description" },
        { key: "column_3", label: "Amount" },
        { key: "column_4", label: "Balance" },
        ...defaultColumns.slice(4)
      ];
    }
    return [
      { key: "column_1", label: "Date" },
      { key: "column_2", label: "Description" },
      { key: "column_3", label: "Amount" },
      ...defaultColumns.slice(3)
    ].slice(0, width);
  }

  return defaultColumns;
}

function normalizeColumnLabel(value, index) {
  const label = cleanMarkdownText(value)
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/\b(?:undefined|null|nan)\b/gi, "")
    .slice(0, 42)
    .trim();
  return label || `Column ${index + 1}`;
}

function tableStructureScore(parsed) {
  let score = parsed.fromMarkdownTable ? 0.82 : 0.68;
  const rows = parsed.rows || [];
  const columns = parsed.columns || [];
  if (rows.length >= 2) score += 0.08;
  if (rows.length >= 5) score += 0.03;
  if (columns.length >= 3) score += 0.04;

  const rowValues = rows.map((row) => Object.values(row).join(" "));
  const dateCoverage = ratio(rowValues, (value) => Boolean(String(value).match(DATE_PATTERN)));
  const moneyCoverage = ratio(rowValues, (value) => extractMoneyTokens(value).length > 0);
  if (dateCoverage >= 0.5) score += 0.04;
  if (moneyCoverage >= 0.5) score += 0.04;

  return clamp(score, 0.55, 1);
}

function splitTableCells(line) {
  return String(line || "")
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanMarkdownText(cell));
}

function rowFromCells(cells, columns) {
  return columns.reduce((row, column, index) => {
    row[column.key] = cells[index] || "";
    return row;
  }, {});
}

function cleanMarkdownText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lastMoneyToken(text) {
  const tokens = extractMoneyTokens(text);
  return tokens[tokens.length - 1] || null;
}

function largestMoneyToken(text) {
  return extractMoneyTokens(text)
    .filter((token) => Math.abs(Number(token.value)) > 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null;
}

function currencyFromText(value) {
  const text = String(value || "");
  if (text.includes("₹")) return "INR";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  return "USD";
}

function failConversion(message, provider, confidence = 0, rowCount = 0) {
  return {
    ok: false,
    message,
    confidence,
    trustScore: confidence,
    rowCount,
    warnings: [],
    provider
  };
}

async function extractWithAzure(env, fileName, arrayBuffer, options = {}) {
  const endpoint = String(env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || "").replace(/\/+$/, "");
  const model = env.AZURE_DOCUMENT_INTELLIGENCE_MODEL || DEFAULT_AZURE_MODEL;
  const apiVersion = env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || DEFAULT_AZURE_API_VERSION;
  const url = new URL(`${endpoint}/documentintelligence/documentModels/${model}:analyze`);
  url.searchParams.set("api-version", apiVersion);
  url.searchParams.set("_overload", "analyzeDocument");
  if (options.previewPages) url.searchParams.set("pages", `1-${Math.max(1, Number(options.previewPages) || 1)}`);

  const start = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Ocp-Apim-Subscription-Key": env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    },
    body: arrayBuffer
  });

  if (!start.ok) {
    throw new Error(`Fallback extraction failed to start (${start.status}).`);
  }

  const operationUrl = start.headers.get("operation-location");
  if (!operationUrl) throw new Error("Fallback extraction did not return an operation URL.");

  const result = await pollAzure(env, operationUrl);
  const transactions = extractAzureRows(result.analyzeResult || result);
  const confidence = average(transactions.map((row) => Number(row.confidence || 0.82))) || 0.82;

  return {
    provider: "azure",
    confidence,
    pagesParsed: result.analyzeResult?.pages?.length || result.pages?.length || 0,
    totalPages: result.analyzeResult?.pages?.length || result.pages?.length || 0,
    warnings: transactions.length ? [] : ["Fallback parser did not return transaction rows."],
    transactions
  };
}

async function pollAzure(env, operationUrl) {
  let last;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (attempt > 0) await sleep(Math.min(900 + attempt * 250, 2600));
    const response = await fetch(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": env.AZURE_DOCUMENT_INTELLIGENCE_KEY }
    });
    if (!response.ok) throw new Error(`Fallback extraction status failed (${response.status}).`);
    last = await response.json();
    if (last.status === "succeeded") return last;
    if (last.status === "failed") throw new Error(last.error?.message || "Fallback extraction failed.");
  }
  throw new Error("The bank statement extractor timed out. Try a smaller file.");
}

function parseTransactionsFromPages(pages) {
  const rows = [];
  pages.forEach((pageText, index) => {
    const year = inferStatementYear(pageText);
    for (const line of candidateLines(pageText)) {
      const row = parseTransactionLine(line, index + 1, year);
      if (row) rows.push(row);
    }
  });
  return dedupeRows(inferDirections(rows));
}

function candidateLines(text) {
  const lines = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const candidates = [];
  for (const line of lines) {
    const parts = splitLineOnDates(line);
    candidates.push(...parts);
  }

  if (candidates.length >= 3) return candidates;

  return splitLineOnDates(String(text || "").replace(/\s+/g, " ").trim());
}

function splitLineOnDates(line) {
  const dateMatches = [...line.matchAll(new RegExp(DATE_PATTERN, "gi"))];
  if (dateMatches.length <= 1) return [line];
  return dateMatches.map((match, index) => {
    const start = match.index || 0;
    const end = dateMatches[index + 1]?.index || line.length;
    return line.slice(start, end).trim();
  });
}

function parseTransactionLine(line, page, defaultYear) {
  if (line.length < 8 || isNonTransactionLine(line)) return null;
  const dateMatch = line.match(DATE_PATTERN);
  if (!dateMatch) return null;

  const date = parseDateToken(dateMatch[0], defaultYear);
  if (!date) return null;

  const body = `${line.slice(0, dateMatch.index || 0)} ${line.slice((dateMatch.index || 0) + dateMatch[0].length)}`.trim();
  const moneyTokens = extractMoneyTokens(body);
  if (!moneyTokens.length) return null;

  const balanceToken = moneyTokens.length >= 2 ? moneyTokens[moneyTokens.length - 1] : null;
  const amountToken = moneyTokens.length >= 2 ? moneyTokens[moneyTokens.length - 2] : moneyTokens[0];
  const firstMoneyIndex = moneyTokens[0].index;
  const description = body.slice(0, firstMoneyIndex).replace(/[|•·]+/g, " ").replace(/\s+/g, " ").trim();
  if (description.length < 2) return null;

  const amount = amountToken.value;
  const balance = balanceToken ? balanceToken.value : "";
  const direction = directionFromText(description, amount);

  return {
    date,
    description,
    money_in: direction === "in" ? Math.abs(amount) : "",
    money_out: direction === "out" ? Math.abs(amount) : "",
    balance,
    page,
    confidence: rowConfidence({ date, description, amount, balance }),
    _amount: amount
  };
}

function isNonTransactionLine(line) {
  return /(?:opening|closing|available|current)\s+balance/i.test(line) ||
    /statement\s+(?:period|date)|account\s+(?:number|summary)|page\s+\d+\s+of/i.test(line) ||
    /date\s+.*(?:description|details).*(?:amount|debit|credit|balance)/i.test(line);
}

function extractMoneyTokens(text) {
  const tokens = [];
  for (const match of text.matchAll(MONEY_PATTERN)) {
    const raw = match[0];
    const value = normalizeNumber(raw);
    if (hasNumber(value)) {
      tokens.push({ raw, value: Number(value), index: match.index || 0 });
    }
  }
  return tokens;
}

function directionFromText(description, amount) {
  if (Number(amount) < 0) return "out";
  if (/\b(?:deposit|credit|payroll|salary|interest|refund|reversal|received|incoming|payout|ach credit|zelle from)\b/i.test(description) ||
    /\b(?:client|customer)\s+ach\b/i.test(description)) {
    return "in";
  }
  if (/\b(?:withdrawal|debit|payment|purchase|fee|charge|transfer to|atm|pos|check|cheque|card|ach debit|bill pay)\b/i.test(description)) {
    return "out";
  }
  return "out";
}

function inferDirections(rows) {
  const normalized = rows.map((row) => ({ ...row }));
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const row = normalized[index];
    if (!hasNumber(previous.balance) || !hasNumber(row.balance) || !hasNumber(row._amount)) continue;
    const delta = roundMoney(Number(row.balance) - Number(previous.balance));
    const amount = Math.abs(Number(row._amount));
    if (Math.abs(Math.abs(delta) - amount) > 0.03) continue;
    row.money_in = delta > 0 ? amount : "";
    row.money_out = delta < 0 ? amount : "";
    row.confidence = Math.min(1, Number(row.confidence || 0.7) + 0.12);
  }
  return normalized.map(({ _amount, ...row }) => row);
}

function inferStatementYear(text) {
  const years = String(text || "").match(/\b20\d{2}\b/g);
  return years?.[0] || String(new Date().getUTCFullYear());
}

function parseDateToken(value, defaultYear) {
  const text = String(value || "").replace(",", "").replace(".", "").trim();
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numeric) {
    const year = numeric[3] ? normalizeYear(numeric[3]) : defaultYear;
    return `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }

  const dayMonth = text.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/);
  if (dayMonth) {
    const month = MONTHS[dayMonth[2].slice(0, 4).toLowerCase()] || MONTHS[dayMonth[2].slice(0, 3).toLowerCase()];
    if (!month) return "";
    return `${dayMonth[3] ? normalizeYear(dayMonth[3]) : defaultYear}-${month}-${dayMonth[1].padStart(2, "0")}`;
  }

  const monthDay = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (monthDay) {
    const month = MONTHS[monthDay[1].slice(0, 4).toLowerCase()] || MONTHS[monthDay[1].slice(0, 3).toLowerCase()];
    if (!month) return "";
    return `${monthDay[3] ? normalizeYear(monthDay[3]) : defaultYear}-${month}-${monthDay[2].padStart(2, "0")}`;
  }

  return "";
}

function normalizeYear(value) {
  return String(value).length === 2 ? `20${value}` : String(value);
}

function rowConfidence(row) {
  let score = 0.45;
  if (row.date) score += 0.18;
  if (row.description?.length >= 4) score += 0.12;
  if (hasNumber(row.amount)) score += 0.14;
  if (hasNumber(row.balance)) score += 0.08;
  return clamp(score, 0, 0.92);
}

function scoreParserConfidence(rows, pages, totalPages) {
  const normalized = normalizeRows(rows);
  if (!normalized.length) return 0;
  const rowScore = average(normalized.map((row) => Number(row.confidence || 0.68))) || 0.68;
  const textDensity = Math.min(1, pages.join("").replace(/\s+/g, "").length / Math.max(500, (totalPages || pages.length || 1) * 180));
  return clamp(0.72 * rowScore + 0.28 * textDensity, 0, 0.9);
}

function extractAzureRows(analyzeResult) {
  const rows = [];
  for (const document of analyzeResult?.documents || []) {
    collectAzureTransactionRows(document.fields, rows);
  }
  if (!rows.length) rows.push(...extractRowsFromTables(analyzeResult?.tables || []));
  return dedupeRows(rows);
}

function collectAzureTransactionRows(value, rows) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAzureTransactionRows(item, rows));
    return;
  }

  if (value.valueArray) {
    value.valueArray.forEach((item) => {
      const row = azureObjectToRow(item.valueObject || item);
      if (isLikelyTransaction(row)) rows.push(row);
      else collectAzureTransactionRows(item.valueObject || item, rows);
    });
    return;
  }

  const object = value.valueObject || value;
  if (typeof object === "object") {
    const directRow = azureObjectToRow(object);
    if (isLikelyTransaction(directRow)) rows.push(directRow);
    Object.entries(object).forEach(([key, child]) => {
      if (normalizeKey(key).includes("transaction")) collectAzureTransactionRows(child, rows);
      else if (child?.valueArray || child?.valueObject) collectAzureTransactionRows(child, rows);
    });
  }
}

function azureObjectToRow(object = {}) {
  const field = (names) => getField(object, names);
  const dateField = field(["date", "transactionDate", "postedDate", "postingDate", "valueDate"]);
  const descriptionField = field(["description", "details", "memo", "merchant", "payee", "transactionDescription"]);
  const amountField = field(["amount", "transactionAmount"]);
  const creditField = field(["credit", "deposit", "deposits", "moneyIn", "money_in", "paidIn"]);
  const debitField = field(["debit", "withdrawal", "withdrawals", "moneyOut", "money_out", "paidOut"]);
  const balanceField = field(["balance", "runningBalance", "closingBalance"]);
  const page = firstPage([dateField, descriptionField, amountField, creditField, debitField, balanceField]);
  const amount = moneyValue(amountField);
  let moneyIn = moneyValue(creditField);
  let moneyOut = moneyValue(debitField);

  if (!hasNumber(moneyIn) && !hasNumber(moneyOut) && hasNumber(amount)) {
    if (Number(amount) < 0) moneyOut = Math.abs(Number(amount));
    else moneyIn = Number(amount);
  }

  return {
    date: fieldValue(dateField),
    description: fieldValue(descriptionField),
    money_in: moneyIn,
    money_out: moneyOut,
    balance: moneyValue(balanceField),
    page,
    confidence: average(
      [dateField, descriptionField, amountField, creditField, debitField, balanceField]
        .map((item) => Number(item?.confidence))
        .filter(Number.isFinite)
    ) || 0.82
  };
}

function extractRowsFromTables(tables) {
  const rows = [];
  for (const table of tables) {
    const grid = [];
    for (const cell of table.cells || []) {
      grid[cell.rowIndex] ||= [];
      grid[cell.rowIndex][cell.columnIndex] = cell.content || "";
    }
    const headerIndex = grid.findIndex((row) => row && row.some((cell) => /date/i.test(cell || "")));
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map((header) => normalizeKey(header || ""));
    const indexes = mapHeaderIndexes(headers);
    if (indexes.date < 0 || indexes.description < 0) continue;
    for (const row of grid.slice(headerIndex + 1)) {
      if (!row) continue;
      const rawAmount = indexes.amount >= 0 ? normalizeNumber(row[indexes.amount]) : "";
      let moneyIn = indexes.moneyIn >= 0 ? normalizeNumber(row[indexes.moneyIn]) : "";
      let moneyOut = indexes.moneyOut >= 0 ? normalizeNumber(row[indexes.moneyOut]) : "";
      if (!hasNumber(moneyIn) && !hasNumber(moneyOut) && hasNumber(rawAmount)) {
        if (Number(rawAmount) < 0) moneyOut = Math.abs(Number(rawAmount));
        else moneyIn = Number(rawAmount);
      }
      rows.push({
        date: row[indexes.date] || "",
        description: row[indexes.description] || "",
        money_in: moneyIn,
        money_out: moneyOut,
        balance: indexes.balance >= 0 ? normalizeNumber(row[indexes.balance]) : "",
        page: "",
        confidence: 0.76
      });
    }
  }
  return rows;
}

function mapHeaderIndexes(headers) {
  const find = (tests) => headers.findIndex((header) => tests.some((test) => header.includes(test)));
  return {
    date: find(["date", "posted", "posting"]),
    description: find(["description", "details", "memo", "merchant", "payee"]),
    moneyIn: find(["deposit", "credit", "moneyin", "paidin"]),
    moneyOut: find(["withdrawal", "debit", "moneyout", "paidout"]),
    amount: find(["amount"]),
    balance: find(["balance"])
  };
}

async function extractWithCloudflareAi(env, fileName, arrayBuffer, options = {}) {
  const markdown = await pdfToMarkdown(env, fileName, arrayBuffer);
  const extracted = await extractTransactions(env, markdown, options);
  return { provider: "cloudflare-ai", ...extracted };
}

async function pdfToMarkdown(env, fileName, arrayBuffer) {
  const result = await env.AI.toMarkdown({
    name: fileName,
    blob: new Blob([arrayBuffer], { type: "application/pdf" })
  });

  const normalized = Array.isArray(result) ? result[0] : result;
  if (!normalized || normalized.format === "error") {
    throw new Error(normalized?.error || "PDF text extraction failed.");
  }

  const markdown = String(normalized.data || "").trim();
  if (!markdown) {
    throw new Error("The PDF did not contain readable statement text.");
  }

  return markdown.slice(0, 120000);
}

async function extractTransactions(env, markdown, options = {}) {
  const previewInstruction = options.previewPages
    ? "For preview mode, extract only the first 10 transaction rows visible near the beginning of the statement."
    : "Extract all transaction rows.";
  const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      {
        role: "system",
        content:
          `Extract bank statement transactions only. ${previewInstruction} Return JSON matching the schema. Use ISO dates. Put deposits in money_in, withdrawals in money_out, and leave unknown balances null. Do not invent rows.`
      },
      {
        role: "user",
        content: `Convert this bank statement text to transaction rows:\n\n${markdown}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: extractionSchema
    }
  });

  return parseAiJson(response);
}

function parseAiJson(response) {
  if (!response) throw new Error("The AI extractor returned no data.");
  if (response.transactions) return response;
  if (response.response?.transactions) return response.response;
  if (response.result?.transactions) return response.result;

  const text = response.response || response.result || response.output_text || response.text;
  if (typeof text === "string") {
    const parsed = JSON.parse(text);
    if (parsed.transactions) return parsed;
    if (parsed.response?.transactions) return parsed.response;
  }

  throw new Error("The AI extractor did not return valid transaction rows.");
}

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      date: normalizeDate(row.date),
      description: String(row.description || "").trim().slice(0, 220),
      money_in: normalizeNumber(row.money_in),
      money_out: normalizeNumber(row.money_out),
      balance: normalizeNumber(row.balance),
      page: row.page === null || row.page === undefined ? "" : Number(row.page) || "",
      confidence: clamp(Number(row.confidence || 0), 0, 1)
    }))
    .filter((row) => row.date || row.description || hasNumber(row.money_in) || hasNumber(row.money_out));
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return parseDateToken(text, String(new Date().getUTCFullYear())) || text.slice(0, 10);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object" && Number.isFinite(Number(value.amount))) return Number(value.amount);
  const text = String(value);
  const negative = /^\(.*\)$/.test(text) || /-\s*\$?/.test(text);
  const number = Number(text.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return "";
  return negative ? -number : number;
}

function moneyValue(field) {
  if (!field) return "";
  if (field.valueCurrency && Number.isFinite(Number(field.valueCurrency.amount))) return Number(field.valueCurrency.amount);
  return normalizeNumber(fieldValue(field));
}

function fieldValue(field) {
  if (!field) return "";
  if (field.valueDate) return field.valueDate;
  if (field.valueString) return field.valueString;
  if (field.valueNumber !== undefined) return field.valueNumber;
  if (field.valueInteger !== undefined) return field.valueInteger;
  if (field.valueCurrency) return field.valueCurrency.amount;
  if (field.content !== undefined) return field.content;
  return "";
}

function getField(object, names) {
  const wanted = new Set(names.map(normalizeKey));
  return Object.entries(object || {}).find(([key]) => wanted.has(normalizeKey(key)))?.[1] || null;
}

function firstPage(fields) {
  for (const field of fields) {
    const page = field?.boundingRegions?.[0]?.pageNumber;
    if (page) return page;
  }
  return "";
}

function isLikelyTransaction(row) {
  return Boolean(row.date && row.description && (hasNumber(row.money_in) || hasNumber(row.money_out)));
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [normalizeDate(row.date), row.description, row.money_in, row.money_out, row.balance].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function ratio(values, predicate) {
  if (!values.length) return 0;
  return values.filter(predicate).length / values.length;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
