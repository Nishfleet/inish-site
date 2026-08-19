import { convertFileToCsv, detectPdfPageCount } from "../lib/extract.js";
import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { recordFunnelEvent } from "../lib/funnel-telemetry.js";
import {
  bankOutputFileExtension,
  missingBankMetadata,
  sanitizeBankMetadata,
  normalizeBankOutputFormat,
  bankOutputLabel
} from "../lib/accounting-exports.js";
import {
  assertSupportedUpload,
  enforceRateLimit,
  enforceUploadPolicy,
  estimatePdfPagesFromBytes,
  hasRequiredBindings,
  insertJob,
  MAX_PAGE_COUNT,
  normalizeConverterId,
  normalizeOutputFormat,
  planForPages,
  PREVIEW_PAGE_LIMIT,
  randomId,
  randomToken,
  requestFingerprint,
  retentionFields,
  RESULT_RETENTION_SECONDS,
  safeFileName,
  sourceObjectKey,
  SOURCE_RETENTION_SECONDS,
  sha256,
  sha256Bytes,
  updateJob
} from "../lib/jobs.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const rateLimit = await enforceRateLimit(env, request);
  if (rateLimit.configurationError) {
    return serverError("Private abuse-prevention salt is not configured yet.");
  }

  if (!rateLimit.ok) {
    return json(
      { error: `Too many uploads from this connection. Try again later.` },
      {
        status: 429,
        headers: { "Retry-After": "3600" }
      }
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Upload a supported file using multipart form data.");
  }

  const converterId = normalizeConverterId(form.get("converterId"));
  const outputFormat = normalizeOutputFormat(form.get("outputFormat"), converterId);
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Choose a file first.");
  const funnelSessionId = String(form.get("funnelSessionId") || "").trim().slice(0, 80);
  const baseFunnelEvent = {
    sessionId: funnelSessionId,
    converterId,
    outputFormat,
    inputKind: inputKindForUpload(file),
    fileSizeBucket: fileSizeBucketForUpload(file),
    pageBucket: pageBucketForEstimate(Number(form.get("estimatedPages") || 0)),
    fileCount: 1
  };

  const turnstile = await verifyTurnstile(
    env,
    request,
    form.get("cf-turnstile-response") || form.get("turnstileToken")
  );
  if (!turnstile.ok) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "turnstile_fail",
      turnstileState: "error",
      errorCode: form.get("cf-turnstile-response") || form.get("turnstileToken") ? "verify_failed" : "missing_token"
    });
    return json({ error: turnstile.message }, { status: 403 });
  }
  await safeRecordFunnelEvent(env, request, {
    ...baseFunnelEvent,
    eventType: "turnstile_pass",
    turnstileState: "verified"
  });

  const email = String(form.get("email") || "").trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      errorCode: "http_400"
    });
    return badRequest("Use a valid email address or leave it blank.");
  }

  const fileName = safeFileName(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const uploadError = assertSupportedUpload(file, arrayBuffer, converterId);
  if (uploadError) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      errorCode: "http_400"
    });
    return badRequest(uploadError);
  }
  const accountingMetadata =
    converterId === "bank" ? sanitizeBankMetadata(form.get("accountingMetadata") || {}) : {};
  const missingMetadata =
    converterId === "bank" ? missingBankMetadata(outputFormat, accountingMetadata) : [];
  if (missingMetadata.length) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      errorCode: "http_400"
    });
    return badRequest(`${bankOutputLabel(outputFormat)} needs bank details before we can make that file.`);
  }

  const clientEstimate = Number(form.get("estimatedPages") || 25);
  const clientEstimatedPages = Number.isFinite(clientEstimate) ? Math.max(1, clientEstimate) : 25;
  const isPdf = String(file.type || "").toLowerCase() === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const detectedPages = isPdf
    ? (await detectPdfPageCount(arrayBuffer).catch(() => 0)) || estimatePdfPagesFromBytes(arrayBuffer)
    : 1;
  const sizeEstimatedPages = Math.ceil(file.size / 320000);
  const estimatedPages = isPdf
    ? Math.max(1, clientEstimatedPages, detectedPages, sizeEstimatedPages)
    : 1;
  if (estimatedPages > MAX_PAGE_COUNT) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      pageBucket: pageBucketForEstimate(estimatedPages),
      errorCode: "http_400"
    });
    return badRequest(`This service accepts PDFs up to ${MAX_PAGE_COUNT} pages. Split larger files before uploading.`);
  }
  const plan = planForPages(estimatedPages);
  const fileHash = await sha256Bytes(arrayBuffer);
  const fingerprint = await requestFingerprint(env, request);
  const uploadPolicy = await enforceUploadPolicy(env, { ...fingerprint, fileHash });
  if (!uploadPolicy.ok) {
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      pageBucket: pageBucketForEstimate(estimatedPages),
      errorCode: "http_429"
    });
    return json({ error: uploadPolicy.message }, { status: 429 });
  }

  const jobId = randomId("job");
  const token = randomToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RESULT_RETENTION_SECONDS * 1000).toISOString();
  const sourceExpiresAt = new Date(Date.now() + SOURCE_RETENTION_SECONDS * 1000).toISOString();
  const sourceKey = sourceObjectKey(jobId, fileName, converterId);
  const previewKey = `jobs/${jobId}/preview.csv`;
  const resultExtension =
    converterId === "bank" ? bankOutputFileExtension(normalizeBankOutputFormat(outputFormat)) : outputFormat;
  const resultKey = `jobs/${jobId}/result.${resultExtension}`;

  await insertJob(env, {
    id: jobId,
    tokenHash: await sha256(token),
    status: "processing",
    planId: plan.id,
    email,
    sourceKey,
    resultKey,
    originalFileName: fileName,
    fileSize: file.size,
    estimatedPages,
    converterId,
    inputMimeType: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
    outputFormat,
    accountingMetadataJson: converterId === "bank" ? JSON.stringify(accountingMetadata) : "",
    fileHash,
    ipHash: fingerprint.ipHash,
    userAgentHash: fingerprint.userAgentHash,
    now,
    expiresAt
  });

  try {
    await env.AICONVERTER_BUCKET.put(sourceKey, arrayBuffer, {
      httpMetadata: { contentType: file.type || (isPdf ? "application/pdf" : "application/octet-stream") },
      customMetadata: {
        jobId,
        purpose: "source-awaiting-payment",
        deleteAfter: sourceExpiresAt
      }
    });

    const converted = await convertFileToCsv(env, converterId, fileName, file.type || (isPdf ? "application/pdf" : ""), arrayBuffer, {
      previewPages: PREVIEW_PAGE_LIMIT,
      estimatedPages,
      outputFormat,
      accountingMetadata
    });

    if (!converted.ok) {
      await env.AICONVERTER_BUCKET.delete(sourceKey).catch(() => {});
      await updateJob(env, jobId, {
        status: "failed",
        error: converted.message,
        confidence: converted.confidence || 0,
        row_count: converted.rowCount || 0,
        source_deleted_at: new Date().toISOString(),
        extractor: converted.provider || ""
      });
      await safeRecordFunnelEvent(env, request, {
        ...baseFunnelEvent,
        eventType: "preview_error",
        jobId,
        pageBucket: pageBucketForEstimate(estimatedPages),
        errorCode: "preview_failed"
      });

      return json({
        status: "failed",
        jobId,
        token,
        message: converted.message,
        confidence: converted.confidence || 0,
        rowCount: converted.rowCount || 0,
        columns: converted.columns || [],
        converterId,
        outputFormat,
        sourceDeletedAt: new Date().toISOString(),
        resultExpiresAt: expiresAt,
        plan
      });
    }

    await env.AICONVERTER_BUCKET.put(previewKey, converted.csv, {
      httpMetadata: { contentType: "text/csv; charset=utf-8" },
      customMetadata: {
        jobId,
        purpose: "preview-csv",
        deleteAfter: expiresAt
      }
    });

    await updateJob(env, jobId, {
      status: "preview_ready",
      preview_key: previewKey,
      confidence: converted.confidence,
      row_count: converted.rowCount,
      extractor: converted.provider || ""
    });
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_success",
      jobId,
      pageBucket: pageBucketForEstimate(estimatedPages)
    });

    return json({
      status: "preview_ready",
      jobId,
      token,
      plan,
      converterId,
      outputFormat,
      columns: converted.columns || [],
      previewRows: converted.previewRows,
      confidence: converted.confidence,
      rowCount: converted.rowCount,
      ...retentionFields({ created_at: now, expires_at: expiresAt }),
      message: `Preview ready. Pay once to run the full extraction and download the ${outputFormatLabel(outputFormat)}.`
    });
  } catch (error) {
    await env.AICONVERTER_BUCKET.delete(sourceKey).catch(() => {});
    await updateJob(env, jobId, {
      status: "failed",
      error: "The converter could not safely process this file.",
      source_deleted_at: new Date().toISOString()
    });
    await safeRecordFunnelEvent(env, request, {
      ...baseFunnelEvent,
      eventType: "preview_error",
      jobId,
      pageBucket: pageBucketForEstimate(estimatedPages),
      errorCode: "preview_failed"
    });

    return json(
      {
        status: "failed",
        jobId,
        token,
        plan,
        sourceDeletedAt: new Date().toISOString(),
        resultExpiresAt: expiresAt,
        message: error?.message || "The converter could not safely process this file.",
        confidence: 0,
        rowCount: 0
      },
      { status: 200 }
    );
  }
}

async function safeRecordFunnelEvent(env, request, event) {
  await recordFunnelEvent(env, request, event).catch(() => {});
}

function inputKindForUpload(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|heic|avif)$/i.test(name)) return "image";
  if (type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return "audio";
  if (type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(name)) return "video";
  if (/\.(zip|7z|tar|rar)$/i.test(name)) return "archive";
  if (/\.(docx?|xlsx?|pptx?|csv|txt|md|rtf|html?)$/i.test(name)) return "document";
  return "other";
}

function fileSizeBucketForUpload(file) {
  const size = Number(file?.size || 0);
  if (!size) return "";
  if (size < 1024 * 1024) return "under_1mb";
  if (size < 5 * 1024 * 1024) return "1_5mb";
  if (size < 25 * 1024 * 1024) return "5_25mb";
  if (size <= 50 * 1024 * 1024) return "25_50mb";
  return "over_50mb";
}

function pageBucketForEstimate(count) {
  const value = Number(count || 0);
  if (!value) return "";
  if (value <= 5) return "1_5";
  if (value <= 25) return "6_25";
  if (value <= 100) return "26_100";
  if (value <= 500) return "101_500";
  return "over_500";
}

function outputFormatLabel(format) {
  const labels = {
    csv: "CSV",
    "quickbooks-csv": "QuickBooks CSV",
    "xero-csv": "Xero CSV",
    "wave-csv": "Wave CSV",
    "gnucash-csv": "GnuCash CSV",
    qif: "QIF",
    ofx: "OFX",
    qbo: "QBO",
    json: "JSON",
    txt: "TXT transcript",
    md: "Markdown",
    html: "HTML",
    pdf: "PDF",
    docx: "DOCX",
    xlsx: "XLSX",
    pptx: "PPTX",
    png: "PNG",
    jpg: "JPG",
    webp: "WEBP",
    gif: "GIF",
    svg: "SVG",
    mp3: "MP3",
    wav: "WAV",
    m4a: "M4A",
    ogg: "OGG",
    flac: "FLAC",
    mp4: "MP4",
    webm: "WEBM",
    mov: "MOV",
    zip: "ZIP",
    "7z": "7Z",
    tar: "TAR"
  };
  return labels[format] || "converted file";
}
