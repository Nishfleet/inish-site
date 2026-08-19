import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { buildConversionBrief } from "../lib/conversion-brief.js";
import { getAuthorizedJob, hasRequiredBindings, tokenFromBodyOrCookie } from "../lib/jobs.js";

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid conversion brief request.");
  }

  const jobId = String(body.jobId || "");
  const bodyToken = String(body.token || "");
  const token = tokenFromBodyOrCookie(request, jobId, bodyToken);
  const job = await getAuthorizedJob(env, jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");

  return json(buildConversionBrief(job, { paymentEvent: await latestPaymentEvent(env, job.id) }));
}

export function onRequestGet() {
  return methodNotAllowed("POST");
}

async function latestPaymentEvent(env, jobId) {
  if (!env?.AICONVERTER_DB || !jobId) return null;
  try {
    return await env.AICONVERTER_DB.prepare(
      `SELECT event_type, status, match_status, created_at
       FROM dodo_payment_events
       WHERE job_id = ?
         AND COALESCE(match_status, '') IN ('', 'matched')
       ORDER BY created_at DESC
       LIMIT 1`
    )
      .bind(jobId)
      .first();
  } catch {
    return null;
  }
}
