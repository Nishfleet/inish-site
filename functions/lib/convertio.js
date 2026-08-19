import { requestDodoRefund } from "./dodo.js";
import { jobOutputFormat, updateJob } from "./jobs.js";
import {
  contentTypeForOutputFormat,
  UNIVERSAL_COLUMNS,
  universalOutputLabel,
  universalPreviewRow
} from "./universal.js";

const CONVERTIO_API_BASE = "https://api.convertio.co";
const DEFAULT_DAILY_JOB_LIMIT = 10;

export function hasConvertioConfig(env) {
  return Boolean(String(env.CONVERTIO_API_KEY || "").trim());
}

export function convertioDailyJobLimit(env) {
  return boundedNumber(env.CONVERTIO_DAILY_JOB_LIMIT, DEFAULT_DAILY_JOB_LIMIT, 0, 10000);
}

export async function convertioUsageToday(env) {
  const startedAt = startOfUtcDay();
  const empty = { started: 0, jobsStarted: 0, reserved: 0, complete: 0, failed: 0, converting: 0, startedAt };
  if (!env.AICONVERTER_DB?.prepare) return empty;

  try {
    const row = await env.AICONVERTER_DB.prepare(
      `SELECT
         COUNT(*) AS started,
         COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
         COALESCE(SUM(CASE WHEN status = 'converting_full' THEN 1 ELSE 0 END), 0) AS converting
       FROM jobs
       WHERE external_provider = 'convertio'
         AND COALESCE(external_job_id, '') != ''
         AND created_at >= ?`
    )
      .bind(startedAt)
      .first();
    const counter = await env.AICONVERTER_DB.prepare("SELECT count FROM rate_limits WHERE id = ?")
      .bind(convertioDailyCounterId(startedAt))
      .first();
    const jobsStarted = numberOrZero(row?.started);
    const reserved = numberOrZero(counter?.count);

    return {
      started: Math.max(jobsStarted, reserved),
      jobsStarted,
      reserved,
      complete: numberOrZero(row?.complete),
      failed: numberOrZero(row?.failed),
      converting: numberOrZero(row?.converting),
      startedAt
    };
  } catch (error) {
    return { ...empty, error: error?.message || "Convertio usage query failed." };
  }
}

export async function startConvertioConversion(env, job, arrayBuffer) {
  if (!hasConvertioConfig(env)) {
    return {
      ok: false,
      message: "This conversion option is not ready yet.",
      confidence: 0,
      rowCount: 0,
      provider: "convertio"
    };
  }

  const limit = convertioDailyJobLimit(env);
  const reservation = await reserveConvertioDailySlot(env, limit);
  if (!reservation.ok) {
    return {
      ok: false,
      message: reservation.message,
      confidence: 0,
      rowCount: 0,
      provider: "convertio"
    };
  }

  const fileName = job.original_file_name || "source.bin";
  const outputFormat = jobOutputFormat(job);
  const conversion = await convertioRequest("/convert", {
    method: "POST",
    body: JSON.stringify({
      apikey: env.CONVERTIO_API_KEY,
      input: "upload",
      filename: fileName,
      outputformat: outputFormat
    })
  });
  const conversionId = conversion?.data?.id || conversion?.id;
  if (!conversionId) throw new Error("Conversion did not start cleanly.");

  const upload = await fetch(`${CONVERTIO_API_BASE}/convert/${encodeURIComponent(conversionId)}/${encodeURIComponent(fileName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": job.input_mime_type || "application/octet-stream"
    },
    body: arrayBuffer
  });
  const uploadPayload = await upload.json().catch(() => ({}));
  if (!upload.ok || uploadPayload.status === "error") {
    throw new Error(uploadPayload?.error || `Conversion upload failed (${upload.status}).`);
  }

  await updateJob(env, job.id, {
    status: "converting_full",
    extractor: "convertio",
    external_provider: "convertio",
    external_job_id: String(conversionId),
    external_task_id: uploadPayload?.data?.file || fileName,
    external_status: "upload",
    external_updated_at: new Date().toISOString()
  });

  return pendingResult({
    ...job,
    external_provider: "convertio",
    external_job_id: String(conversionId),
    external_status: "upload"
  });
}

export async function refreshConvertioConversion(env, job) {
  if (!job?.external_job_id) return { ok: false, message: "No conversion job is attached." };
  if (!hasConvertioConfig(env)) {
    return failConvertioJob(env, job, "This conversion option is temporarily unavailable.");
  }

  const status = await convertioRequest(`/convert/${encodeURIComponent(job.external_job_id)}/status`);
  const data = status?.data || {};
  await updateJob(env, job.id, {
    external_status: data.step || status.status || "",
    external_updated_at: new Date().toISOString()
  }).catch(() => {});

  if (data.step !== "finish") {
    return pendingResult(job, data.step || "convert");
  }

  const outputFormat = jobOutputFormat(job);
  const resultBuffer = await downloadConvertioResult(env, job, data.output?.url || "");
  const contentType = contentTypeForOutputFormat(outputFormat);

  await env.AICONVERTER_BUCKET.put(job.result_key, resultBuffer, {
    httpMetadata: { contentType },
    customMetadata: {
      jobId: job.id,
      purpose: `result-${outputFormat}`,
      provider: "convertio",
      deleteAfter: job.expires_at
    }
  });

  const row = {
    ...universalPreviewRow(job.original_file_name || "source", job.input_mime_type || "", outputFormat, "Complete"),
    status: "Ready to download"
  };

  await updateJob(env, job.id, {
    status: "complete",
    confidence: 0.9,
    row_count: 1,
    completed_at: new Date().toISOString(),
    extractor: "convertio",
    external_status: "finish",
    external_result_name: "",
    external_result_url: "",
    external_updated_at: new Date().toISOString()
  });

  await deleteConvertioFile(env, job.external_job_id).catch(() => {});

  return {
    ok: true,
    status: "complete",
    previewRows: [row],
    columns: UNIVERSAL_COLUMNS,
    confidence: 0.9,
    rowCount: 1,
    outputFormat,
    provider: "convertio"
  };
}

async function downloadConvertioResult(env, job, outputUrl) {
  if (outputUrl) {
    const response = await fetch(outputUrl);
    if (response.ok) return response.arrayBuffer();
  }

  const payload = await convertioRequest(`/convert/${encodeURIComponent(job.external_job_id)}/dl/base64`);
  const content = payload?.data?.content || "";
  if (!content) throw new Error("Conversion finished without a downloadable file.");
  return base64ToArrayBuffer(content);
}

async function failConvertioJob(env, job, message) {
  await deleteConvertioFile(env, job.external_job_id).catch(() => {});
  await env.AICONVERTER_BUCKET.delete(job.source_key).catch(() => {});
  const refund = job.paid_at
    ? await requestDodoRefund(env, job, message, { cashRefund: Number(job.download_count || 0) === 0 })
    : { status: "", refundId: "" };
  await updateJob(env, job.id, {
    status: "failed",
    error: message,
    confidence: 0,
    row_count: 0,
    source_deleted_at: new Date().toISOString(),
    refund_status: refund.status || job.refund_status || "",
    refund_id: refund.refundId || job.refund_id || "",
    external_status: "failed",
    external_updated_at: new Date().toISOString()
  });
  return {
    ok: false,
    status: "failed",
    message,
    confidence: 0,
    rowCount: 0,
    refundStatus: refund.status || ""
  };
}

function pendingResult(job, status = "convert") {
  const outputFormat = jobOutputFormat(job);
  return {
    ok: true,
    pending: true,
    status: "converting_full",
    previewRows: [
      {
        ...universalPreviewRow(job.original_file_name || "source", job.input_mime_type || "", outputFormat, "Converting"),
        route: "Converting",
        status: status === "wait" || status === "upload" ? "Queued" : "Converting"
      }
    ],
    columns: UNIVERSAL_COLUMNS,
    confidence: 0.88,
    rowCount: 1,
    outputFormat,
    provider: "convertio",
    message: `${universalOutputLabel(outputFormat)} conversion is running. This page will update automatically.`
  };
}

async function reserveConvertioDailySlot(env, limit) {
  if (limit <= 0) return { ok: true, count: 0, remainingToday: null };
  const windowStart = startOfUtcDay();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.parse(windowStart) + 48 * 60 * 60 * 1000).toISOString();
  const id = convertioDailyCounterId(windowStart);

  try {
    const row = await env.AICONVERTER_DB.prepare(
      `INSERT INTO rate_limits (id, window_start, count, expires_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET count = count + 1, expires_at = ?, updated_at = ?
       WHERE count < ?
       RETURNING count`
    )
      .bind(id, windowStart, expiresAt, now, expiresAt, now, limit)
      .first();

    if (row?.count) {
      const count = numberOrZero(row.count);
      return { ok: true, count, remainingToday: Math.max(0, limit - count) };
    }

    const current = await env.AICONVERTER_DB.prepare("SELECT count FROM rate_limits WHERE id = ?").bind(id).first();
    const count = numberOrZero(current?.count);
    return {
      ok: false,
      count,
      remainingToday: 0,
      message: `Conversion daily cap reached (${count}/${limit}).`
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      remainingToday: 0,
      message: `Conversion daily cap reservation failed: ${error?.message || "unknown error"}`
    };
  }
}

async function deleteConvertioFile(env, id) {
  if (!id) return;
  await fetch(`${CONVERTIO_API_BASE}/convert/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

async function convertioRequest(path, init = {}) {
  const response = await fetch(`${CONVERTIO_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === "error") {
    throw new Error(payload?.error || `Conversion request failed (${response.status}).`);
  }
  return payload;
}

function base64ToArrayBuffer(content) {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function convertioDailyCounterId(windowStart) {
  return `convertio:daily:${String(windowStart || "").slice(0, 10)}`;
}
