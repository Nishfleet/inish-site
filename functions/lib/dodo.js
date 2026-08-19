import { PLANS, randomId, recordJobAttempt, updateJob } from "./jobs.js";

const DODO_LIVE_URL = "https://live.dodopayments.com";
const DODO_TEST_URL = "https://test.dodopayments.com";
const PRICE_PREVIEW_CACHE_MS = 5 * 60 * 1000;
const PAYMENT_SUCCESS_EVENTS = new Set(["payment.succeeded", "payment.completed", "payment.paid"]);
const PAYMENT_EVENTS = new Set([
  "payment.succeeded",
  "payment.completed",
  "payment.paid",
  "payment.failed",
  "payment.cancelled",
  "payment.processing"
]);
const REFUND_EVENTS = new Set(["refund.succeeded", "refund.failed", "refund.pending", "refund.review"]);
const PAID_STATUSES = new Set(["succeeded", "paid", "completed"]);
const pricePreviewCache = new Map();

export function hasDodoApi(env) {
  return Boolean(dodoApiKey(env));
}

export function hasDodoWebhookSecret(env) {
  return Boolean(dodoWebhookSecret(env));
}

export function dodoProductIdForPlan(env, planId) {
  const ids = {
    starter: env.DODO_PRODUCT_STARTER_ID || env.DODO_STARTER_PRODUCT_ID,
    batch: env.DODO_PRODUCT_BATCH_ID || env.DODO_BATCH_PRODUCT_ID,
    pro: env.DODO_PRODUCT_PRO_ID || env.DODO_PRO_PRODUCT_ID
  };
  return ids[planId] || "";
}

export async function previewDodoPlanPrices({ env, request }) {
  const apiKey = dodoApiKey(env);
  if (!apiKey) return { available: false, reason: "missing_api_key", prices: {} };

  const country = countryFromRequest(request);
  const cacheKey = [
    dodoBaseUrl(env),
    country || "auto",
    dodoAdaptiveCurrencyFeesInclusive(env) ? "inclusive" : "merchant-default",
    Object.keys(PLANS)
      .map((planId) => `${planId}:${dodoProductIdForPlan(env, planId)}`)
      .join("|")
  ].join(":");
  const cached = pricePreviewCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < PRICE_PREVIEW_CACHE_MS) return cached.value;

  const entries = await Promise.all(
    Object.values(PLANS).map(async (plan) => {
      const productId = dodoProductIdForPlan(env, plan.id);
      if (!productId) return [plan.id, null];
      try {
        const preview = await requestDodoCheckoutPreview(env, apiKey, productId, country);
        return [plan.id, normalizeDodoPricePreview(preview, plan)];
      } catch {
        return [plan.id, null];
      }
    })
  );

  const prices = Object.fromEntries(entries.filter(([, value]) => value?.display));
  const value = {
    available: Object.keys(prices).length > 0,
    provider: "dodo",
    source: "dodo_checkout_preview",
    country,
    adaptiveCurrency: dodoAdaptiveCurrencyEnabled(env),
    feesInclusive: dodoAdaptiveCurrencyFeesInclusive(env),
    prices
  };
  pricePreviewCache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

export async function createDodoCheckout({ env, request, job, plan, email }) {
  const apiKey = dodoApiKey(env);
  const productId = dodoProductIdForPlan(env, plan.id);
  if (!apiKey || !productId) return null;

  const returnUrl = new URL(request.url);
  returnUrl.pathname = "/";
  returnUrl.search = "";
  returnUrl.searchParams.set("jobId", job.id);
  returnUrl.searchParams.set("plan", plan.id);

  const currency = expectedDodoCurrency(env);
  const country = countryFromRequest(request);
  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: returnUrl.toString(),
    adaptive_currency_fees_inclusive: dodoAdaptiveCurrencyFeesInclusive(env),
    metadata: {
      job_id: job.id,
      plan_id: plan.id,
      expected_amount: String(plan.amount),
      ...(currency ? { expected_currency: currency } : {})
    }
  };
  if (country) body.billing_address = { country };
  if (email) body.customer = { email };

  const response = await fetch(`${dodoBaseUrl(env)}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || "Dodo checkout could not be created.");
    error.code = payload?.code || "";
    error.status = response.status;
    throw error;
  }

  const checkoutSessionId = payload.session_id || payload.checkout_session_id || payload.id || "";
  if (checkoutSessionId) {
    await updateJob(env, job.id, { checkout_session_id: checkoutSessionId });
  }

  return payload.checkout_url || payload.payment_link || "";
}

export async function createDodoBatchCheckout({ env, request, batch, jobs, plan, email }) {
  const apiKey = dodoApiKey(env);
  const productId = dodoProductIdForPlan(env, plan.id);
  if (!apiKey || !productId) return null;

  const returnUrl = new URL(request.url);
  returnUrl.pathname = "/";
  returnUrl.search = "";
  returnUrl.searchParams.set("batchId", batch.id);
  returnUrl.searchParams.set("plan", plan.id);

  const currency = expectedDodoCurrency(env);
  const country = countryFromRequest(request);
  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: returnUrl.toString(),
    adaptive_currency_fees_inclusive: dodoAdaptiveCurrencyFeesInclusive(env),
    metadata: {
      batch_id: batch.id,
      job_count: String(jobs.length),
      job_ids: jobs.map((job) => job.id).join(",").slice(0, 900),
      plan_id: plan.id,
      expected_amount: String(plan.amount),
      ...(currency ? { expected_currency: currency } : {})
    }
  };
  if (country) body.billing_address = { country };
  if (email) body.customer = { email };

  const response = await fetch(`${dodoBaseUrl(env)}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || "Dodo checkout could not be created.");
    error.code = payload?.code || "";
    error.status = response.status;
    throw error;
  }

  const checkoutSessionId = payload.session_id || payload.checkout_session_id || payload.id || "";
  if (checkoutSessionId) {
    await env.AICONVERTER_DB.prepare(
      "UPDATE batch_checkouts SET checkout_session_id = ?, updated_at = ? WHERE id = ?"
    )
      .bind(checkoutSessionId, new Date().toISOString(), batch.id)
      .run();
    await Promise.all(jobs.map((job) => updateJob(env, job.id, { batch_id: batch.id, checkout_session_id: checkoutSessionId })));
  }

  return payload.checkout_url || payload.payment_link || "";
}

export async function syncDodoProductPrices(env, { dryRun = false } = {}) {
  const apiKey = dodoApiKey(env);
  const updates = Object.values(PLANS).map((plan) => ({
    planId: plan.id,
    productId: dodoProductIdForPlan(env, plan.id),
    body: {
      price: dodoOneTimePriceBody(plan)
    }
  }));
  const missing = [];
  if (!apiKey && !dryRun) missing.push("DODO_PAYMENTS_API_KEY");
  updates.forEach((update) => {
    if (!update.productId && !dryRun) missing.push(`DODO_PRODUCT_${update.planId.toUpperCase()}_ID`);
  });

  if (missing.length) {
    return { ok: false, dryRun, missing, results: [] };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, baseUrl: dodoBaseUrl(env), updates };
  }

  const results = [];
  for (const update of updates) {
    const response = await fetch(`${dodoBaseUrl(env)}/products/${encodeURIComponent(update.productId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(update.body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      results.push({
        planId: update.planId,
        productId: update.productId,
        ok: false,
        status: response.status,
        message: payload?.message || "Dodo product update failed."
      });
      continue;
    }
    results.push({
      planId: update.planId,
      productId: update.productId,
      ok: true,
      price: payload?.price || update.body.price
    });
  }

  const failed = results.filter((result) => !result.ok);
  return { ok: failed.length === 0, dryRun: false, baseUrl: dodoBaseUrl(env), results };
}

export async function verifyDodoPayment(env, paymentId, job) {
  const apiKey = dodoApiKey(env);
  if (!apiKey || !paymentId || !job) return false;

  const response = await fetch(`${dodoBaseUrl(env)}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) return false;

  const payment = await response.json();
  const result = await applyDodoPayment(env, payment, {
    eventType: "payment.manual_verified",
    explicitJob: job,
    requirePaid: true
  });

  return result.ok;
}

export async function verifyDodoWebhookSignature({ payload, webhookId, webhookTimestamp, webhookSignature, secret }) {
  if (!payload || !webhookId || !webhookTimestamp || !webhookSignature || !secret) return false;

  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const toleranceSeconds = 5 * 60;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    decodeWebhookSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = arrayBufferToBase64(digest);

  return webhookSignature
    .split(" ")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => timingSafeEqual(part.startsWith("v1,") ? part.slice(3) : part.replace(/^v1=/, ""), expected));
}

export async function reserveDodoWebhookEvent(env, { webhookId, eventType, payloadHash, payload }) {
  const now = new Date().toISOString();
  const existing = await env.AICONVERTER_DB.prepare("SELECT status FROM dodo_webhook_events WHERE webhook_id = ?")
    .bind(webhookId)
    .first();

  if (existing?.status === "processed") {
    return { duplicate: true };
  }

  if (existing) {
    await env.AICONVERTER_DB.prepare(
      `UPDATE dodo_webhook_events
       SET received_count = received_count + 1, last_received_at = ?, updated_at = ?
       WHERE webhook_id = ?`
    )
      .bind(now, now, webhookId)
      .run();
    return { duplicate: false };
  }

  await env.AICONVERTER_DB.prepare(
    `INSERT INTO dodo_webhook_events (
      webhook_id, event_type, payload_hash, business_id, provider_object_id, status,
      error, received_count, first_received_at, last_received_at, processed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'received', '', 1, ?, ?, '', ?, ?)`
  )
    .bind(
      webhookId,
      eventType,
      payloadHash,
      String(payload?.business_id || payload?.data?.business_id || ""),
      providerObjectId(payload?.data || {}),
      now,
      now,
      now,
      now
    )
    .run();

  return { duplicate: false };
}

export async function markDodoWebhookProcessed(env, webhookId, status = "processed", error = "") {
  const now = new Date().toISOString();
  await env.AICONVERTER_DB.prepare(
    `UPDATE dodo_webhook_events
     SET status = ?, error = ?, processed_at = ?, updated_at = ?
     WHERE webhook_id = ?`
  )
    .bind(status, String(error || "").slice(0, 1000), status === "processed" ? now : "", now, webhookId)
    .run();
}

export async function processDodoWebhookEvent(env, event, { webhookId, payloadHash } = {}) {
  const eventType = String(event?.type || "");
  const data = event?.data || {};

  if (PAYMENT_EVENTS.has(eventType)) {
    const result = await applyDodoPayment(env, data, {
      eventType,
      webhookId,
      payloadHash,
      requirePaid: PAYMENT_SUCCESS_EVENTS.has(eventType)
    });
    return { received: true, ...result };
  }

  if (REFUND_EVENTS.has(eventType)) {
    const result = await applyDodoRefundEvent(env, data, { eventType, webhookId, payloadHash });
    return { received: true, ...result };
  }

  return { received: true, ignored: true };
}

export async function requestDodoRefund(env, job, reason, options = {}) {
  if (!job?.payment_id) {
    await insertDodoRefundEvent(env, {
      job,
      reason,
      status: "credit_due",
      paymentId: "",
      amount: 0,
      currency: ""
    });
    await recordJobAttempt(env, {
      jobId: job?.id || "",
      attemptType: "refund",
      status: "credit_due",
      metadata: { reason: String(reason || "").slice(0, 300), payment_id: "" }
    });
    await markRefundDue(env, job, "credit_due");
    return { status: "credit_due", refundId: "" };
  }

  if (job.refund_status) {
    const existingStatus = String(job.refund_status || "").toLowerCase();
    const retryableDue =
      options.retryDue === true &&
      !job.refund_id &&
      (existingStatus === "refund_due" || existingStatus === "credit_due");
    if (!retryableDue) {
      return { status: job.refund_status, refundId: job.refund_id || "" };
    }
  }

  const cashRefundAllowed =
    options.cashRefund !== false &&
    (Number(job.download_count || 0) === 0 || env.AUTO_REFUND_AFTER_DOWNLOAD === "true");
  if (!cashRefundAllowed) {
    await insertDodoRefundEvent(env, {
      job,
      reason,
      status: "credit_due",
      paymentId: job.payment_id,
      amount: 0,
      currency: expectedDodoCurrency(env)
    });
    await recordJobAttempt(env, {
      jobId: job.id,
      attemptType: "refund",
      status: "credit_due",
      metadata: { reason: String(reason || "").slice(0, 300), payment_id: job.payment_id }
    });
    await markRefundDue(env, job, "credit_due");
    return { status: "credit_due", refundId: "" };
  }

  const apiKey = dodoApiKey(env);
  if (!apiKey || env.AUTO_REFUNDS_ENABLED !== "true") {
    await insertDodoRefundEvent(env, {
      job,
      reason,
      status: "refund_due",
      paymentId: job.payment_id,
      amount: 0,
      currency: expectedDodoCurrency(env)
    });
    await recordJobAttempt(env, {
      jobId: job.id,
      attemptType: "refund",
      status: "refund_due",
      metadata: { reason: String(reason || "").slice(0, 300), payment_id: job.payment_id, auto_refunds_enabled: false }
    });
    await markRefundDue(env, job, "refund_due");
    return { status: "refund_due", refundId: "" };
  }

  const refundEventId = await insertDodoRefundEvent(env, {
    job,
    reason,
    status: "requesting",
    paymentId: job.payment_id,
    amount: 0,
    currency: expectedDodoCurrency(env)
  });
  await recordJobAttempt(env, {
    jobId: job.id,
    attemptType: "refund",
    status: "requesting",
    metadata: { payment_id: job.payment_id, refund_event_id: refundEventId }
  });

  const response = await fetch(`${dodoBaseUrl(env)}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      payment_id: job.payment_id,
      reason: String(reason || "Automated conversion failed validation.").slice(0, 3000),
      metadata: {
        job_id: job.id,
        plan_id: job.plan_id || ""
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await updateDodoRefundEvent(env, refundEventId, {
      status: "refund_due",
      refundId: payload.refund_id || "",
      error: payload?.message || "Dodo refund request failed."
    });
    await recordJobAttempt(env, {
      jobId: job.id,
      attemptType: "refund",
      status: "refund_due",
      error: payload?.message || "Dodo refund request failed.",
      metadata: { payment_id: job.payment_id, refund_event_id: refundEventId }
    });
    await markRefundDue(env, job, "refund_due");
    return { status: "refund_due", refundId: "" };
  }

  const refundStatus = payload.status || "pending";
  await updateDodoRefundEvent(env, refundEventId, {
    status: refundStatus,
    refundId: payload.refund_id || "",
    amount: numberOrZero(payload.amount),
    currency: normalizeCurrency(payload.currency)
  });
  await updateJob(env, job.id, {
    refund_status: refundStatus,
    refund_id: payload.refund_id || "",
    refund_requested_at: new Date().toISOString()
  });
  await recordJobAttempt(env, {
    jobId: job.id,
    attemptType: "refund",
    status: refundStatus,
    metadata: { payment_id: job.payment_id, refund_id: payload.refund_id || "", refund_event_id: refundEventId }
  });

  return { status: refundStatus, refundId: payload.refund_id || "" };
}

async function applyDodoPayment(env, payment, options = {}) {
  const normalized = normalizeDodoPayment(payment);
  if (!normalized.paymentId) {
    await recordDodoPaymentEvent(env, normalized, { ...options, matchStatus: "missing_payment_id" });
    return { ok: false, ignored: true, reason: "missing_payment_id" };
  }

  const existing = options.explicitJob
    ? await env.AICONVERTER_DB.prepare("SELECT id FROM jobs WHERE payment_id = ? AND id != ?")
        .bind(normalized.paymentId, options.explicitJob.id)
        .first()
    : null;
  if (existing?.id) {
    await recordDodoPaymentEvent(env, normalized, { ...options, matchStatus: "payment_id_reused" });
    return { ok: false, ignored: true, reason: "payment_id_reused" };
  }

  if (normalized.metadataBatchId) {
    return applyDodoBatchPayment(env, normalized, options);
  }

  const match = await matchJobForDodoPayment(env, normalized, options.explicitJob);
  await recordDodoPaymentEvent(env, normalized, {
    ...options,
    job: match.job,
    matchedBy: match.matchedBy,
    matchStatus: match.ok ? "matched" : match.reason
  });

  if (!match.ok) return { ok: false, ignored: true, reason: match.reason };
  if (!PAID_STATUSES.has(normalized.status)) {
    return { ok: false, ignored: true, reason: "not_paid" };
  }

  const updates = {
    payment_id: normalized.paymentId,
    paid_at: match.job.paid_at || new Date().toISOString()
  };
  if (normalized.checkoutSessionId && !match.job.checkout_session_id) {
    updates.checkout_session_id = normalized.checkoutSessionId;
  }
  await updateJob(env, match.job.id, updates);

  return { ok: true, jobId: match.job.id };
}

async function applyDodoBatchPayment(env, payment, options = {}) {
  const batch = await env.AICONVERTER_DB.prepare("SELECT * FROM batch_checkouts WHERE id = ?")
    .bind(payment.metadataBatchId)
    .first();
  if (!batch) {
    await recordDodoPaymentEvent(env, payment, { ...options, matchStatus: "batch_not_found" });
    return { ok: false, ignored: true, reason: "batch_not_found" };
  }

  await recordDodoPaymentEvent(env, payment, {
    ...options,
    job: { id: batch.id },
    matchedBy: "batch_id",
    matchStatus: "matched"
  });

  if (!PAID_STATUSES.has(payment.status)) {
    return { ok: false, ignored: true, reason: "not_paid" };
  }
  if (batch.payment_id && batch.payment_id !== payment.paymentId) {
    return { ok: false, ignored: true, reason: "batch_has_different_payment_id" };
  }
  if (batch.checkout_session_id && payment.checkoutSessionId && batch.checkout_session_id !== payment.checkoutSessionId) {
    return { ok: false, ignored: true, reason: "checkout_session_mismatch" };
  }

  const plan = PLANS[batch.plan_id] || PLANS[payment.metadataPlanId] || PLANS.starter;
  if (payment.metadataPlanId && payment.metadataPlanId !== plan.id) {
    return { ok: false, ignored: true, reason: "metadata_plan_mismatch" };
  }
  const productId = dodoProductIdForPlan(env, plan.id);
  if (productId && payment.productIds.length > 0 && !payment.productIds.includes(productId)) {
    return { ok: false, ignored: true, reason: "product_mismatch" };
  }
  if (isDodoPaymentAmountTooLow(env, payment, plan)) {
    return { ok: false, ignored: true, reason: "amount_too_low" };
  }

  const now = new Date().toISOString();
  await env.AICONVERTER_DB.prepare(
    "UPDATE batch_checkouts SET payment_id = ?, status = ?, paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?"
  )
    .bind(payment.paymentId, payment.status, now, now, batch.id)
    .run();
  await env.AICONVERTER_DB.prepare(
    "UPDATE jobs SET payment_id = ?, paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE batch_id = ?"
  )
    .bind(payment.paymentId, now, now, batch.id)
    .run();

  return { ok: true, batchId: batch.id };
}

async function matchJobForDodoPayment(env, payment, explicitJob) {
  const job = explicitJob || (await findJobForDodoPayment(env, payment));
  if (!job) return { ok: false, reason: "job_not_found", job: null, matchedBy: "" };

  if (job.payment_id && job.payment_id !== payment.paymentId) {
    return { ok: false, reason: "job_has_different_payment_id", job, matchedBy: "job" };
  }

  if (payment.metadataJobId && payment.metadataJobId !== job.id) {
    return { ok: false, reason: "metadata_job_mismatch", job, matchedBy: "metadata_job_id" };
  }

  const expectedBusinessId = String(env.DODO_BUSINESS_ID || env.DODO_PAYMENTS_BUSINESS_ID || "").trim();
  if (expectedBusinessId && payment.businessId && payment.businessId !== expectedBusinessId) {
    return { ok: false, reason: "business_mismatch", job, matchedBy: "business_id" };
  }

  if (job.checkout_session_id && payment.checkoutSessionId && job.checkout_session_id !== payment.checkoutSessionId) {
    return { ok: false, reason: "checkout_session_mismatch", job, matchedBy: "checkout_session_id" };
  }

  const plan = PLANS[job.plan_id] || PLANS[payment.metadataPlanId] || PLANS.starter;
  if (payment.metadataPlanId && payment.metadataPlanId !== plan.id) {
    return { ok: false, reason: "metadata_plan_mismatch", job, matchedBy: "metadata_plan_id" };
  }

  const productId = dodoProductIdForPlan(env, plan.id);
  if (productId && payment.productIds.length > 0 && !payment.productIds.includes(productId)) {
    return { ok: false, reason: "product_mismatch", job, matchedBy: "product_id" };
  }

  if (isDodoPaymentAmountTooLow(env, payment, plan)) {
    return { ok: false, reason: "amount_too_low", job, matchedBy: "amount" };
  }

  const expectedCurrency = expectedDodoCurrency(env);
  if (!dodoAdaptiveCurrencyEnabled(env) && expectedCurrency && payment.currency && payment.currency !== expectedCurrency) {
    return { ok: false, reason: "currency_mismatch", job, matchedBy: "currency" };
  }

  const matchedBy = payment.metadataJobId
    ? "metadata_job_id"
    : payment.checkoutSessionId && job.checkout_session_id === payment.checkoutSessionId
      ? "checkout_session_id"
      : payment.paymentId && job.payment_id === payment.paymentId
        ? "payment_id"
        : "explicit_job";

  return { ok: true, reason: "", job, matchedBy };
}

async function findJobForDodoPayment(env, payment) {
  if (payment.metadataJobId) {
    const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(payment.metadataJobId).first();
    if (job) return job;
  }

  if (payment.checkoutSessionId) {
    const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE checkout_session_id = ?")
      .bind(payment.checkoutSessionId)
      .first();
    if (job) return job;
  }

  if (payment.paymentId) {
    const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE payment_id = ?").bind(payment.paymentId).first();
    if (job) return job;
  }

  return null;
}

async function recordDodoPaymentEvent(env, payment, options = {}) {
  const job = options.job || options.explicitJob || null;
  const now = new Date().toISOString();
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO dodo_payment_events (
      id, provider_event_id, event_type, job_id, payment_id, checkout_session_id,
      product_id, plan_id, status, amount, currency, business_id, matched_by,
      match_status, payload_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId("payevt"),
      options.webhookId || "",
      options.eventType || "",
      job?.id || payment.metadataJobId || "",
      payment.paymentId || "",
      payment.checkoutSessionId || "",
      payment.productIds[0] || "",
      payment.metadataPlanId || job?.plan_id || "",
      payment.status || "",
      payment.amount || 0,
      payment.currency || "",
      payment.businessId || "",
      options.matchedBy || "",
      options.matchStatus || "",
      options.payloadHash || "",
      now,
      now
    )
    .run();
}

async function applyDodoRefundEvent(env, refund, options = {}) {
  const normalized = normalizeDodoRefund(refund);
  const job = await findJobForDodoRefund(env, normalized);
  const expectedBusinessId = String(env.DODO_BUSINESS_ID || env.DODO_PAYMENTS_BUSINESS_ID || "").trim();
  const businessMismatch = expectedBusinessId && normalized.businessId && normalized.businessId !== expectedBusinessId;

  await insertDodoRefundEvent(env, {
    job,
    reason: normalized.reason,
    status: normalized.status || "received",
    paymentId: normalized.paymentId,
    refundId: normalized.refundId,
    amount: normalized.amount,
    currency: normalized.currency,
    webhookId: options.webhookId || "",
    eventType: options.eventType || "",
    businessId: normalized.businessId,
    payloadHash: options.payloadHash || ""
  });

  if (businessMismatch) return { ok: false, ignored: true, reason: "business_mismatch" };
  if (!job) return { ok: false, ignored: true, reason: "job_not_found" };

  await updateJob(env, job.id, {
    refund_status: normalized.status || job.refund_status || "received",
    refund_id: normalized.refundId || job.refund_id || "",
    refund_requested_at: job.refund_requested_at || new Date().toISOString()
  });

  return { ok: true, jobId: job.id };
}

async function findJobForDodoRefund(env, refund) {
  if (refund.metadataJobId) {
    const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(refund.metadataJobId).first();
    if (job) return job;
  }
  if (refund.paymentId) {
    const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE payment_id = ?").bind(refund.paymentId).first();
    if (job) return job;
  }
  return null;
}

async function insertDodoRefundEvent(env, refund) {
  const now = new Date().toISOString();
  const id = randomId("refevt");
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO dodo_refund_events (
      id, provider_event_id, event_type, job_id, payment_id, refund_id, status,
      reason, amount, currency, business_id, payload_hash, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
  )
    .bind(
      id,
      refund.webhookId || "",
      refund.eventType || "refund.requested",
      refund.job?.id || "",
      refund.paymentId || "",
      refund.refundId || "",
      refund.status || "",
      String(refund.reason || "").slice(0, 3000),
      refund.amount || 0,
      normalizeCurrency(refund.currency),
      refund.businessId || "",
      refund.payloadHash || "",
      now,
      now
    )
    .run();
  return id;
}

async function updateDodoRefundEvent(env, id, fields) {
  if (!id) return;
  const now = new Date().toISOString();
  await env.AICONVERTER_DB.prepare(
    `UPDATE dodo_refund_events
     SET refund_id = COALESCE(NULLIF(?, ''), refund_id),
         status = COALESCE(NULLIF(?, ''), status),
         amount = CASE WHEN ? > 0 THEN ? ELSE amount END,
         currency = COALESCE(NULLIF(?, ''), currency),
         error = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      fields.refundId || "",
      fields.status || "",
      Number(fields.amount || 0),
      Number(fields.amount || 0),
      normalizeCurrency(fields.currency),
      String(fields.error || "").slice(0, 1000),
      now,
      id
    )
    .run();
}

async function markRefundDue(env, job, status) {
  if (!job?.id) return;
  await updateJob(env, job.id, {
    refund_status: status,
    refund_requested_at: new Date().toISOString()
  });
}

function normalizeDodoPayment(payment = {}) {
  const metadata = objectOrEmpty(payment.metadata);
  const productIds = extractProductIds(payment);
  return {
    paymentId: firstText(payment.payment_id, payment.paymentId, payment.id),
    checkoutSessionId: firstText(payment.checkout_session_id, payment.checkoutSessionId, payment.session_id, payment.sessionId),
    metadataJobId: firstText(metadata.job_id, metadata.jobId, metadata.order_id, metadata.orderId),
    metadataBatchId: firstText(metadata.batch_id, metadata.batchId),
    metadataPlanId: firstText(metadata.plan_id, metadata.planId),
    productIds,
    amount: numberOrZero(payment.total_amount ?? payment.amount_total ?? payment.amount),
    currency: normalizeCurrency(payment.currency),
    businessId: firstText(payment.business_id, payment.businessId),
    status: String(payment.status || "").toLowerCase()
  };
}

function normalizeDodoRefund(refund = {}) {
  const metadata = objectOrEmpty(refund.metadata);
  return {
    refundId: firstText(refund.refund_id, refund.refundId, refund.id),
    paymentId: firstText(refund.payment_id, refund.paymentId),
    metadataJobId: firstText(metadata.job_id, metadata.jobId, metadata.order_id, metadata.orderId),
    amount: numberOrZero(refund.amount),
    currency: normalizeCurrency(refund.currency),
    businessId: firstText(refund.business_id, refund.businessId),
    status: String(refund.status || "").toLowerCase(),
    reason: firstText(refund.reason)
  };
}

function extractProductIds(payment = {}) {
  const carts = [payment.product_cart, payment.productCart, payment.line_items, payment.items].filter(Array.isArray).flat();
  return carts.map((item) => firstText(item?.product_id, item?.productId, item?.id)).filter(Boolean);
}

function providerObjectId(data = {}) {
  return firstText(data.payment_id, data.refund_id, data.dispute_id, data.subscription_id, data.id);
}

function dodoApiKey(env) {
  return env.DODO_PAYMENTS_API_KEY || env.DODO_API_KEY || "";
}

export function dodoWebhookSecret(env) {
  return env.DODO_PAYMENTS_WEBHOOK_KEY || env.DODO_PAYMENTS_WEBHOOK_SECRET || env.DODO_WEBHOOK_SECRET || "";
}

function dodoBaseUrl(env) {
  const mode = String(env.DODO_ENVIRONMENT || env.DODO_MODE || "live").toLowerCase();
  return mode.includes("test") ? DODO_TEST_URL : DODO_LIVE_URL;
}

function expectedDodoCurrency(env) {
  return normalizeCurrency(env.DODO_CURRENCY || env.PAYMENT_CURRENCY || env.CHECKOUT_CURRENCY || "");
}

function dodoBaseCurrency(env) {
  return expectedDodoCurrency(env) || "USD";
}

function dodoAdaptiveCurrencyEnabled(env) {
  return String(env.DODO_ADAPTIVE_CURRENCY || env.DODO_ADAPTIVE_PRICING || "true").toLowerCase() !== "false";
}

function dodoAdaptiveCurrencyFeesInclusive(env) {
  return String(env.DODO_ADAPTIVE_CURRENCY_FEES_INCLUSIVE || "true").toLowerCase() !== "false";
}

function dodoOneTimePriceBody(plan) {
  return {
    currency: plan.currency || "INR",
    discount: 0,
    price: Number(plan.amount || 0),
    purchasing_power_parity: true,
    tax_inclusive: true,
    type: "one_time_price"
  };
}

export function isDodoPaymentAmountTooLow(env, payment, plan) {
  if (!payment?.amount || payment.amount <= 0) return false;
  const currency = normalizeCurrency(payment.currency);
  if (dodoAdaptiveCurrencyEnabled(env) && currency && currency !== dodoBaseCurrency(env)) return false;
  return payment.amount < Number(plan?.amount || 0);
}

async function requestDodoCheckoutPreview(env, apiKey, productId, country) {
  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }]
  };
  if (country) body.billing_address = { country };

  const response = await fetch(`${dodoBaseUrl(env)}/checkouts/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || "Dodo pricing preview could not be created.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function normalizeDodoPricePreview(payload, plan) {
  const currency = normalizeCurrency(payload?.currency || payload?.current_breakup?.currency);
  const amount = numberOrNull(
    payload?.current_breakup?.total_amount ??
      payload?.total_price ??
      payload?.total_amount ??
      payload?.product_cart?.[0]?.discounted_price
  );
  const display = formatDodoAmount(amount, currency);
  if (!display) return null;
  return {
    planId: plan.id,
    display,
    amount,
    currency,
    billingCountry: String(payload?.billing_country || "").toUpperCase(),
    taxInclusive: Boolean(payload?.product_cart?.[0]?.tax_inclusive),
    totalTax: numberOrNull(payload?.total_tax)
  };
}

function formatDodoAmount(minorAmount, currency) {
  if (!Number.isFinite(minorAmount) || !currency) return "";
  try {
    const decimals = new Intl.NumberFormat("en", {
      style: "currency",
      currency
    }).resolvedOptions().maximumFractionDigits;
    const majorAmount = Math.ceil(minorAmount / 10 ** decimals);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(majorAmount);
  } catch {
    return `${currency} ${Math.ceil(minorAmount / 100)}`;
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countryFromRequest(request) {
  const cloudflareCountry = String(request?.cf?.country || "").toUpperCase();
  const headerCountry = String(request?.headers?.get?.("cf-ipcountry") || request?.headers?.get?.("x-country") || "").toUpperCase();
  const country = cloudflareCountry || headerCountry;
  return /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : "";
}

function decodeWebhookSecret(secret) {
  const normalized = String(secret || "").trim().replace(/^whsec_/, "");
  try {
    return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  } catch {
    return new TextEncoder().encode(secret);
  }
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function firstText(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}
