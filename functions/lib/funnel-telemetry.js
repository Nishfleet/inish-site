import { randomId, requestFingerprint } from "./jobs.js";

export const FUNNEL_EVENTS = new Set([
  "page_view",
  "file_selected",
  "output_selected",
  "turnstile_loaded",
  "turnstile_pass",
  "turnstile_fail",
  "preview_click",
  "preview_success",
  "preview_error",
  "free_sample_download",
  "free_sample_error",
  "checkout_click",
  "checkout_redirect",
  "checkout_error",
  "finalize_success",
  "finalize_error",
  "download_success",
  "download_error"
]);

const INPUT_KINDS = new Set(["", "pdf", "image", "audio", "video", "document", "archive", "other"]);
const SIZE_BUCKETS = new Set(["", "under_1mb", "1_5mb", "5_25mb", "25_50mb", "over_50mb"]);
const PAGE_BUCKETS = new Set(["", "1_5", "6_25", "26_100", "101_500", "over_500"]);
const TURNSTILE_STATES = new Set(["", "idle", "loading", "ready", "verified", "expired", "error"]);
const SAFE_ERROR_CODES = new Set([
  "",
  "blocked",
  "expired",
  "widget_error",
  "script_load",
  "missing_token",
  "verify_failed",
  "preview_failed",
  "ui_crash",
  "network_or_runtime",
  "http_400",
  "http_403",
  "http_413",
  "http_429",
  "http_500"
]);

const RETENTION_SECONDS = 30 * 24 * 60 * 60;

export function sanitizeFunnelEvent(input = {}) {
  const eventType = cleanToken(input.eventType || input.event_type, 48);
  if (!FUNNEL_EVENTS.has(eventType)) {
    return { ok: false, message: "Unknown funnel event." };
  }

  const errorCode = normalizeErrorCode(input.errorCode || input.error_code);
  return {
    ok: true,
    event: {
      id: randomId("funnel"),
      sessionId: cleanToken(input.sessionId || input.session_id, 80),
      jobId: cleanToken(input.jobId || input.job_id, 80),
      eventType,
      converterId: cleanToken(input.converterId || input.converter_id, 64),
      outputFormat: cleanToken(input.outputFormat || input.output_format, 32),
      inputKind: pickAllowed(input.inputKind || input.input_kind, INPUT_KINDS),
      fileSizeBucket: pickAllowed(input.fileSizeBucket || input.file_size_bucket, SIZE_BUCKETS),
      pageBucket: pickAllowed(input.pageBucket || input.page_bucket, PAGE_BUCKETS),
      fileCount: clampInt(input.fileCount ?? input.file_count, 0, 100),
      turnstileState: pickAllowed(input.turnstileState || input.turnstile_state, TURNSTILE_STATES),
      errorCode,
      routePath: cleanRoutePath(input.routePath || input.route_path)
    }
  };
}

export async function recordFunnelEvent(env, request, input = {}) {
  if (!env?.AICONVERTER_DB) return { ok: false, message: "Database is not configured." };
  const sanitized = sanitizeFunnelEvent(input);
  if (!sanitized.ok) return sanitized;

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + RETENTION_SECONDS * 1000).toISOString();
  const fingerprint = request ? await requestFingerprint(env, request) : { ipHash: "", userAgentHash: "" };
  const event = sanitized.event;

  try {
    await env.AICONVERTER_DB.prepare("DELETE FROM preview_funnel_events WHERE expires_at < ?").bind(nowIso).run();
    await env.AICONVERTER_DB.prepare(
      `INSERT INTO preview_funnel_events (
        id, session_id, job_id, event_type, converter_id, output_format, input_kind,
        file_size_bucket, page_bucket, file_count, turnstile_state, error_code,
        route_path, ip_hash, user_agent_hash, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        event.id,
        event.sessionId,
        event.jobId,
        event.eventType,
        event.converterId,
        event.outputFormat,
        event.inputKind,
        event.fileSizeBucket,
        event.pageBucket,
        event.fileCount,
        event.turnstileState,
        event.errorCode,
        event.routePath,
        fingerprint.ipHash || "",
        fingerprint.userAgentHash || "",
        nowIso,
        expiresAt
      )
      .run();
  } catch (error) {
    return { ok: false, message: error?.message || "Funnel event could not be recorded." };
  }

  return { ok: true, event };
}

function cleanToken(value, maxLength) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_./:-]/g, "")
    .slice(0, maxLength);
}

function cleanRoutePath(value) {
  const path = String(value || "/").split("?")[0].slice(0, 120);
  if (!path.startsWith("/")) return "/";
  return path.replace(/[^a-zA-Z0-9_./:-]/g, "") || "/";
}

function normalizeErrorCode(value) {
  const cleaned = cleanToken(value, 48);
  if (SAFE_ERROR_CODES.has(cleaned)) return cleaned;
  if (/^http_\d{3}$/.test(cleaned)) return cleaned;
  return cleaned ? "preview_failed" : "";
}

function pickAllowed(value, allowed) {
  const cleaned = cleanToken(value, 32);
  return allowed.has(cleaned) ? cleaned : "";
}

function clampInt(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
