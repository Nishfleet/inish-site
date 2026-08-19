import { withSecurityHeaders } from "./lib/http.js";

const markdown = `---
title: AI Converter - Useful file conversion
description: Convert bank statement PDFs, receipts, invoices, screenshots, documents, audio, images, video, archives, and common file formats into useful outputs with preview-first conversion.
---

# AI Converter

AI Converter converts sensitive files into useful CSV, JSON, Markdown, transcript, HTML, SVG, image, document, media, or archive outputs. Bank statements are the first live AI module. Receipts, invoices, screenshot tables, audio transcripts, document Markdown, screenshot-to-HTML, image conversion, and common file-format conversion use the same preview-first product surface.

## Live and beta modules

Live:

- Direct browser upload.
- Built-in parser first for digital PDFs.
- OCR fallback for scanned or messy PDFs when configured.
- Free preview and downloadable sample CSV before payment.
- Full extraction and CSV download after payment.
- One automatic stronger redo for paid jobs.
- No email intake for bank statements.
- No human review queue.
- Source files are stored privately and deleted after failed extraction, completed redo, or the 24-hour source lifecycle.
- Low-confidence conversions fail closed with no charge.
- Free-preview reuse, payment reuse, and redo abuse are rate-limited.
- PNG/JPG/WEBP to PNG/JPG/WEBP conversion.
- PNG/JPG/WEBP to SVG posterized conversion.
- Documents, images, audio, video, and archives can convert into popular output formats. Long media jobs run in the background and update automatically.

Beta:

- Receipt image or PDF to expense CSV with vendor, date, category, total, tax, payment method, and notes when safely detected.
- Invoice or bill image/PDF to CSV or JSON with invoice fields and line items when safely detected.
- Screenshot PNG, JPG, WEBP, or image PDF to spreadsheet CSV with table/header inference when safely detected.
- Audio transcript from MP3, WAV, M4A, AAC, OGG, or WEBM to TXT or JSON.
- Document Markdown conversion for supported rich document formats.
- Screenshot to HTML provides a clean starter preview and uses image understanding for paid image exports when configured. This does not claim pixel-perfect screenshot cloning.
- Beta modules use OCR and fail closed when confidence is too low.

## Popular conversion examples

The homepage ticker and /formats page suggest common requests that fit the current product surface. Core examples include bank statement PDF to CSV, receipt image to expense CSV, invoice PDF to JSON, screenshot table to CSV, JPG to PNG, PNG to JPG, WEBP to PNG, audio to transcript, and document to Markdown. Provider-backed conversion options are available across the current accepted input formats and output choices, with more coming soon. Examples include PDF to Word, Word to PDF, PDF to JPG, HEIC to JPG, SVG to PNG, MP4 to MP3, MOV to MP4, GIF to MP4, WAV to MP3, XLSX to CSV, CSV to XLSX, and docs/images/audio/video/archive categories.

## Pricing

- Free preview: first rows can be downloaded before payment.
- Starter: ₹399 for 25 pages or images.
- Standard: ₹799 for 100 pages or images.
- Bulk: ₹1,399 for 500 pages or images.

## Upcoming modules

- AI-monitored email intake after the direct upload workflow is stable.
- Pixel-perfect image-to-code is not claimed. Format conversion is available only when the live app accepts that input and output pair.

## Security posture

The AI workflow is designed for private storage, 24-hour source retention, 7-day generated-file retention, random job tokens, no public object URLs, no emailed bank PDFs, and minimal job metadata.

## Request access

Use the upload flow at https://aiconverter.app.

\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AI Converter",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://aiconverter.app",
  "description": "AI Converter converts bank statement PDFs, receipts, invoices, screenshot tables, documents, audio, images, video, archives, and common file formats into useful outputs."
}
\`\`\`
`;

const aboutMarkdown = `---
title: About AI Converter
description: AI Converter is a private, preview-first converter for sensitive files, with bank statement PDF to CSV live first, format conversion, image tools, and short retention.
---

# About AI Converter

AI Converter turns source files into reviewable outputs without a human review queue. Upload directly, inspect a preview first, and unlock the full export only when the sample is useful.

It is built for short retention, private storage, and clear failure states.

## Live

- Bank statement PDF to CSV.
- Preview and downloadable sample before payment.
- Paid full export and download.
- One stronger automatic redo for paid jobs.
- Image format and raster-to-SVG tools.

## More conversion routes

Receipts, invoices, screenshot tables, audio transcripts, document Markdown, screenshot-to-HTML, and common file conversion use the same preview-first flow. If a route cannot produce a reliable preview or result, it fails closed instead of pretending.

## Privacy posture

Source files are stored privately for preview, unlock, and the redo window. Generated files expire after a short download window. Support requests should reference job IDs, not pasted bank, receipt, invoice, screenshot, or source-file data.

## Boundaries

AI Converter does not claim every bank, receipt, invoice, screenshot, audio file, document, image format, certified compliance status, pixel-perfect image-to-code, or guaranteed accuracy. Review exports before important use.
`;

const formatsMarkdown = `---
title: AI Converter formats
description: Current AI Converter routes for private file conversion and extraction.
---

# AI Converter formats

AI Converter lists only routes the live app is allowed to offer.

## Current families

- Bank statement PDFs to Clean CSV, QuickBooks CSV, Xero CSV, Wave CSV, GnuCash CSV, QIF, OFX, or QBO. CSV is the default path. OFX and QBO require bank details.
- Receipts to expense CSV.
- Invoices to CSV or JSON.
- Screenshot tables to CSV.
- Supported documents to Markdown.
- Supported audio files to transcript TXT or JSON.
- Supported provider-backed document, image, audio, video, archive, and spreadsheet format swaps when the selected input/output pair is available.

## Popular requests covered today

- Bank statement PDF to CSV.
- Receipt image to expense CSV.
- Invoice PDF to JSON.
- Screenshot table to CSV.
- JPG to PNG.
- PNG to JPG.
- WEBP to PNG.
- Audio to transcript.
- Document to Markdown.
- PDF to Word.
- Word to PDF.
- HEIC to JPG.
- MP4 to MP3.
- MOV to MP4.
- GIF to MP4.
- WAV to MP3.
- XLSX to CSV.

Formats count as available only when the live app accepts that input and output pair. AI Converter does not claim every file, every bank, every statement, every receipt, every invoice, every screenshot, every document, every media file, or every archive will work.
`;

const bankStatementMarkdown = `---
title: Bank statement PDF to CSV
description: Convert a bank statement PDF to CSV with direct upload, free preview, paid unlock, and short source-file retention.
---

# Bank statement PDF to CSV

AI Converter turns bank statement PDFs into spreadsheet-ready CSV. Upload the PDF, check sample rows first, then unlock the full CSV only when the preview looks useful.

## Workflow

1. Upload a bank statement PDF.
2. Review sample rows before payment.
3. Unlock the full CSV if the preview is usable.
4. Download the generated CSV.

## Pricing

- Free preview and sample CSV download.
- ₹399 for up to 25 pages.
- ₹799 for up to 100 pages.
- ₹1,399 for up to 500 pages.

## Limits

Files can fail when they are password-protected, corrupted, unusual, low quality, or too large. AI Converter currently accepts PDFs up to 50 MB and does not claim every bank format is supported.

No bank login is requested. The export should be reviewed before important use.
`;

const convertMarkdown = `---
title: Convert bank statement to CSV
description: A practical bank statement to CSV converter for PDF uploads, sample preview, paid export, and reviewable fictional sample data.
---

# Convert bank statement to CSV

Use AI Converter when you have a bank statement PDF and need transaction rows you can inspect in a spreadsheet.

The current workflow is direct upload only. Email monitoring is not the intake path.

## Output columns

The sample CSV uses date, description, money in, money out, and balance columns. Real outputs depend on what can be safely extracted from the uploaded PDF.

AI Converter is not for bank login access, tax advice, accounting review, guaranteed categorization, or files that require human judgment.

## Try the sample

Download the fictional sample CSV at https://aiconverter.app/sample-bank-statement.csv.
`;

const quickBooksCsvMarkdown = `---
title: PDF bank statement to QuickBooks CSV
description: Convert bank statement PDFs into reviewable CSV rows you can clean up for QuickBooks. Imports are not guaranteed.
---

# PDF bank statement to QuickBooks CSV

AI Converter can turn a bank statement PDF into CSV rows you can review, clean, and map for a QuickBooks workflow.

This is not official QuickBooks Web Connect, does not connect to QuickBooks, and does not guarantee a successful import.

## Workflow

1. Upload a bank statement PDF.
2. Review sample rows before payment.
3. Unlock the full CSV if the preview is usable.
4. Map and review the CSV inside your accounting workflow before posting transactions.

## Output

Typical columns are date, description, money in, money out, and balance when available.

Need OFX/QBO? Add bank details in the converter. Treat those files as advanced exports to review separately, not guaranteed QuickBooks import files.

## Limits

Password-protected, corrupted, unusual, low-quality, or unsupported files may fail. Review every export before important bookkeeping, tax, lending, or compliance use.
`;

const xeroCsvMarkdown = `---
title: PDF bank statement to Xero CSV
description: Convert bank statement PDFs into reviewable CSV rows you can prepare for Xero workflows.
---

# PDF bank statement to Xero CSV

AI Converter extracts reviewable transaction rows from bank statement PDFs so you can prepare a CSV for a Xero workflow.

AI Converter does not connect to Xero, does not provide a direct bank feed, and does not guarantee that Xero will accept the file without edits.

## Workflow

1. Upload a PDF statement.
2. Review sample rows before payment.
3. Unlock the full CSV when the preview is useful.
4. Check dates, signs, descriptions, and account mapping before import.

## Output

Typical CSV columns are date, description, money in, money out, and balance when available.

## Limits

Some files fail because they are scanned poorly, password-protected, corrupted, unusual, or unsupported. Review the export before bookkeeping, tax, lending, or compliance use.
`;

const waveCsvMarkdown = `---
title: PDF bank statement to Wave CSV
description: Convert bank statement PDFs into reviewable CSV rows you can clean up for Wave bookkeeping workflows.
---

# PDF bank statement to Wave CSV

AI Converter extracts transaction rows from a bank statement PDF into CSV so you can review and prepare the file for a Wave bookkeeping workflow.

AI Converter does not connect to Wave, does not provide a direct bank feed, does not categorize expenses, and does not guarantee accepted imports.

## Workflow

1. Upload a PDF bank statement.
2. Check sample rows before payment.
3. Unlock the full CSV if the preview is usable.
4. Review, clean, and map the CSV before import.

## Best fit

Clear statement rows are the best fit. Very low-quality scans, locked PDFs, unusual layouts, and corrupted files may fail.
`;

const scannedStatementMarkdown = `---
title: Scanned bank statement to Excel
description: Turn scanned bank statement PDFs into reviewable CSV rows that open in Excel when OCR confidence is high enough.
---

# Scanned bank statement to Excel

AI Converter can use OCR fallback for scanned or image-heavy bank statement PDFs when configured. The output is CSV that opens in Excel, not a guaranteed native Excel workbook.

## Workflow

1. Upload the scanned PDF.
2. Check sample rows before payment.
3. Unlock the full CSV when the preview is useful.
4. Open the CSV in Excel and review every row before important use.

## Limits

OCR is sensitive to scan quality. Blurry pages, shadows, cut-off columns, handwriting, password protection, corruption, or unusual layouts may fail.

Low-confidence conversions should fail closed instead of inventing rows.
`;

const creditCardStatementMarkdown = `---
title: Credit card statement PDF to CSV
description: Convert credit card statement PDFs into reviewable CSV rows when transaction tables can be safely extracted.
---

# Credit card statement PDF to CSV

AI Converter can extract transaction rows from credit card statement PDFs into CSV when the rows can be safely detected.

No card login is requested. There is no direct feed, categorization promise, reconciliation service, tax advice, or guaranteed perfect conversion.

## Workflow

1. Upload the statement PDF.
2. Review sample rows before payment.
3. Unlock the full CSV if the preview is usable.
4. Check signs, duplicate rows, fees, credits, dates, and descriptions before use.

## Best fit

Clear transaction tables are the best fit. Rewards pages, summaries, promotional sections, unusual layouts, scans, locked files, and corrupted PDFs may require cleanup or fail.
`;

const receiptMarkdown = `---
title: Receipt to expense CSV
description: Convert receipt photos and PDFs into expense CSV rows with a free preview before payment. Accepts PDF, PNG, JPG, JPEG, and WEBP up to 50 MB.
---

# Receipt to expense CSV

AI Converter turns receipt photos and PDFs into expense CSV rows. Upload the file, check sample rows free, then unlock the full expense CSV only when the preview looks useful.

## Workflow

1. Upload a receipt as PDF, PNG, JPG, JPEG, or WEBP (up to 50 MB).
2. Review sample rows free before payment.
3. Unlock the full expense CSV if the preview is usable.
4. Download rows with vendor, date, category, total, currency, subtotal, tax, payment method, and notes when each is safely detected.

## Output shape

Receipt exports are one row per readable receipt page. Fields such as currency, subtotal, tax, payment method, and notes appear only when the receipt clearly shows them.

## Limits

Only PDF, PNG, JPG, JPEG, and WEBP files are accepted, up to 50 MB each. Jobs stop without an export when a vendor and total cannot be found or extraction confidence is too low. Blurry, tilted, cut-off, or unusual receipts may fail. Receipt conversion is a beta module and AI Converter does not claim support for every receipt layout, language, or currency.

The export should be compared with the original receipt before important use.
`;

const bookkeepersMarkdown = `---
title: Bank statement converter for bookkeepers
description: A preview-first bank statement PDF to CSV converter for bookkeepers who need reviewable rows and clear limits.
---

# Bank statement converter for bookkeepers

AI Converter helps bookkeepers turn bank statement PDFs into CSV rows for cleanup, client workpapers, and accounting-system prep.

The tool extracts rows. It does not provide accounting advice, tax advice, reconciliation, categorization, direct bank feeds, guaranteed imports, certified compliance status, or official accounting-platform support.

## Workflow

1. Upload a bank statement PDF.
2. Review sample rows before payment.
3. Unlock the full CSV if the preview is useful.
4. Clean, map, reconcile, and review the file in your own bookkeeping workflow.

## Platform prep

Use the CSV as a preparation layer for tools such as QuickBooks, Xero, Wave, or Excel. Need OFX/QBO? Add bank details in the converter. Treat those files as advanced exports to review separately, not official import support.

## Operational limits

Source files use a 24-hour private lifecycle. Generated files expire after 7 days. Low-confidence files can fail closed. Review every export before important bookkeeping, tax, lending, or compliance use.
`;

const sampleMarkdown = `---
title: Sample bank statement CSV
description: Download a fictional CSV showing the bank statement output shape used by AI Converter.
---

# Sample bank statement CSV

Download a fictional CSV sample to see the output shape before uploading a real PDF.

The sample data is fictional. It is not a customer file and does not contain real bank statement data.

Columns: date, description, money_in, money_out, balance.

Real exports depend on what can be safely extracted from your PDF.
`;

const privacyMarkdown = `---
title: Privacy Policy - AI Converter
description: How AI Converter handles uploaded source files, generated files, processors, payment status, and short retention.
---

# Privacy Policy

Last updated May 17, 2026.

AI Converter is built for private upload, short retention, minimal job metadata, and preview-first conversion. We do not ask for bank credentials, and sensitive files should not be sent through support.

## Information collected

- Uploaded source file.
- Generated preview rows and converted output files.
- Optional email for payment receipt and job recovery.
- Payment status, payment ID, selected plan, timestamps, and job status.
- Security metadata such as hashed IP, hashed user agent, file hash, and abuse-limit events.

AI Converter does not ask for bank login credentials.

## Processing

Files are used to produce the output you requested. Digital bank statement PDFs are parsed directly first. OCR and AI processing may be used for scanned, image-heavy, receipt, invoice, screenshot, audio, document, or messy files when configured. Common file-format conversion may use secure automated processing services when configured.

Low-confidence files fail closed instead of being sent to a human review queue.

## Processors

Cloudflare runs the app, private storage, database, Turnstile checks, and some AI processing. OCR or AI routes may use Mistral or Cloudflare Workers AI. Provider-backed file-format conversion may use CloudConvert first and Convertio as a backup route. Dodo handles checkout and card processing.

AI Converter does not use uploaded files or generated outputs to train models. External processors receive data only to perform the selected conversion, security check, payment, or support workflow.

## Retention

Source files are kept only for preview, paid unlock, and the automatic redo window. Source files are deleted after failed preview, failed full extraction, completed redo, or the 24-hour private source lifecycle. Generated files expire after 7 days.

## Requests

Use https://aiconverter.app/support/ for deletion, privacy, or payment-related requests. AI Converter is operated by the AI Converter team. Do not send source files through support.
`;

const termsMarkdown = `---
title: Terms of Service - AI Converter
description: Terms for using AI Converter's automated conversion service.
---

# Terms of Service

Last updated May 17, 2026.

AI Converter provides automated file conversion. It is a data conversion tool, not accounting, tax, legal, lending, compliance, or financial advice.

## Workflow

The first production AI workflow is bank statement PDF to CSV. Receipt, invoice, screenshot-table, audio transcript, document Markdown, screenshot-to-HTML, and common file-format conversion are available when configured. Upload a supported file, review and download a free sample preview, then pay once to generate and download the selected output.

## User responsibility

You are responsible for checking exported files before using them for bookkeeping, taxes, lending, legal, compliance, or decision-making work. Automated extraction and conversion can be wrong, especially on unusual, scanned, damaged, password-protected, noisy, or low-quality files.

## Payment and access

A sample preview is free and can be downloaded as a CSV sample. Paid access unlocks the full extraction for the selected page pack. The service may reject files, block repeated previews, or limit access when needed to protect users, data, infrastructure, or the refund policy.

## Redo and refund

Paid jobs include one automatic stronger redo. If the stronger redo still cannot produce a usable generated file, the job is marked refund due or credit due under the refund policy.

## Prohibited use

Do not upload files you do not have the right to process. Do not upload malware, test attacks, intentionally corrupted files, or try to bypass payment, retention, rate limits, or access controls.
`;

const refundMarkdown = `---
title: Refund Policy - AI Converter
description: AI Converter refund, redo, and anti-abuse policy for paid generated exports.
---

# Refund Policy

Last updated May 17, 2026.

You should not pay for a blind export. AI Converter shows a preview first, gives paid jobs one stronger automatic redo, and records refund or credit due when a paid conversion still cannot produce a usable file.

## Free preview

If AI Converter cannot safely produce a sample preview, there is no charge. The file fails closed instead of being routed to a human queue.

## Paid export retry

Paid jobs include one stronger automatic redo. Use it when the full generated file is incomplete, badly formatted, missing rows or fields, or otherwise not usable.

## Refund or credit

If a paid job still cannot produce a usable generated file after the stronger redo, AI Converter records the job as refund due or credit due. When automatic refunds are enabled and a cash refund is allowed, the refund is requested through the payment provider. If a cash refund is not available automatically, support uses the recorded job status to resolve the credit or refund.

## Anti-abuse limits

Repeated free previews from the same file or connection are limited. Each paid job gets one automatic stronger redo. Payment IDs are bound to one job and cannot be reused.

## Help

Use https://aiconverter.app/support/ with your job ID, payment email, and a short issue description. Do not send source files through support.
`;

const securityMarkdown = `---
title: Security - AI Converter
description: Security controls for AI Converter uploads, job access, retention, abuse prevention, and OCR fallback.
---

# Security

AI Converter is designed for files you would not put in a shared inbox: private storage, tokened job access, short source retention, abuse limits, and low-confidence failures instead of human file review.

## Upload and storage controls

- Uploaded files and generated files are stored in private object storage.
- Files are not exposed through public object URLs.
- Job access requires a job ID and random token.
- API responses are marked no-store.

## Processing controls

Digital bank statement PDFs use the native parser first. OCR fallback is reserved for scanned, photo-based, receipt, invoice, screenshot, or messy files when configured. Audio transcript, document Markdown, screenshot-to-HTML, and common file-format conversion run only when the selected conversion is available. Low-confidence AI extraction files fail closed.

## Subprocessors

Cloudflare runs hosting, Workers, private storage, database, Turnstile, and some AI routes. Mistral may process OCR or document understanding jobs. CloudConvert and Convertio may process provider-backed file-format conversions. Dodo handles checkout and card processing.

AI Converter does not use uploaded files or generated outputs to train models.

## Retention controls

Source files are deleted after failed preview, failed full extraction, completed redo, or the 24-hour private source lifecycle. Generated files expire after 7 days.

## Anti-abuse controls

Server-side file validation, upload rate limits, same-file free preview limits, one automatic stronger redo per paid job, and unique payment binding reduce abuse.

## Limits

AI Converter currently accepts files up to 50 MB, audio-transcript files up to 25 MB, and PDFs up to 500 pages. Password-protected, corrupted, unusual, noisy, unsupported format pairs, or low-quality files may fail.
`;

const dataRetentionMarkdown = `---
title: Data Retention - AI Converter
description: How long AI Converter keeps source files, generated files, job metadata, and abuse-prevention records.
---

# Data retention

AI Converter keeps source files only long enough to preview, unlock, redo, and download the conversion. The product is built around short retention, not long-term file storage.

## Source files

Source files are deleted after failed preview, failed full extraction, completed redo, or the 24-hour private source lifecycle.

## Generated files

Generated files expire after 7 days. Download the file after the export completes if you need a copy later.

## Support and processor records

Support messages, payment records, abuse-prevention events, provider job IDs, and operational logs may last longer when needed for payment, security, debugging, or legal records.

## Job metadata

Minimal metadata such as job status, selected plan, timestamps, row count, confidence, payment status, and refund status may be retained for payment records, abuse prevention, debugging, and compliance.

## Abuse-prevention records

Hashed connection data, file hashes, and preview-limit events may be retained long enough to limit repeated free previews, payment reuse, and refund abuse. These records are not used by AI Converter to train a model.

## Processor records

Cloudflare, Dodo, Mistral, CloudConvert, and Convertio may keep service, security, billing, or conversion records under their own terms when they are used for a selected route.

## Deletion requests

Use https://aiconverter.app/support/ with your job ID and payment email. Do not send source files through support.
`;

const supportMarkdown = `---
title: Support - AI Converter
description: Get help with AI Converter payment, refund, deletion, and conversion issues.
---

# Support

Use https://aiconverter.app/support/ for conversion, payment, refund, deletion, or security requests.

Include the job ID when you have one. Do not paste bank statements, receipts, invoices, screenshots, or source-file details into the message.

## What to include

- Job ID and payment email, if available.
- The plan selected.
- A short description of what went wrong.
- Whether the stronger redo has already been tried.

## Current support scope

Support requests are recorded for review. Security reports and payment, deletion, or refund issues are treated as priority requests.
`;

const trustMarkdown = `---
title: Trust Center - AI Converter
description: AI Converter trust center for private file handling, retention, subprocessors, payments, and support.
---

# Trust center

AI Converter is built around direct upload, free preview, short retention, tokened access, payment-bound unlocks, and no human file review queue.

## File handling

Source files are kept for preview, paid unlock, and the redo window. Generated files expire after 7 days. Completed jobs can be deleted from the converter screen.

## Processors and subprocessors

Cloudflare runs the app, private storage, database, security checks, and some AI routes. OCR or AI routes may use Mistral or Cloudflare Workers AI. Provider-backed format conversion may use CloudConvert first and Convertio as backup. Dodo handles checkout and card processing.

## Training

AI Converter does not use uploaded files or generated outputs to train models. External processors receive data only to perform the selected conversion or security check.

## Support

Use the support form for conversion, payment, refund, deletion, or security questions. Do not paste bank statement, receipt, invoice, or source-file contents into support messages.

AI Converter does not claim SOC 2, GDPR certification, official bank feeds, guaranteed accounting-platform imports, accounting advice, or tax advice.
`;

const markdownByRoute = new Map([
  ["/", markdown],
  ["/index.html", markdown],
  ["/formats", formatsMarkdown],
  ["/about", aboutMarkdown],
  ["/bank-statement-pdf-to-csv", bankStatementMarkdown],
  ["/convert-bank-statement-to-csv", convertMarkdown],
  ["/pdf-bank-statement-to-quickbooks-csv", quickBooksCsvMarkdown],
  ["/pdf-bank-statement-to-xero-csv", xeroCsvMarkdown],
  ["/pdf-bank-statement-to-wave-csv", waveCsvMarkdown],
  ["/scanned-bank-statement-to-excel", scannedStatementMarkdown],
  ["/credit-card-statement-pdf-to-csv", creditCardStatementMarkdown],
  ["/receipt-to-csv", receiptMarkdown],
  ["/bank-statement-converter-for-bookkeepers", bookkeepersMarkdown],
  ["/sample-csv", sampleMarkdown],
  ["/privacy", privacyMarkdown],
  ["/terms", termsMarkdown],
  ["/refund", refundMarkdown],
  ["/security", securityMarkdown],
  ["/trust", trustMarkdown],
  ["/support", supportMarkdown],
  ["/data-retention", dataRetentionMarkdown]
]);

const textLikeRoutes = new Set(markdownByRoute.keys());

function notFoundMarkdown(pathname) {
  return `---
title: Page not found - AI Converter
description: This AI Converter route does not exist.
---

# 404 - Page not found

The requested route \`${pathname || "/"}\` does not match a live AI Converter page.

Use one of the real routes:

- [bank statement PDF to CSV](/bank-statement-pdf-to-csv/)
- [PDF bank statement to QuickBooks CSV](/pdf-bank-statement-to-quickbooks-csv/)
- [PDF bank statement to Xero CSV](/pdf-bank-statement-to-xero-csv/)
- [PDF bank statement to Wave CSV](/pdf-bank-statement-to-wave-csv/)
- [scanned bank statement to Excel](/scanned-bank-statement-to-excel/)
- [credit card statement PDF to CSV](/credit-card-statement-pdf-to-csv/)
- [formats page](/formats/)
- [privacy policy](/privacy/)
- [security notes](/security/)
- [data retention policy](/data-retention/)
- [refund policy](/refund/)
`;
}

function wantsMarkdown(request) {
  const accept = request.headers.get("Accept") || "";
  return accept.toLowerCase().includes("text/markdown");
}

function isPageRequest(url) {
  if (url.pathname.startsWith("/api/")) return false;
  if (textLikeRoutes.has(url.pathname)) return true;
  return !url.pathname.includes(".") && !url.pathname.startsWith("/assets/");
}

function normalizePagePath(pathname) {
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (url.hostname === "www.aiconverter.app" || url.hostname.endsWith(".pages.dev")) {
    url.hostname = "aiconverter.app";
    return withSecurityHeaders(Response.redirect(url.toString(), 301));
  }

  if ((request.method === "GET" || request.method === "HEAD") && wantsMarkdown(request) && isPageRequest(url)) {
    const normalizedPath = normalizePagePath(url.pathname);
    const knownMarkdown = markdownByRoute.get(normalizedPath);
    const markdownBody = knownMarkdown || notFoundMarkdown(url.pathname);
    return withSecurityHeaders(
      new Response(request.method === "HEAD" ? null : markdownBody, {
        status: knownMarkdown ? 200 : 404,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          Vary: "Accept",
          "X-Markdown-Tokens": String(Math.ceil(markdownBody.length / 4)),
          "Content-Signal": "search=yes, ai-input=yes"
        }
      })
    );
  }

  const response = await context.next();
  const extraHeaders = {};
  if (url.pathname.startsWith("/api/")) {
    extraHeaders["Cache-Control"] = "no-store";
  }

  const secured = withSecurityHeaders(response, extraHeaders);
  secured.headers.append("Vary", "Accept");
  return secured;
}
