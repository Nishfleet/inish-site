import { badRequest, json, methodNotAllowed, serverError, withSecurityHeaders } from "../lib/http.js";
import { bankDownloadFileName, bankOutputContentType } from "../lib/accounting-exports.js";
import { getAuthorizedJob, hasRequiredBindings, jobOutputFormat, outputFormatFromResultKey, tokenFromBodyOrCookie, updateJob } from "../lib/jobs.js";
import { contentTypeForOutputFormat, isUniversalConverter } from "../lib/universal.js";

export async function onRequestPost(context) {
  return handleDownload(context);
}

export function onRequestGet() {
  return methodNotAllowed("POST");
}

async function handleDownload({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const credentials = await downloadCredentials(request);
  const token = tokenFromBodyOrCookie(request, credentials.jobId, credentials.token);
  const job = await getAuthorizedJob(env, credentials.jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");
  if (job.status !== "complete") return badRequest("The conversion is not complete.");

  const freeDownloads = env.FREE_DOWNLOADS_ENABLED === "true";
  if (!job.paid_at && !freeDownloads) {
    return json({ error: "Payment is required before downloading the full file." }, { status: 402 });
  }

  const object = await env.AICONVERTER_BUCKET.get(job.result_key);
  if (!object) {
    await updateJob(env, job.id, {
      status: "expired",
      error: "The converted file has expired."
    }).catch(() => {});
    return badRequest("The converted file has expired.");
  }

  await updateJob(env, job.id, {
    download_count: Number(job.download_count || 0) + 1
  }).catch(() => {});

  return withSecurityHeaders(
    new Response(object.body, {
      headers: {
        "Content-Type": contentTypeForJob(job),
        "Content-Disposition": `attachment; filename="${downloadFileName(job)}"`,
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, noarchive, nosnippet"
      }
    })
  );
}

function downloadFileName(job) {
  const selectedFormat = jobOutputFormat(job);
  if (job.converter_id === "bank") return bankDownloadFileName(selectedFormat, job.original_file_name || "bank-statement");
  const extension = outputFormatFromResultKey(job.result_key);
  let prefix = "bank-statement";
  if (job.converter_id === "audio-transcript") prefix = "audio-transcript";
  if (job.converter_id === "document-markdown") prefix = "document-markdown";
  if (job.converter_id === "screenshot-code") prefix = "screenshot-html";
  if (job.converter_id === "invoice") prefix = "invoice";
  if (job.converter_id === "receipt") prefix = "receipt-expense";
  if (job.converter_id === "screenshot") prefix = "screenshot-table";
  if (isUniversalConverter(job.converter_id)) prefix = "converted-file";
  return `aiconverter-${prefix}.${extension}`;
}

function contentTypeForJob(job) {
  if (job.converter_id === "bank") return bankOutputContentType(jobOutputFormat(job));
  const format = outputFormatFromResultKey(job.result_key);
  if (format === "json") return "application/json; charset=utf-8";
  if (format === "txt") return "text/plain; charset=utf-8";
  if (format === "md") return "text/markdown; charset=utf-8";
  if (format === "html") return "text/html; charset=utf-8";
  if (isUniversalConverter(job.converter_id)) return contentTypeForOutputFormat(format);
  return "text/csv; charset=utf-8";
}

async function downloadCredentials(request) {
  const url = new URL(request.url);
  const authorization = request.headers.get("Authorization") || "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const headerJobId = request.headers.get("X-AIConverter-Job-Id") || request.headers.get("X-Job-Id") || "";

  const body = await readDownloadBody(request);
  return {
    jobId: String(body.jobId || url.searchParams.get("jobId") || headerJobId || ""),
    token: String(body.token || bearerToken || "")
  };
}

async function readDownloadBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return request.json().catch(() => ({}));
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return Object.fromEntries((await request.formData()).entries());
  }
  return {};
}
