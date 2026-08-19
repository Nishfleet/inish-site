import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { createDodoBatchCheckout } from "../lib/dodo.js";
import {
  getAuthorizedJob,
  hasRequiredBindings,
  planForPages,
  PLANS,
  randomId,
  tokenFromBodyOrCookie,
  updateJob
} from "../lib/jobs.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid batch checkout request.");
  }

  const items = Array.isArray(body.jobs) ? body.jobs.slice(0, 50) : [];
  if (items.length < 2) return badRequest("Choose at least two previewed files for batch checkout.");

  const jobs = [];
  for (const item of items) {
    const jobId = String(item.jobId || "");
    const token = tokenFromBodyOrCookie(request, jobId, String(item.token || ""));
    const job = await getAuthorizedJob(env, jobId, token);
    if (!job) return badRequest("One selected conversion is unknown or expired.");
    if (!["preview_ready", "complete"].includes(job.status)) {
      return badRequest("Only previewed files can be batched for checkout.");
    }
    if (job.paid_at) {
      return badRequest("Batch checkout is only for unpaid files.");
    }
    jobs.push(job);
  }

  const totalPages = jobs.reduce((sum, job) => sum + Math.max(1, Number(job.estimated_pages || 1)), 0);
  if (totalPages > PLANS.pro.pages) {
    return badRequest(`Batch checkout supports up to ${PLANS.pro.pages} pages/images at once. Split this batch before paying.`);
  }

  const plan = planForPages(totalPages);
  if (env.FREE_DOWNLOADS_ENABLED === "true") {
    return json({ mode: "finalize_all", plan, jobIds: jobs.map((job) => job.id) });
  }

  const now = new Date().toISOString();
  const batch = {
    id: randomId("batch"),
    planId: plan.id,
    amount: plan.amount,
    currency: plan.currency,
    email: String(body.email || "").slice(0, 120),
    jobIds: jobs.map((job) => job.id)
  };

  await env.AICONVERTER_DB.prepare(
    `INSERT INTO batch_checkouts (
      id, status, plan_id, amount, currency, job_count, job_ids_json, email, created_at, updated_at
    ) VALUES (?, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      batch.id,
      batch.planId,
      batch.amount,
      batch.currency,
      jobs.length,
      JSON.stringify(batch.jobIds),
      batch.email,
      now,
      now
    )
    .run();

  await Promise.all(jobs.map((job) => updateJob(env, job.id, { batch_id: batch.id, plan_id: plan.id })));

  let checkoutUrl = "";
  try {
    checkoutUrl = await createDodoBatchCheckout({
      env,
      request,
      batch: { id: batch.id },
      jobs,
      plan,
      email: batch.email
    });
  } catch (error) {
    return json({ error: error?.message || "Batch checkout could not be created.", code: error?.code || "DODO_BATCH_CHECKOUT_ERROR" }, { status: 503 });
  }

  if (!checkoutUrl) {
    return json({ error: "Payments are not connected yet. Batch checkout needs live Dodo products." }, { status: 503 });
  }

  await env.AICONVERTER_DB.prepare("UPDATE batch_checkouts SET status = 'checkout_created', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), batch.id)
    .run();

  return json({
    mode: "checkout",
    batchId: batch.id,
    checkoutUrl,
    plan,
    jobIds: batch.jobIds,
    totalPages
  });
}
