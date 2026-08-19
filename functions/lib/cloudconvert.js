import { requestDodoRefund } from "./dodo.js";
import { jobOutputFormat, updateJob } from "./jobs.js";
import {
  cloudConvertInputFormat,
  cloudConvertOutputFormat,
  contentTypeForOutputFormat,
  UNIVERSAL_COLUMNS,
  universalOutputLabel,
  universalPreviewRow
} from "./universal.js";

const CLOUDCONVERT_API_BASE = "https://api.cloudconvert.com/v2";
const DEFAULT_TASK_TIMEOUT_SECONDS = 900;
const DEFAULT_DAILY_JOB_LIMIT = 10;
const DEFAULT_MIN_CREDITS = 1;

export function hasCloudConvertConfig(env) {
  return Boolean(String(env.CLOUDCONVERT_API_KEY || "").trim());
}

export async function startCloudConvertConversion(env, job, arrayBuffer) {
  if (!hasCloudConvertConfig(env)) {
    return {
      ok: false,
      message: "Universal file conversion needs the CloudConvert API key before it can run.",
      confidence: 0,
      rowCount: 0,
      provider: "cloudconvert"
    };
  }

  if (job.external_job_id) {
    return pendingResult(job);
  }

  const guardrails = await assertCloudConvertGuardrails(env);
  if (!guardrails.ok) {
    return {
      ok: false,
      message: guardrails.message,
      confidence: 0,
      rowCount: 0,
      provider: "cloudconvert",
      guardrails
    };
  }

  const outputFormat = jobOutputFormat(job);
  const inputFormat = cloudConvertInputFormat(job.original_file_name || "");
  const timeout = Math.max(
    60,
    Math.min(7200, Number(env.CLOUDCONVERT_TASK_TIMEOUT_SECONDS || DEFAULT_TASK_TIMEOUT_SECONDS))
  );
  const tasks = {
    "upload-source": {
      operation: "import/upload"
    },
    "convert-file": {
      operation: "convert",
      input: "upload-source",
      output_format: cloudConvertOutputFormat(outputFormat),
      timeout
    },
    "export-result": {
      operation: "export/url",
      input: "convert-file",
      inline: false,
      archive_multiple_files: false
    }
  };
  if (inputFormat) tasks["convert-file"].input_format = inputFormat;

  const cloudJob = await cloudConvertRequest(env, "/jobs", {
    method: "POST",
    body: JSON.stringify({
      tasks,
      tag: job.id
    })
  });
  const uploadTask = findTask(cloudJob, "import/upload");
  const form = uploadTask?.result?.form;
  if (!form?.url || !form.parameters) {
    throw new Error("CloudConvert did not return an upload form.");
  }

  await uploadCloudConvertFile(form, arrayBuffer, job.original_file_name || "source.bin", job.input_mime_type || "");

  await updateJob(env, job.id, {
    status: "converting_full",
    extractor: "cloudconvert",
    external_provider: "cloudconvert",
    external_job_id: cloudJob.id || "",
    external_task_id: uploadTask.id || "",
    external_status: cloudJob.status || "processing",
    external_updated_at: new Date().toISOString()
  });

  return pendingResult({
    ...job,
    external_job_id: cloudJob.id || "",
    external_status: cloudJob.status || "processing"
  });
}

export async function refreshCloudConvertConversion(env, job) {
  if (!job?.external_job_id) return { ok: false, message: "No provider job is attached to this conversion." };
  if (!hasCloudConvertConfig(env)) {
    return failCloudConvertJob(env, job, "CloudConvert API key is missing while a paid conversion is pending.");
  }

  const cloudJob = await cloudConvertRequest(env, `/jobs/${encodeURIComponent(job.external_job_id)}`);
  await updateJob(env, job.id, {
    external_status: cloudJob.status || "",
    external_updated_at: new Date().toISOString()
  }).catch(() => {});

  if (["waiting", "processing"].includes(cloudJob.status)) return pendingResult(job, cloudJob.status);
  if (cloudJob.status !== "finished") {
    return failCloudConvertJob(env, job, cloudConvertErrorMessage(cloudJob));
  }

  const exportTask = findTask(cloudJob, "export/url");
  const resultFile = exportTask?.result?.files?.[0];
  if (!resultFile?.url) {
    return failCloudConvertJob(env, job, "CloudConvert finished without an exported file.");
  }

  const fileResponse = await fetch(resultFile.url);
  if (!fileResponse.ok) {
    return failCloudConvertJob(env, job, `CloudConvert export download failed (${fileResponse.status}).`);
  }

  const outputFormat = jobOutputFormat(job);
  const contentType = fileResponse.headers.get("Content-Type") || contentTypeForOutputFormat(outputFormat);
  const resultBuffer = await fileResponse.arrayBuffer();

  await env.AICONVERTER_BUCKET.put(job.result_key, resultBuffer, {
    httpMetadata: { contentType },
    customMetadata: {
      jobId: job.id,
      purpose: `result-${outputFormat}`,
      provider: "cloudconvert",
      deleteAfter: job.expires_at
    }
  });

  const row = {
    ...universalPreviewRow(job.original_file_name || "source", job.input_mime_type || "", outputFormat),
    status: "Ready to download"
  };

  await updateJob(env, job.id, {
    status: "complete",
    confidence: 0.92,
    row_count: 1,
    completed_at: new Date().toISOString(),
    extractor: "cloudconvert",
    external_status: "finished",
    external_result_name: resultFile.filename || "",
    external_result_url: "",
    external_updated_at: new Date().toISOString()
  });

  return {
    ok: true,
    status: "complete",
    previewRows: [row],
    columns: UNIVERSAL_COLUMNS,
    confidence: 0.92,
    rowCount: 1,
    outputFormat,
    provider: "cloudconvert"
  };
}

export async function failCloudConvertJob(env, job, message) {
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

export function cloudConvertDailyJobLimit(env) {
  return boundedNumber(env.CLOUDCONVERT_DAILY_JOB_LIMIT, DEFAULT_DAILY_JOB_LIMIT, 0, 10000);
}

export function cloudConvertMinimumCredits(env) {
  return boundedNumber(env.CLOUDCONVERT_MIN_CREDITS, DEFAULT_MIN_CREDITS, 0, 1000000);
}

export function cloudConvertRequiresCreditCheck(env) {
  return String(env.CLOUDCONVERT_REQUIRE_CREDIT_CHECK || "true").toLowerCase() !== "false";
}

export async function cloudConvertUsageToday(env) {
  const startedAt = startOfUtcDay();
  const empty = { started: 0, complete: 0, failed: 0, converting: 0, startedAt };
  if (!env.AICONVERTER_DB?.prepare) return empty;

  try {
    const row = await env.AICONVERTER_DB.prepare(
      `SELECT
         COUNT(*) AS started,
         COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
         COALESCE(SUM(CASE WHEN status = 'converting_full' THEN 1 ELSE 0 END), 0) AS converting
       FROM jobs
       WHERE external_provider = 'cloudconvert'
         AND COALESCE(external_job_id, '') != ''
         AND created_at >= ?`
    )
      .bind(startedAt)
      .first();

    const counter = await env.AICONVERTER_DB.prepare("SELECT count FROM rate_limits WHERE id = ?")
      .bind(cloudConvertDailyCounterId(startedAt))
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
    return { ...empty, error: error?.message || "CloudConvert usage query failed." };
  }
}

export async function getCloudConvertAccount(env) {
  if (!hasCloudConvertConfig(env)) return { ok: false, configured: false, message: "CloudConvert API key is missing." };

  try {
    const account = await cloudConvertRequest(env, "/users/me");
    return {
      ok: true,
      configured: true,
      id: String(account.id || ""),
      credits: numericOrNull(account.credits),
      creditsUsed: numericOrNull(account.credits_used),
      username: account.username ? String(account.username) : "",
      emailDomain: emailDomain(account.email)
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error?.message || "CloudConvert account check failed."
    };
  }
}

export async function assertCloudConvertGuardrails(env) {
  if (!hasCloudConvertConfig(env)) {
    return { ok: false, message: "CloudConvert API key is missing." };
  }

  const limit = cloudConvertDailyJobLimit(env);
  const minimumCredits = cloudConvertMinimumCredits(env);
  const requireCreditCheck = cloudConvertRequiresCreditCheck(env);
  const [usage, account] = await Promise.all([cloudConvertUsageToday(env), getCloudConvertAccount(env)]);
  const remainingToday = limit > 0 ? Math.max(0, limit - usage.started) : null;

  if (usage.error) {
    return {
      ok: false,
      message: `CloudConvert usage check failed: ${usage.error}`,
      limit,
      remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage,
      account
    };
  }

  if (limit > 0 && usage.started >= limit) {
    return {
      ok: false,
      message: `CloudConvert daily cap reached (${usage.started}/${limit}).`,
      limit,
      remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage,
      account
    };
  }

  if (account.ok && account.credits !== null && account.credits <= minimumCredits) {
    return {
      ok: false,
      message: `CloudConvert credits are at or below the reserve (${account.credits}/${minimumCredits}).`,
      limit,
      remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage,
      account
    };
  }

  if (account.ok && account.credits === null && requireCreditCheck) {
    return {
      ok: false,
      message: "CloudConvert credit check did not return a credit balance.",
      limit,
      remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage,
      account
    };
  }

  if (!account.ok && requireCreditCheck) {
    return {
      ok: false,
      message: `CloudConvert credit check failed: ${account.message || "unknown error"}`,
      limit,
      remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage,
      account
    };
  }

  const reservation = await reserveCloudConvertDailySlot(env, limit);
  if (!reservation.ok) {
    return {
      ok: false,
      message: reservation.message,
      limit,
      remainingToday: reservation.remainingToday,
      minimumCredits,
      requireCreditCheck,
      usage: { ...usage, started: Math.max(usage.started, reservation.count || 0) },
      account
    };
  }

  return {
    ok: true,
    message: "",
    limit,
    remainingToday: reservation.remainingToday,
    minimumCredits,
    requireCreditCheck,
    usage: { ...usage, started: Math.max(usage.started, reservation.count || 0), reserved: reservation.count || usage.reserved || 0 },
    account
  };
}

async function reserveCloudConvertDailySlot(env, limit) {
  if (limit <= 0) return { ok: true, count: 0, remainingToday: null };
  const windowStart = startOfUtcDay();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.parse(windowStart) + 48 * 60 * 60 * 1000).toISOString();
  const id = cloudConvertDailyCounterId(windowStart);

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
      message: `CloudConvert daily cap reached (${count}/${limit}).`
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      remainingToday: 0,
      message: `CloudConvert daily cap reservation failed: ${error?.message || "unknown error"}`
    };
  }
}

function pendingResult(job, status = "processing") {
  const outputFormat = jobOutputFormat(job);
  return {
    ok: true,
    pending: true,
    status: "converting_full",
    previewRows: [
      {
        ...universalPreviewRow(job.original_file_name || "source", job.input_mime_type || "", outputFormat),
        status: status === "waiting" ? "Queued" : "Converting"
      }
    ],
    columns: UNIVERSAL_COLUMNS,
    confidence: 0.9,
    rowCount: 1,
    outputFormat,
    provider: "cloudconvert",
    message: `${universalOutputLabel(outputFormat)} conversion is running. This page will update automatically.`
  };
}

async function cloudConvertRequest(env, path, init = {}) {
  const response = await fetch(`${CLOUDCONVERT_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CLOUDCONVERT_API_KEY}`,
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const detail = payload?.message || payload?.errors?.[0]?.message || `CloudConvert request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload.data || payload;
}

async function uploadCloudConvertFile(form, arrayBuffer, fileName, contentType) {
  const body = new FormData();
  for (const [key, value] of Object.entries(form.parameters || {})) {
    body.append(key, String(value));
  }
  body.append(
    "file",
    new Blob([arrayBuffer], { type: contentType || "application/octet-stream" }),
    fileName
  );

  const response = await fetch(form.url, {
    method: "POST",
    body
  });
  if (!response.ok) throw new Error(`CloudConvert upload failed (${response.status}).`);
}

function findTask(job, operation) {
  return (job.tasks || []).find((task) => task.operation === operation);
}

function cloudConvertErrorMessage(job) {
  const failed = (job.tasks || []).find((task) => task.status === "error" || task.message || task.code);
  return failed?.message || failed?.code || "CloudConvert could not complete this conversion.";
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

function numericOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emailDomain(email) {
  const parts = String(email || "").split("@");
  return parts.length === 2 ? parts[1] : "";
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function cloudConvertDailyCounterId(windowStart) {
  return `cloudconvert:daily:${String(windowStart || "").slice(0, 10)}`;
}
