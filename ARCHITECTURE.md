# AI Converter Privacy-First Architecture

## Default Path

1. Browser uploads one supported file to `/api/convert` with a converter ID.
2. The API validates converter, type, size, and file signature before processing.
3. The source file is written to private R2 under a random job key.
4. Bank statement PDFs use the built-in PDF parser first for a free sample preview. Receipt, invoice, and screenshot-table beta modules use Mistral OCR when configured. Audio transcript, document-to-Markdown, and screenshot-to-HTML beta modules use Cloudflare Workers AI when configured. Universal file conversion uses CloudConvert first, with Convertio as a configured backup route. Common image-format and raster-to-SVG conversion runs locally in the app.
5. The API validates the preview rows and confidence score.
6. If a bank PDF has too little selectable text or confidence is low, Mistral OCR is used as the configured fallback. Free OCR preview is capped to the first page by default.
7. If validation passes, the source file stays in private R2 for the paid unlock and 24-hour redo window.
8. Dodo redirect or webhook confirmation marks the matching job paid only after product, amount, currency, checkout session, and job metadata checks pass.
9. Paid jobs run full extraction or provider conversion, store the generated file privately, and get one automatic stronger redo when the route is AI-extraction based; failed paid exports are marked for refund or credit review. Multi-file batches can share one checkout and then download completed exports as one ZIP.
10. If validation fails before payment, the source file is deleted and the job fails closed with no charge.
11. Downloads require the random job token plus either payment confirmation or an explicit free-download environment flag.

## Privacy Controls

- No public R2 bucket.
- No public object URLs.
- No emailed bank statements.
- No human review queue.
- Random job IDs and random download tokens.
- Token hashes stored in D1, never raw tokens.
- Source files deleted after failed preview, completed redo, failed full extraction, or the 24-hour private source lifecycle.
- R2 lifecycle rule deletes source files under `sources/` after 24 hours and conversion artifacts under `jobs/` after 7 days.
- D1 stores only job status, plan, timestamps, payment state, optional email, and non-content metadata.
- API and download responses use `Cache-Control: no-store`.

## Security Controls

- Bank statement uploads are PDF-only. Receipt, invoice, screenshot-table, and screenshot-to-HTML beta uploads accept PDF, PNG, JPG, JPEG, and WEBP. Audio transcript beta uploads accept MP3, WAV, M4A, AAC, OGG, and WEBM up to 25 MB. Document-to-Markdown beta uploads accept the Cloudflare-supported Markdown conversion formats wired in `supportedConverters()`. Local image-format and raster-to-SVG conversion accepts PNG, JPG, JPEG, and WEBP in the browser.
- 50 MB file limit.
- 500 page hard limit; larger PDFs are rejected with a split-file instruction.
- PDF and image magic-byte validation.
- Universal provider conversion validates common document, image, audio, video, and archive signatures, starts CloudConvert asynchronously, uploads via CloudConvert `import/upload`, polls the provider job, then stores the exported result privately before download.
- Receipt beta extraction can produce one row per readable receipt page and includes category, subtotal, tax, payment method, and notes when safely detected.
- Invoice beta extraction can export invoice summary fields to CSV or JSON and includes line items in JSON when safely detected.
- Screenshot beta extraction handles markdown tables, OCR table blocks, HTML table output, and obvious date-description-amount rows.
- Audio transcript beta exports TXT or JSON transcripts through Workers AI speech recognition.
- Audio transcript sends whole-file base64 to Workers AI instead of expanding the upload into one large JavaScript number array.
- Document-to-Markdown beta exports Markdown from PDF, image, HTML/XML, CSV, Office, OpenDocument, and Apple Numbers inputs supported by Cloudflare Markdown Conversion.
- Screenshot-to-HTML beta generates a clean starter for preview and uses Workers AI vision for paid image exports when configured. It explicitly does not claim pixel-perfect cloning.
- Server-side page estimation so users cannot understate page count to force a cheaper plan.
- Upload rate limits plus same-file free-preview reuse limits.
- Payment IDs are bound to one job and cannot be reused across jobs.
- Paid jobs get only one automatic stronger redo.
- Cash refunds are requested through the payment provider only when refund automation is configured and the job has not already delivered a generated file; delivered jobs are marked for credit/refund review.
- Checkout URLs are allowlisted to Dodo hosts.
- Dodo checkout sessions, signed webhooks, payment event logs, and refund event logs are implemented when `DODO_PAYMENTS_API_KEY`, product IDs, and the Dodo webhook secret are configured.
- Batch checkout records one payment session for multiple preview-ready jobs and only marks each job paid after the signed Dodo event passes metadata, amount, product, and session checks.
- A private admin overview endpoint and page are available when `ADMIN_TOKEN` is configured.
- Turnstile verification is wired for uploads and support, and activates when both site and secret keys are configured.
- Security headers are set in middleware and `_headers`.
- The Cloudflare Pages preview domain redirects to `aiconverter.app`.

## Fail-Closed Rules

The converter does not charge or export a full generated file when:

- no transactions are found,
- too many rows are missing valid dates,
- too many rows are missing amounts,
- both money-in and money-out are present on too many rows,
- confidence is below the threshold,
- the PDF appears to exceed 500 pages,
- a receipt or screenshot/table file cannot be safely structured,
- an invoice or bill file cannot be safely structured,
- an audio file cannot be transcribed,
- a document cannot be converted to Markdown,
- a provider conversion cannot be started, completed, or downloaded safely,
- private storage or database bindings are missing.

## Upcoming

- Azure Document Intelligence remains disabled by default and requires both endpoint/key credentials and `ENABLE_AZURE_FALLBACK=true`.
- Google Document AI as a later optional fallback if Azure misses a meaningful segment.
- AI-monitored email intake only after the direct upload workflow is stable.
- Pixel-perfect image-to-code remains unclaimed until a real provider-backed connector is configured and tested.
- Cloudflare WAF rate limiting before broader paid traffic.
- A real paid card/webhook/finalize/download drill is still required before scaling paid traffic beyond synthetic checkout smoke tests.
