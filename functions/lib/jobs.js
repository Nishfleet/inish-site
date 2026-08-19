import {
  assertUniversalSignature,
  isUniversalConverter,
  normalizeUniversalOutputFormat,
  UNIVERSAL_ACCEPTED_EXTENSIONS,
  UNIVERSAL_ACCEPTED_TYPES,
  UNIVERSAL_CONVERTER_ID,
  UNIVERSAL_MAX_FILE_BYTES
} from "./universal.js";
import { normalizeBankOutputFormat } from "./accounting-exports.js";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SCREENSHOT_CODE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PAGE_COUNT = 500;
export const PREVIEW_PAGE_LIMIT = 3;
export const SOURCE_RETENTION_SECONDS = 24 * 60 * 60;
export const RESULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_CSV_COLUMNS = ["date", "description", "money_in", "money_out", "balance", "page", "confidence"];

const MIN_RATE_LIMIT_SALT_LENGTH = 24;
const BLOCKED_RATE_LIMIT_SALTS = new Set(["aiconverter", "change-me", "changeme", "secret", "password"]);

let runtimeRateLimitSalt = "";

export const PLANS = {
  starter: { id: "starter", name: "Starter", price: "₹399", amount: 39900, currency: "INR", pages: 25 },
  batch: { id: "batch", name: "Standard", price: "₹799", amount: 79900, currency: "INR", pages: 100 },
  pro: { id: "pro", name: "Bulk", price: "₹1,399", amount: 139900, currency: "INR", pages: 500 }
};

export function planForPages(pages) {
  const normalized = Number.isFinite(pages) ? pages : 25;
  if (normalized <= 25) return PLANS.starter;
  if (normalized <= 100) return PLANS.batch;
  return PLANS.pro;
}

export function sourceAvailableForRedo(job) {
  if (!job || job.source_deleted_at) return false;
  const createdAt = Date.parse(job.created_at || "");
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt < SOURCE_RETENTION_SECONDS * 1000;
}

export function sourceExpiresAt(job) {
  if (!job || job.source_deleted_at) return "";
  const createdAt = Date.parse(job.created_at || "");
  if (!Number.isFinite(createdAt)) return "";
  return new Date(createdAt + SOURCE_RETENTION_SECONDS * 1000).toISOString();
}

export function retentionFields(job) {
  return {
    sourceExpiresAt: sourceExpiresAt(job),
    resultExpiresAt: job?.expires_at || "",
    sourceDeletedAt: job?.source_deleted_at || ""
  };
}

export function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return digestToHex(digest);
}

export async function sha256Bytes(arrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return digestToHex(digest);
}

function digestToHex(digest) {
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeFileName(name = "statement.pdf") {
  const base = String(name).split(/[\\/]/).pop() || "statement.pdf";
  return base.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 80) || "statement.pdf";
}

export function hasRequiredBindings(env) {
  return Boolean(env.AICONVERTER_BUCKET && env.AICONVERTER_DB);
}

export function hasExtractorBinding(env) {
  return Boolean(hasMistralConfig(env) || hasAzureConfig(env) || env.AI);
}

export function hasMistralConfig(env) {
  return Boolean(env.MISTRAL_API_KEY);
}

export function hasAzureConfig(env) {
  return Boolean(
    env.ENABLE_AZURE_FALLBACK === "true" &&
      env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
      env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  );
}

export function rateLimitSaltStatus(env) {
  const configured = String(env.RATE_LIMIT_SALT || "").trim();
  const normalized = configured.toLowerCase();
  if (
    configured.length >= MIN_RATE_LIMIT_SALT_LENGTH &&
    !BLOCKED_RATE_LIMIT_SALTS.has(normalized)
  ) {
    return { ok: true, salt: configured, warning: "" };
  }

  if (env.ALLOW_RUNTIME_RATE_LIMIT_SALT === "true") {
    if (!runtimeRateLimitSalt) runtimeRateLimitSalt = crypto.randomUUID();
    console.warn(
      "AIConverter RATE_LIMIT_SALT is missing or weak; using a runtime-only fallback. Configure RATE_LIMIT_SALT before production traffic."
    );
    return {
      ok: true,
      salt: runtimeRateLimitSalt,
      warning: "RATE_LIMIT_SALT is missing or weak; using a runtime-only fallback."
    };
  }

  return {
    ok: false,
    salt: "",
    warning: "RATE_LIMIT_SALT must be configured as a long random secret before uploads are enabled."
  };
}

export async function assertPdf(file, arrayBuffer) {
  if (!file) return "Choose a PDF file first.";
  if (file.size <= 0) return "The PDF is empty.";
  if (file.size > MAX_FILE_BYTES) return "This service accepts PDFs up to 50 MB.";

  const fileName = safeFileName(file.name);
  const looksLikePdfName = fileName.toLowerCase().endsWith(".pdf");
  const looksLikePdfType = !file.type || file.type === "application/pdf" || file.type === "application/octet-stream";
  if (!looksLikePdfName || !looksLikePdfType) return "Only bank statement PDFs are supported right now.";

  const signature = new TextDecoder().decode(arrayBuffer.slice(0, 5));
  if (signature !== "%PDF-") return "That file does not look like a valid PDF.";

  return "";
}

export function supportedConverters() {
  return {
    bank: {
      id: "bank",
      label: "Bank statement",
      sourcePrefix: "source",
      acceptedTypes: ["application/pdf"],
      acceptedExtensions: [".pdf"]
    },
    receipt: {
      id: "receipt",
      label: "Receipt",
      sourcePrefix: "receipt",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"]
    },
    screenshot: {
      id: "screenshot",
      label: "Screenshot table",
      sourcePrefix: "screenshot",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"]
    },
    invoice: {
      id: "invoice",
      label: "Invoice",
      sourcePrefix: "invoice",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"]
    },
    "audio-transcript": {
      id: "audio-transcript",
      label: "Audio transcript",
      sourcePrefix: "audio",
      acceptedTypes: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "audio/ogg",
        "audio/webm"
      ],
      acceptedExtensions: [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"],
      maxBytes: MAX_AUDIO_FILE_BYTES
    },
    "document-markdown": {
      id: "document-markdown",
      label: "Document Markdown",
      sourcePrefix: "document",
      acceptedTypes: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "text/html",
        "application/xml",
        "text/xml",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroenabled.12",
        "application/vnd.ms-excel.sheet.binary.macroenabled.12",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.apple.numbers"
      ],
      acceptedExtensions: [
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".html",
        ".htm",
        ".xml",
        ".csv",
        ".docx",
        ".xlsx",
        ".xlsm",
        ".xlsb",
        ".xls",
        ".et",
        ".ods",
        ".odt",
        ".numbers"
      ]
    },
    "screenshot-code": {
      id: "screenshot-code",
      label: "Screenshot to HTML",
      sourcePrefix: "screenshot-code",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
      maxBytes: MAX_SCREENSHOT_CODE_FILE_BYTES
    },
    [UNIVERSAL_CONVERTER_ID]: {
      id: UNIVERSAL_CONVERTER_ID,
      label: "Universal file",
      sourcePrefix: "universal",
      acceptedTypes: UNIVERSAL_ACCEPTED_TYPES,
      acceptedExtensions: UNIVERSAL_ACCEPTED_EXTENSIONS,
      maxBytes: UNIVERSAL_MAX_FILE_BYTES
    }
  };
}

export function normalizeOutputFormat(value, converterId = "bank") {
  const normalized = String(value || "").trim().toLowerCase();
  if (converterId === "bank") return normalizeBankOutputFormat(normalized);
  if (converterId === "invoice" && ["csv", "json"].includes(normalized)) return normalized;
  if (converterId === "audio-transcript" && ["txt", "json"].includes(normalized)) return normalized;
  if (converterId === "document-markdown") return "md";
  if (converterId === "screenshot-code") return "html";
  if (isUniversalConverter(converterId)) return normalizeUniversalOutputFormat(normalized);
  return "csv";
}

export function outputFormatFromResultKey(resultKey = "") {
  const match = String(resultKey || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1] || "csv";
  return ["csv", "json", "txt", "md", "html", "pdf", "docx", "xlsx", "pptx", "png", "jpg", "webp", "gif", "svg", "mp3", "wav", "m4a", "ogg", "flac", "mp4", "webm", "mov", "zip", "7z", "tar", "ofx", "qbo", "qif"].includes(extension) ? extension : "csv";
}

export function jobOutputFormat(job) {
  return job?.output_format || outputFormatFromResultKey(job?.result_key || "");
}

export function normalizeConverterId(value) {
  const id = String(value || "bank").trim().toLowerCase();
  return supportedConverters()[id] ? id : "bank";
}

export function assertSupportedUpload(file, arrayBuffer, converterId = "bank") {
  const converter = supportedConverters()[normalizeConverterId(converterId)];
  if (!file) return "Choose a file first.";
  if (file.size <= 0) return "The file is empty.";
  if (file.size > MAX_FILE_BYTES) return "This service accepts files up to 50 MB.";
  if (converter.maxBytes && file.size > converter.maxBytes) {
    return `${converter.label} conversion accepts files up to ${Math.floor(converter.maxBytes / 1024 / 1024)} MB.`;
  }

  const fileName = safeFileName(file.name).toLowerCase();
  const fileType = String(file.type || "application/octet-stream").toLowerCase();
  const hasAcceptedExtension = converter.acceptedExtensions.some((extension) => fileName.endsWith(extension));
  const hasAcceptedType =
    converter.acceptedTypes.includes(fileType) ||
    (!file.type && converter.acceptedExtensions.some((extension) => fileName.endsWith(extension))) ||
    fileType === "application/octet-stream";
  if (!hasAcceptedExtension || !hasAcceptedType) {
    return `${converter.label} conversion accepts ${converter.acceptedExtensions.join(", ")} files.`;
  }

  if (converter.id === "audio-transcript") return assertAudioSignature(fileName, arrayBuffer);
  if (converter.id === "document-markdown") return assertDocumentMarkdownSignature(fileName, fileType, arrayBuffer);
  if (converter.id === UNIVERSAL_CONVERTER_ID) return assertUniversalSignature(fileName, fileType, arrayBuffer);

  if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
    const signature = new TextDecoder().decode(arrayBuffer.slice(0, 5));
    return signature === "%PDF-" ? "" : "That file does not look like a valid PDF.";
  }

  const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return isPng || isJpeg || isWebp ? "" : "That image file type is not supported yet.";
}

function assertAudioSignature(fileName, arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
  const ascii = new TextDecoder("latin1").decode(arrayBuffer.slice(0, 16));
  const isMp3 = ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  const isWav = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
  const isMp4Audio = ascii.slice(4, 8) === "ftyp";
  const isAdtsAac = bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9);
  const isAdifAac = ascii.startsWith("ADIF");
  const isOgg = ascii.startsWith("OggS");
  const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const matched =
    (fileName.endsWith(".mp3") && isMp3) ||
    (fileName.endsWith(".wav") && isWav) ||
    (fileName.endsWith(".m4a") && isMp4Audio) ||
    (fileName.endsWith(".aac") && (isMp4Audio || isAdtsAac || isAdifAac)) ||
    (fileName.endsWith(".ogg") && isOgg) ||
    (fileName.endsWith(".webm") && isWebm);
  return matched ? "" : "That audio file type is not supported yet.";
}

function assertDocumentMarkdownSignature(fileName, fileType, arrayBuffer) {
  if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
    const signature = new TextDecoder().decode(arrayBuffer.slice(0, 5));
    return signature === "%PDF-" ? "" : "That file does not look like a valid PDF.";
  }

  const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
  const ascii = new TextDecoder("latin1").decode(arrayBuffer.slice(0, 512));
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if ([".png", ".jpg", ".jpeg", ".webp"].some((extension) => fileName.endsWith(extension))) {
    return isPng || isJpeg || isWebp ? "" : "That image file type is not supported yet.";
  }

  const textStart = ascii.trimStart().slice(0, 160).toLowerCase();
  if (fileName.endsWith(".svg")) return textStart.startsWith("<svg") || textStart.includes("<svg") ? "" : "That SVG file does not look valid.";
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    return textStart.startsWith("<!doctype html") || textStart.startsWith("<html") || textStart.includes("<body")
      ? ""
      : "That HTML file does not look valid.";
  }
  if (fileName.endsWith(".xml")) return textStart.startsWith("<?xml") || textStart.startsWith("<") ? "" : "That XML file does not look valid.";
  if (fileName.endsWith(".csv")) return looksTextLike(ascii) ? "" : "That CSV file does not look valid.";

  const isZipContainer = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isCompoundOffice =
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1;
  if ([".docx", ".xlsx", ".xlsm", ".xlsb", ".et", ".ods", ".odt", ".numbers"].some((extension) => fileName.endsWith(extension))) {
    return isZipContainer ? "" : "That document file does not look valid.";
  }
  if (fileName.endsWith(".xls")) return isCompoundOffice || isZipContainer ? "" : "That Excel file does not look valid.";

  return "";
}

function looksTextLike(text) {
  const sample = String(text || "").slice(0, 512);
  if (!sample.trim()) return false;
  const controlCount = [...sample].filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  }).length;
  return controlCount / sample.length < 0.05;
}

export function sourceObjectKey(jobId, fileName, converterId = "bank") {
  const converter = supportedConverters()[normalizeConverterId(converterId)];
  const extension = safeFileName(fileName).split(".").pop()?.toLowerCase() || "bin";
  return `sources/${jobId}/${converter.sourcePrefix}.${extension}`;
}

export async function insertJob(env, job) {
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO jobs (
      id, token_hash, status, plan_id, email, source_key, result_key,
      original_file_name, file_size, estimated_pages, file_hash, ip_hash,
      user_agent_hash, converter_id, input_mime_type, output_format, accounting_metadata_json,
      created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      job.id,
      job.tokenHash,
      job.status,
      job.planId,
      job.email || "",
      job.sourceKey,
      job.resultKey,
      job.originalFileName,
      job.fileSize,
      job.estimatedPages,
      job.fileHash || "",
      job.ipHash || "",
      job.userAgentHash || "",
      normalizeConverterId(job.converterId),
      job.inputMimeType || "",
      job.outputFormat || normalizeOutputFormat("", normalizeConverterId(job.converterId)),
      job.accountingMetadataJson || "",
      job.now,
      job.now,
      job.expiresAt
    )
    .run();
}

export async function requestFingerprint(env, request) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const saltStatus = rateLimitSaltStatus(env);
  const salt = saltStatus.ok ? saltStatus.salt : runtimeFallbackSalt();
  return {
    ipHash: await sha256(`${salt}:ip:${ip}`),
    userAgentHash: await sha256(`${salt}:ua:${ua.slice(0, 240)}`),
    saltWarning: saltStatus.warning
  };
}

export function estimatePdfPagesFromBytes(arrayBuffer) {
  try {
    const text = new TextDecoder("latin1").decode(arrayBuffer);
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches?.length || 0;
  } catch {
    return 0;
  }
}

export async function enforceUploadPolicy(env, { ipHash, fileHash }) {
  const now = new Date();
  const nowIso = now.toISOString();
  const dayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  await env.AICONVERTER_DB.prepare("DELETE FROM abuse_events WHERE expires_at < ?").bind(nowIso).run();

  const ipRow = await env.AICONVERTER_DB.prepare(
    "SELECT COUNT(*) AS count FROM abuse_events WHERE ip_hash = ? AND event_type = 'preview' AND created_at > ?"
  )
    .bind(ipHash, dayAgoIso)
    .first();
  if (Number(ipRow?.count || 0) >= 20) {
    return { ok: false, message: "Too many previews from this connection today. Try again later." };
  }

  const fileRow = await env.AICONVERTER_DB.prepare(
    "SELECT COUNT(*) AS count FROM abuse_events WHERE file_hash = ? AND event_type = 'preview' AND created_at > ?"
  )
    .bind(fileHash, dayAgoIso)
    .first();
  if (Number(fileRow?.count || 0) >= 2) {
    return { ok: false, message: "This file has already used its free preview window today." };
  }

  await env.AICONVERTER_DB.prepare(
    `INSERT INTO abuse_events (id, ip_hash, file_hash, event_type, created_at, expires_at)
     VALUES (?, ?, ?, 'preview', ?, ?)`
  )
    .bind(randomId("evt"), ipHash, fileHash, nowIso, expiresAt)
    .run();

  return { ok: true, message: "" };
}

export async function updateJob(env, id, fields) {
  const assignments = [];
  const values = [];

  Object.entries(fields).forEach(([key, value]) => {
    assignments.push(`${key} = ?`);
    values.push(value);
  });

  assignments.push("updated_at = ?");
  values.push(new Date().toISOString(), id);

  await env.AICONVERTER_DB.prepare(`UPDATE jobs SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function recordJobAttempt(env, { jobId, attemptType, status, error = "", metadata = {} }) {
  if (!env?.AICONVERTER_DB || !jobId || !attemptType || !status) return "";
  const now = new Date().toISOString();
  const id = randomId("attempt");
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO job_attempts (id, job_id, attempt_type, status, error, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      jobId,
      attemptType,
      status,
      String(error || "").slice(0, 1000),
      JSON.stringify(metadata || {}).slice(0, 4000),
      now,
      now
    )
    .run();
  return id;
}

export function sourceExpired(job, now = Date.now()) {
  if (!job || job.source_deleted_at) return false;
  const createdAt = Date.parse(job.created_at || "");
  if (!Number.isFinite(createdAt)) return false;
  return now - createdAt >= SOURCE_RETENTION_SECONDS * 1000;
}

export function resultExpired(job, now = Date.now()) {
  if (!job?.expires_at) return false;
  const expiresAt = Date.parse(job.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export async function enforceJobExpiry(env, job) {
  if (!job) return null;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const fields = {};

  if (resultExpired(job, now)) {
    const keys = new Set([job.source_key, job.preview_key, job.result_key].filter(Boolean));
    await Promise.all([...keys].map((key) => env.AICONVERTER_BUCKET.delete(key).catch(() => {})));
    fields.source_deleted_at = fields.source_deleted_at || job.source_deleted_at || nowIso;
    fields.status = "expired";
    fields.error = job.error || "This conversion has expired.";
    await updateJob(env, job.id, fields).catch(() => {});
    return null;
  }

  if (sourceExpired(job, now)) {
    if (job.source_key) await env.AICONVERTER_BUCKET.delete(job.source_key).catch(() => {});
    fields.source_deleted_at = nowIso;
  }

  if (Object.keys(fields).length) {
    await updateJob(env, job.id, fields).catch(() => {});
    return { ...job, ...fields };
  }

  return job;
}

export async function deleteJobData(env, job, now = new Date()) {
  if (!job?.id || !env?.AICONVERTER_BUCKET || !env?.AICONVERTER_DB) return null;
  const nowIso = now.toISOString();
  const keys = new Set(
    [job.source_key, job.preview_key, job.result_key, job.validation_report_key].filter(Boolean)
  );
  const outcomes = await Promise.all(
    [...keys].map(async (key) => {
      try {
        await env.AICONVERTER_BUCKET.delete(key);
        return { key, ok: true };
      } catch {
        return { key, ok: false };
      }
    })
  );
  const failedKeys = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.key);
  if (failedKeys.length > 0) {
    // Do NOT mark the job deleted and do NOT clear any object pointers: the
    // pointers are the only way a later delete retry or the expiry sweeper
    // (enforceJobExpiry / sourceExpired) can find and remove the objects.
    console.error(
      `AIConverter delete of job ${job.id} did not complete; R2 delete failed for keys: ${failedKeys.join(", ")}`
    );
    return { ...job, deletionCompleted: false, failedKeys };
  }
  const fields = {
    status: "deleted",
    source_deleted_at: job.source_deleted_at || nowIso,
    error: "Customer deleted this conversion.",
    source_key: "",
    preview_key: "",
    result_key: "",
    validation_report_key: ""
  };
  await updateJob(env, job.id, fields);
  return { ...job, ...fields, deletionCompleted: true };
}

export async function getAuthorizedJob(env, id, token) {
  if (!id || !token) return null;
  const tokenHash = await sha256(token);
  const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ? AND token_hash = ?")
    .bind(id, tokenHash)
    .first();
  return enforceJobExpiry(env, job || null);
}

export function jobAccessCookie(jobId, token, maxAgeSeconds = RESULT_RETENTION_SECONDS) {
  const value = `${encodeURIComponent(String(jobId || ""))}.${encodeURIComponent(String(token || ""))}`;
  return `__Host-aiconverter_job=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearJobAccessCookie() {
  return "__Host-aiconverter_job=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

export function tokenFromJobCookie(request, jobId) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)__Host-aiconverter_job=([^;]+)/);
  if (!match) return "";
  const [cookieJobId, cookieToken] = String(match[1] || "").split(".");
  try {
    const decodedJobId = decodeURIComponent(cookieJobId || "");
    const decodedToken = decodeURIComponent(cookieToken || "");
    return decodedJobId === String(jobId || "") ? decodedToken : "";
  } catch {
    return "";
  }
}

export function tokenFromBodyOrCookie(request, jobId, token = "") {
  return String(token || "") || tokenFromJobCookie(request, jobId);
}

export async function enforceRateLimit(env, request) {
  const saltStatus = rateLimitSaltStatus(env);
  if (!saltStatus.ok) {
    return {
      ok: false,
      limit: 0,
      configurationError: true,
      message: saltStatus.warning
    };
  }

  const max = Math.max(1, Math.min(100, Number(env.RATE_LIMIT_MAX_PER_HOUR || 8)));
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const windowId = windowStart.toISOString();
  const id = await sha256(`${saltStatus.salt}:${ip}:${windowId}`);
  const now = new Date().toISOString();
  const expiresAt = new Date(windowStart.getTime() + 2 * 60 * 60 * 1000).toISOString();

  await env.AICONVERTER_DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO rate_limits (id, window_start, count, expires_at, updated_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET count = count + 1, updated_at = ?`
  )
    .bind(id, windowId, expiresAt, now, now)
    .run();

  const row = await env.AICONVERTER_DB.prepare("SELECT count FROM rate_limits WHERE id = ?").bind(id).first();
  return {
    ok: Number(row?.count || 0) <= max,
    limit: max,
    warning: saltStatus.warning
  };
}

function runtimeFallbackSalt() {
  if (!runtimeRateLimitSalt) runtimeRateLimitSalt = crypto.randomUUID();
  console.warn(
    "AIConverter RATE_LIMIT_SALT is missing or weak outside the upload limiter; using runtime-only fingerprint salt."
  );
  return runtimeRateLimitSalt;
}

export function rowsToCsv(rows, columns = DEFAULT_CSV_COLUMNS) {
  const header = columns.map((column) => (typeof column === "string" ? column : column.key)).filter(Boolean);
  const lines = [header.join(",")];

  rows.forEach((row) => {
    lines.push(
      header
        .map((key) => {
          const value = row[key] ?? "";
          const text = String(value).replaceAll('"', '""');
          return /[",\n]/.test(text) ? `"${text}"` : text;
        })
        .join(",")
    );
  });

  return `${lines.join("\n")}\n`;
}

export function parseCsvPreview(csv, limit = 5) {
  return parseCsvContent(csv, limit).rows;
}

export function parseCsvContent(csv, limit = 5000) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines.shift()?.split(",") || [];
  const rows = lines.slice(0, limit).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] || "";
      return row;
    }, {});
  });
  return {
    columns: headers.map((header) => ({ key: header, label: header })),
    rows,
    totalRows: Math.max(0, lines.length),
    truncated: lines.length > limit
  };
}

export function parseStoredPreview(content, resultKey = "", limit = 5) {
  const format = outputFormatFromResultKey(resultKey);
  if (format === "csv") return parseCsvPreview(content, limit);
  if (["txt", "md", "html"].includes(format)) {
    return [{ preview: String(content || "").replace(/\s+/g, " ").trim().slice(0, 240) }];
  }
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.slice(0, limit);
    if (parsed?.invoice) return [parsed.invoice].slice(0, limit);
    if (parsed && typeof parsed === "object") return [parsed].slice(0, limit);
  } catch {}
  return [];
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}
