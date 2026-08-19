import { badRequest, methodNotAllowed, serverError, withSecurityHeaders } from "../lib/http.js";
import { getAuthorizedJob, hasRequiredBindings, tokenFromBodyOrCookie } from "../lib/jobs.js";

export async function onRequestPost(context) {
  return handlePreviewDownload(context);
}

export function onRequestGet() {
  return methodNotAllowed("POST");
}

async function handlePreviewDownload({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const credentials = await previewCredentials(request);
  const token = tokenFromBodyOrCookie(request, credentials.jobId, credentials.token);
  const job = await getAuthorizedJob(env, credentials.jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");
  if (!["preview_ready", "converting_full", "complete"].includes(job.status)) {
    return badRequest("The free preview is not ready yet.");
  }
  if (!job.preview_key) return badRequest("The free preview is not available for this conversion.");

  const object = await env.AICONVERTER_BUCKET.get(job.preview_key);
  if (!object) return badRequest("The free preview has expired.");

  return withSecurityHeaders(
    new Response(object.body || (await object.arrayBuffer()), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${previewFileName(job)}"`,
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, noarchive, nosnippet"
      }
    })
  );
}

async function previewCredentials(request) {
  const url = new URL(request.url);
  const authorization = request.headers.get("Authorization") || "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const headerJobId = request.headers.get("X-AIConverter-Job-Id") || request.headers.get("X-Job-Id") || "";
  const body = await readPreviewBody(request);
  return {
    jobId: String(body.jobId || url.searchParams.get("jobId") || headerJobId || ""),
    token: String(body.token || bearerToken || "")
  };
}

async function readPreviewBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return request.json().catch(() => ({}));
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return Object.fromEntries((await request.formData()).entries());
  }
  return {};
}

function previewFileName(job) {
  const base = String(job.original_file_name || "conversion")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `aiconverter-${base || "conversion"}-preview.csv`;
}
