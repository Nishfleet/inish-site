import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { createDodoCheckout } from "../lib/dodo.js";
import { getAuthorizedJob, hasRequiredBindings, jobAccessCookie, PLANS, tokenFromBodyOrCookie } from "../lib/jobs.js";

const TRUSTED_CHECKOUT_HOSTS = new Set([
  "checkout.dodopayments.com",
  "test.checkout.dodopayments.com"
]);

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
    return badRequest("Invalid checkout request.");
  }

  const jobId = String(body.jobId || "");
  const token = tokenFromBodyOrCookie(request, jobId, String(body.token || ""));
  const job = await getAuthorizedJob(env, jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");
  if (!["preview_ready", "complete"].includes(job.status)) {
    return badRequest("Only ready conversions can be unlocked.");
  }

  const plan = PLANS[job.plan_id] || PLANS[String(body.planId || "starter")] || PLANS.starter;

  if (job.paid_at) {
    return json({
      mode: job.status === "complete" ? "download" : "finalize",
      finalizeUrl: "/api/finalize",
      plan
    }, {
      headers: { "Set-Cookie": jobAccessCookie(job.id, token) }
    });
  }

  if (env.FREE_DOWNLOADS_ENABLED === "true") {
    return json({
      mode: job.status === "complete" ? "download" : "finalize",
      finalizeUrl: "/api/finalize"
    }, {
      headers: { "Set-Cookie": jobAccessCookie(job.id, token) }
    });
  }

  let dodoCheckoutUrl = "";
  try {
    dodoCheckoutUrl = await createDodoCheckout({
      env,
      request,
      job,
      plan,
      email: String(body.email || job.email || "").slice(0, 120)
    });
  } catch (error) {
    const message =
      error?.code === "MERCHANT_NOT_LIVE"
        ? "Dodo live payments are not enabled for this merchant yet. Preview is working; paid unlock will open once Dodo activates live payments."
        : error?.message || "Dodo checkout could not be created.";
    return json({ error: message, code: error?.code || "DODO_CHECKOUT_ERROR" }, { status: 503 });
  }
  if (dodoCheckoutUrl) {
    return json({
      mode: "checkout",
      checkoutUrl: dodoCheckoutUrl,
      plan
    }, {
      headers: { "Set-Cookie": jobAccessCookie(job.id, token) }
    });
  }

  const checkoutUrl = checkoutUrlForPlan(env, plan.id);
  if (!checkoutUrl) {
    return json(
      {
        error: "Payments are not connected yet. Preview is working; paid unlock needs a live Dodo key and product IDs."
      },
      { status: 503 }
    );
  }

  const url = new URL(checkoutUrl);
  if (!isTrustedCheckout(url)) {
    return json({ error: "Checkout URL is not trusted." }, { status: 500 });
  }

  url.searchParams.set("client_reference_id", job.id);
  url.searchParams.set("metadata_job_id", job.id);
  url.searchParams.set("metadata_plan_id", plan.id);
  url.searchParams.set(
    "redirect_url",
    `${new URL(request.url).origin}/?jobId=${encodeURIComponent(job.id)}&plan=${encodeURIComponent(plan.id)}`
  );
  if (body.email) {
    const email = String(body.email).slice(0, 120);
    url.searchParams.set("prefilled_email", email);
    url.searchParams.set("email", email);
  }

  return json({
    mode: "checkout",
    checkoutUrl: url.toString(),
    plan
  }, {
    headers: { "Set-Cookie": jobAccessCookie(job.id, token) }
  });
}

function checkoutUrlForPlan(env, planId) {
  const urls = {
    starter: env.CHECKOUT_STARTER_URL,
    batch: env.CHECKOUT_BATCH_URL,
    pro: env.CHECKOUT_PRO_URL
  };

  return urls[planId] || env.CHECKOUT_URL || "";
}

function isTrustedCheckout(url) {
  return (
    url.protocol === "https:" &&
    (TRUSTED_CHECKOUT_HOSTS.has(url.hostname) || url.hostname.endsWith(".dodopayments.com"))
  );
}
