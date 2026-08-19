import { badRequest, methodNotAllowed, serverError, withSecurityHeaders } from "../lib/http.js";
import { getAuthorizedJob, hasRequiredBindings, tokenFromBodyOrCookie } from "../lib/jobs.js";

export async function onRequestPost(context) {
  return handleValidationReport(context);
}

export function onRequestGet() {
  return methodNotAllowed("POST");
}

async function handleValidationReport({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const credentials = await readCredentials(request);
  const token = tokenFromBodyOrCookie(request, credentials.jobId, credentials.token);
  const job = await getAuthorizedJob(env, credentials.jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");
  if (job.status !== "complete") return badRequest("The validation report is available after the full export is generated.");
  if (!job.validation_report_key) return badRequest("No validation report is attached to this conversion.");

  const object = await env.AICONVERTER_BUCKET.get(job.validation_report_key);
  if (!object) return badRequest("The validation report has expired.");

  return withSecurityHeaders(
    new Response(object.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFileName(job)}"`,
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, noarchive, nosnippet"
      }
    })
  );
}

async function readCredentials(request) {
  const body = await request.json().catch(() => ({}));
  return {
    jobId: String(body.jobId || ""),
    token: String(body.token || "")
  };
}

function reportFileName(job) {
  const stem = String(job.original_file_name || "bank-statement")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bank-statement";
  return `aiconverter-${stem}-validation-report.txt`;
}
