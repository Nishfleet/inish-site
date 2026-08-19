import { json, methodNotAllowed, serverError } from "../../lib/http.js";
import { authorizeAdmin } from "../../lib/admin-auth.js";
import {
  cloudConvertDailyJobLimit,
  cloudConvertMinimumCredits,
  cloudConvertRequiresCreditCheck,
  cloudConvertUsageToday,
  getCloudConvertAccount,
  hasCloudConvertConfig
} from "../../lib/cloudconvert.js";
import { hasConvertioConfig, convertioDailyJobLimit } from "../../lib/convertio.js";
import { dodoProductIdForPlan, hasDodoApi, hasDodoWebhookSecret } from "../../lib/dodo.js";
import { hasAzureConfig, hasExtractorBinding, hasMistralConfig, hasRequiredBindings, PLANS, rateLimitSaltStatus } from "../../lib/jobs.js";

export function onRequestPost() {
  return methodNotAllowed("GET");
}

export async function onRequestGet({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const auth = authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.message }, { status: auth.status });

  const health = runtimeHealth(env);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const staleCheckoutBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [
    jobStatus,
    watchlist,
    support,
    payments,
    refunds,
    webhooks,
    usage24h,
    providerFailures,
    stuckProvider,
    webhookFailures,
    webhookErrorCount,
    unmatchedPayments,
    refundDue,
    checkoutHandoffs,
    staleCheckoutHandoffs,
    previewFunnel,
    previewFunnelByRoute,
    previewFunnelIssues,
    cloudConvert
  ] = await Promise.all([
    queryAll(env, "SELECT status, COUNT(*) AS count FROM jobs GROUP BY status ORDER BY count DESC"),
    queryAll(
      env,
      `SELECT id, status, converter_id, plan_id, row_count, confidence, refund_status, error, created_at, updated_at
       FROM jobs
       WHERE status IN ('failed', 'converting_full', 'expired')
          OR COALESCE(refund_status, '') != ''
       ORDER BY updated_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT id, job_id, email, category, status, substr(message, 1, 240) AS message_excerpt, created_at
       FROM support_requests
       WHERE status != 'closed'
       ORDER BY created_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT event_type, job_id, payment_id, plan_id, status, amount, currency, match_status, created_at
       FROM dodo_payment_events
       ORDER BY created_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT job_id, payment_id, refund_id, status, reason, amount, currency, error, created_at
       FROM dodo_refund_events
       ORDER BY created_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT webhook_id, event_type, status, received_count, error, updated_at
       FROM dodo_webhook_events
       ORDER BY updated_at DESC
       LIMIT 25`
    ),
    queryFirst(
      env,
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'preview_ready' THEN 1 ELSE 0 END), 0) AS preview_ready,
         COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
         COALESCE(SUM(CASE WHEN status = 'converting_full' THEN 1 ELSE 0 END), 0) AS converting,
         COALESCE(SUM(CASE WHEN COALESCE(external_provider, '') != '' THEN 1 ELSE 0 END), 0) AS provider_total,
         COALESCE(SUM(CASE WHEN COALESCE(external_provider, '') != '' AND status = 'complete' THEN 1 ELSE 0 END), 0) AS provider_complete,
         COALESCE(SUM(CASE WHEN COALESCE(external_provider, '') != '' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS provider_failed,
         COALESCE(SUM(CASE WHEN COALESCE(external_provider, '') != '' AND status = 'converting_full' THEN 1 ELSE 0 END), 0) AS provider_converting,
         COALESCE(SUM(CASE WHEN external_provider = 'cloudconvert' THEN 1 ELSE 0 END), 0) AS cloudconvert_total,
         COALESCE(SUM(CASE WHEN external_provider = 'cloudconvert' AND status = 'complete' THEN 1 ELSE 0 END), 0) AS cloudconvert_complete,
         COALESCE(SUM(CASE WHEN external_provider = 'cloudconvert' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS cloudconvert_failed,
         COALESCE(SUM(CASE WHEN external_provider = 'cloudconvert' AND status = 'converting_full' THEN 1 ELSE 0 END), 0) AS cloudconvert_converting,
         COALESCE(SUM(CASE WHEN external_provider = 'convertio' THEN 1 ELSE 0 END), 0) AS convertio_total,
         COALESCE(SUM(CASE WHEN external_provider = 'convertio' AND status = 'complete' THEN 1 ELSE 0 END), 0) AS convertio_complete,
         COALESCE(SUM(CASE WHEN external_provider = 'convertio' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS convertio_failed,
         COALESCE(SUM(CASE WHEN external_provider = 'convertio' AND status = 'converting_full' THEN 1 ELSE 0 END), 0) AS convertio_converting
       FROM jobs
       WHERE created_at >= ?`,
      [since24h]
    ),
    queryAll(
      env,
      `SELECT id, status, converter_id, plan_id, external_provider, external_status, substr(error, 1, 240) AS error, updated_at
       FROM jobs
       WHERE (external_provider IN ('cloudconvert', 'convertio') OR extractor IN ('cloudconvert', 'convertio'))
         AND (status = 'failed' OR COALESCE(external_status, '') IN ('error', 'failed'))
       ORDER BY updated_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT id, status, converter_id, plan_id, external_provider, external_status, updated_at
       FROM jobs
       WHERE external_provider IN ('cloudconvert', 'convertio')
         AND status = 'converting_full'
         AND updated_at < ?
       ORDER BY updated_at ASC
       LIMIT 25`,
      [stuckBefore]
    ),
    queryAll(
      env,
      `SELECT webhook_id, event_type, status, received_count, error, updated_at
       FROM dodo_webhook_events
       WHERE status = 'error' OR COALESCE(error, '') != ''
       ORDER BY updated_at DESC
       LIMIT 25`
    ),
    queryFirst(
      env,
      `SELECT COUNT(*) AS count
       FROM dodo_webhook_events
       WHERE (status = 'error' OR COALESCE(error, '') != '')
         AND updated_at >= ?`,
      [since24h]
    ),
    queryAll(
      env,
      `SELECT event_type, job_id, payment_id, checkout_session_id, plan_id, status, amount, match_status, created_at
       FROM dodo_payment_events
       WHERE COALESCE(match_status, '') NOT IN ('', 'matched')
         AND NOT (
           COALESCE(job_id, '') = ''
           AND event_type = 'payment.failed'
           AND status = 'failed'
           AND match_status = 'job_not_found'
         )
         AND NOT (
           COALESCE(job_id, '') = ''
           AND event_type = 'payment.succeeded'
           AND status = 'succeeded'
           AND COALESCE(amount, 0) = 0
           AND match_status = 'job_not_found'
         )
       ORDER BY created_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT
         jobs.id,
         jobs.payment_id,
         jobs.refund_status,
         jobs.refund_id,
         jobs.error,
         CASE WHEN jobs.id LIKE 'checkout_drill_%' THEN 1 ELSE 0 END AS is_drill,
         (
           SELECT dodo_refund_events.error
           FROM dodo_refund_events
           WHERE dodo_refund_events.job_id = jobs.id
           ORDER BY dodo_refund_events.created_at DESC
           LIMIT 1
         ) AS refund_error,
         jobs.updated_at
       FROM jobs
       WHERE COALESCE(refund_status, '') IN ('refund_due', 'credit_due', 'requesting')
       ORDER BY updated_at DESC
       LIMIT 25`
    ),
    queryAll(
      env,
      `SELECT id, status, converter_id, plan_id, checkout_session_id, payment_id, email, updated_at
       FROM jobs
       WHERE COALESCE(checkout_session_id, '') != ''
         AND paid_at IS NULL
         AND LOWER(COALESCE(email, '')) NOT IN ('audit@example.com', 'qa+aiconverter@example.com', 'admin-drill@aiconverter.app')
         AND id NOT LIKE 'job_checkoutstress_%'
         AND updated_at >= ?
       ORDER BY updated_at DESC
       LIMIT 25`,
      [since24h]
    ),
    queryAll(
      env,
      `SELECT id, status, converter_id, plan_id, checkout_session_id, payment_id, email, updated_at
       FROM jobs
       WHERE COALESCE(checkout_session_id, '') != ''
         AND paid_at IS NULL
         AND LOWER(COALESCE(email, '')) NOT IN ('audit@example.com', 'qa+aiconverter@example.com', 'admin-drill@aiconverter.app')
         AND id NOT LIKE 'job_checkoutstress_%'
         AND updated_at < ?
         AND updated_at >= ?
       ORDER BY updated_at ASC
       LIMIT 25`,
      [staleCheckoutBefore, since24h]
    ),
    queryAll(
      env,
      `SELECT event_type, COUNT(*) AS count
       FROM preview_funnel_events
       WHERE created_at >= ?
       GROUP BY event_type
       ORDER BY count DESC`,
      [since24h]
    ),
    queryAll(
      env,
      `SELECT converter_id, output_format, event_type, COUNT(*) AS count
       FROM preview_funnel_events
       WHERE created_at >= ?
       GROUP BY converter_id, output_format, event_type
       ORDER BY count DESC
       LIMIT 50`,
      [since24h]
    ),
    queryAll(
      env,
      `SELECT event_type, converter_id, output_format, input_kind, file_size_bucket, page_bucket,
              turnstile_state, error_code, route_path, created_at
       FROM preview_funnel_events
       WHERE event_type IN ('preview_error', 'turnstile_fail')
         AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [since24h]
    ),
    buildCloudConvertOverview(env)
  ]);
  const alerts = buildAlerts({
    health,
    cloudConvert,
    usage24h,
    providerFailures,
    stuckProvider,
    webhookErrorCount,
    unmatchedPayments,
    refundDue,
    staleCheckoutHandoffs
  });
  const operationalQueues = {
    failedJobs: (watchlist || []).filter((row) => row.status === "failed").length,
    stuckProvider: (stuckProvider || []).length,
    paymentHandoffs: (checkoutHandoffs || []).length,
    stalePaymentHandoffs: (staleCheckoutHandoffs || []).length,
    unmatchedPayments: (unmatchedPayments || []).length,
    refundDue: (refundDue || []).length,
    customerRefundDue: (refundDue || []).filter((row) => !isDrillRefund(row)).length,
    drillRefundDue: (refundDue || []).filter(isDrillRefund).length,
    openSupport: (support || []).length,
    webhookFailures: (webhookFailures || []).length,
    previewErrors: safeCountFromFunnel(previewFunnel, "preview_error"),
    turnstileFailures: safeCountFromFunnel(previewFunnel, "turnstile_fail")
  };

  return json({
    ok: true,
    generatedAt: new Date().toISOString(),
    health,
    alerts,
    operationalQueues,
    cloudConvert,
    usage24h,
    jobStatus,
    watchlist,
    providerFailures,
    stuckProvider,
    support,
    payments,
    unmatchedPayments,
    checkoutHandoffs,
    staleCheckoutHandoffs,
    refunds,
    refundDue,
    previewFunnel,
    previewFunnelByRoute,
    previewFunnelIssues,
    webhookFailures,
    webhooks
  });
}

function runtimeHealth(env) {
  const dodoProducts = Object.keys(PLANS).reduce((acc, planId) => {
    acc[planId] = Boolean(dodoProductIdForPlan(env, planId));
    return acc;
  }, {});
  const missing = [];
  if (!hasRequiredBindings(env)) missing.push("storage/database bindings");
  if (!hasDodoApi(env)) missing.push("Dodo API key");
  if (!hasDodoWebhookSecret(env)) missing.push("Dodo webhook secret");
  Object.entries(dodoProducts).forEach(([planId, present]) => {
    if (!present) missing.push(`Dodo ${planId} product ID`);
  });
  if (!hasExtractorBinding(env)) missing.push("OCR fallback provider");
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) missing.push("Turnstile keys");
  if (!hasCloudConvertConfig(env) && !hasConvertioConfig(env)) missing.push("universal conversion provider");
  if (!rateLimitSaltStatus(env).ok) missing.push("strong rate-limit salt");

  return {
    status: missing.length ? "attention" : "ready",
    missing,
    storageConfigured: hasRequiredBindings(env),
    payments: {
      provider: "dodo",
      mode: String(env.DODO_ENVIRONMENT || env.DODO_MODE || "live").toLowerCase().includes("test") ? "test" : "live",
      apiConfigured: hasDodoApi(env),
      webhookConfigured: hasDodoWebhookSecret(env),
      products: dodoProducts,
      freeDownloads: env.FREE_DOWNLOADS_ENABLED === "true",
      autoRefunds: env.AUTO_REFUNDS_ENABLED === "true"
    },
    extraction: {
      nativePdf: true,
      mistral: hasMistralConfig(env),
      azureFallback: hasAzureConfig(env),
      cloudflareFallback: Boolean(env.ALLOW_CLOUDFLARE_FALLBACK === "true" && env.AI),
      workersAi: Boolean(env.AI),
      markdownConversion: Boolean(env.AI?.toMarkdown),
      whisper: Boolean(env.AI?.run),
      screenshotVision: Boolean(env.AI?.run),
      cloudConvert: hasCloudConvertConfig(env),
      convertioBackup: hasConvertioConfig(env)
    },
    protection: {
      turnstile: Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY),
      uploadRateLimit: true,
      sameFilePreviewLimit: true,
      paymentReuseGuard: true
    }
  };
}

async function buildCloudConvertOverview(env) {
  const configured = hasCloudConvertConfig(env);
  const dailyLimit = cloudConvertDailyJobLimit(env);
  const minCredits = cloudConvertMinimumCredits(env);
  const requireCreditCheck = cloudConvertRequiresCreditCheck(env);
  const [usageToday, account] = await Promise.all([cloudConvertUsageToday(env), getCloudConvertAccount(env)]);
  return {
    configured,
    backup: {
      provider: "convertio",
      configured: hasConvertioConfig(env),
      dailyLimit: convertioDailyJobLimit(env)
    },
    dailyLimit,
    minCredits,
    requireCreditCheck,
    usageToday: {
      ...usageToday,
      remaining: dailyLimit > 0 ? Math.max(0, dailyLimit - Number(usageToday.started || 0)) : null
    },
    account
  };
}

function buildAlerts({ health, cloudConvert, usage24h, providerFailures, stuckProvider, webhookErrorCount, unmatchedPayments, refundDue, staleCheckoutHandoffs }) {
  const alerts = [];
  if (health.status !== "ready") {
    alerts.push({
      severity: "critical",
      title: "Health is not green",
      detail: (health.missing || []).join(", ") || "Runtime health needs attention."
    });
  }

  const backup = cloudConvert.backup || {};
  if (!cloudConvert.configured && !backup.configured) {
    alerts.push({ severity: "critical", title: "No universal provider is configured", detail: "Provider-backed universal conversions are blocked." });
  } else if (!cloudConvert.configured && backup.configured) {
    alerts.push({ severity: "warning", title: "CloudConvert is offline", detail: "Convertio backup is configured and will be used for provider conversions." });
  } else {
    const usage = cloudConvert.usageToday || {};
    const primaryIssueSeverity = backup.configured ? "warning" : "critical";
    if (usage.error) {
      alerts.push({
        severity: primaryIssueSeverity,
        title: "CloudConvert usage check failed",
        detail: usage.error
      });
    }
    if (cloudConvert.dailyLimit > 0 && Number(usage.started || 0) >= cloudConvert.dailyLimit) {
      alerts.push({
        severity: primaryIssueSeverity,
        title: "CloudConvert daily cap reached",
        detail: `${usage.started}/${cloudConvert.dailyLimit} provider jobs have started today.`
      });
    } else if (cloudConvert.dailyLimit > 0 && Number(usage.remaining || 0) <= 2) {
      alerts.push({
        severity: "warning",
        title: "CloudConvert daily cap nearly used",
        detail: `${usage.remaining} provider job${Number(usage.remaining) === 1 ? "" : "s"} left today.`
      });
    }

    const account = cloudConvert.account || {};
    if (account.ok && account.credits !== null && account.credits !== undefined) {
      if (Number(account.credits) <= cloudConvert.minCredits) {
        alerts.push({
          severity: primaryIssueSeverity,
          title: "CloudConvert credits are low",
          detail: `${account.credits} credits available; reserve is ${cloudConvert.minCredits}.`
        });
      } else if (Number(account.credits) <= cloudConvert.minCredits + 5) {
        alerts.push({
          severity: "warning",
          title: "CloudConvert credits are near reserve",
          detail: `${account.credits} credits available.`
        });
      }
    } else if (account.ok && cloudConvert.requireCreditCheck) {
      alerts.push({
        severity: primaryIssueSeverity,
        title: "CloudConvert credit balance missing",
        detail: "CloudConvert account responded without a credit balance."
      });
    } else if (cloudConvert.requireCreditCheck) {
      alerts.push({
        severity: primaryIssueSeverity,
        title: "CloudConvert credit check failed",
        detail: account.message || "Could not read CloudConvert account credits."
      });
    }
  }

  const webhookErrors = numberOrZero(webhookErrorCount?.count);
  if (webhookErrors > 0) {
    alerts.push({
      severity: "critical",
      title: "Dodo webhook failures",
      detail: `${webhookErrors} failed webhook event${webhookErrors === 1 ? "" : "s"} in the last 24 hours.`
    });
  }

  const providerFailed = numberOrZero(usage24h?.provider_failed);
  if (providerFailed > 0) {
    alerts.push({
      severity: "warning",
      title: "Provider conversion failures",
      detail: `${providerFailed} provider failure${providerFailed === 1 ? "" : "s"} need review.`
    });
  }

  if ((stuckProvider || []).length > 0) {
    alerts.push({
      severity: "warning",
      title: "Provider jobs are stuck",
      detail: `${stuckProvider.length} provider job${stuckProvider.length === 1 ? "" : "s"} have been converting for more than 15 minutes.`
    });
  }

  const actionableUnmatchedPayments = (unmatchedPayments || []).filter(isActionableUnmatchedPayment);
  if (actionableUnmatchedPayments.length > 0) {
    alerts.push({
      severity: "warning",
      title: "Unmatched Dodo payments",
      detail: `${actionableUnmatchedPayments.length} payment event${actionableUnmatchedPayments.length === 1 ? "" : "s"} did not match cleanly.`
    });
  }

  if ((staleCheckoutHandoffs || []).length > 0) {
    const count = staleCheckoutHandoffs.length;
    alerts.push({
      severity: "warning",
      title: "Open Dodo checkout handoffs",
      detail: `${count} checkout handoff${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} still unpaid after 60 minutes.`
    });
  }

  const customerRefundDue = (refundDue || []).filter((row) => !isDrillRefund(row));
  const drillRefundDue = (refundDue || []).filter(isDrillRefund);
  if (customerRefundDue.length > 0) {
    alerts.push({
      severity: "warning",
      title: "Refund or credit due",
      detail: `${customerRefundDue.length} customer job${customerRefundDue.length === 1 ? "" : "s"} need refund/credit follow-up.`
    });
  }

  if (drillRefundDue.length > 0) {
    alerts.push({
      severity: "warning",
      title: "Drill refund retry needed",
      detail: `${drillRefundDue.length} admin drill refund${drillRefundDue.length === 1 ? "" : "s"} need wallet funds or manual cleanup.`
    });
  }

  return alerts.length
    ? alerts
    : [{ severity: "ready", title: "No active alerts", detail: "Health, provider, payment, and refund checks are clear." }];
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDrillRefund(row = {}) {
  return Number(row.is_drill || row.isDrill || 0) === 1 || String(row.id || "").startsWith("checkout_drill_");
}

export function isActionableUnmatchedPayment(row = {}) {
  const eventType = String(row.event_type || row.eventType || "").toLowerCase();
  const status = String(row.status || "").toLowerCase();
  const matchStatus = String(row.match_status || row.matchStatus || "").toLowerCase();
  const jobId = String(row.job_id || row.jobId || "").trim();
  const amount = Number(row.amount ?? row.amountMinor ?? 0) || 0;
  // Test/sandbox noise with no app job attached is not actionable:
  // - payment.failed with no job id (never matched an app job)
  // - zero-amount payment.succeeded with no job id (Dodo sandbox checkout;
  //   no money moved, so a real paid-but-unmatched event still alerts)
  const isNonActionableTestEvent =
    (eventType === "payment.failed" && status === "failed" && matchStatus === "job_not_found" && !jobId) ||
    (eventType === "payment.succeeded" && status === "succeeded" && matchStatus === "job_not_found" && !jobId && amount === 0);
  return !isNonActionableTestEvent;
}

function safeCountFromFunnel(rows, eventType) {
  const row = (rows || []).find((item) => item.event_type === eventType);
  return numberOrZero(row?.count);
}

async function queryAll(env, sql, binds = []) {
  try {
    const statement = env.AICONVERTER_DB.prepare(sql);
    const result = await (binds.length ? statement.bind(...binds) : statement).all();
    return result.results || [];
  } catch (error) {
    return [{ error: error?.message || "Query failed." }];
  }
}

async function queryFirst(env, sql, binds = []) {
  try {
    const statement = env.AICONVERTER_DB.prepare(sql);
    return (await (binds.length ? statement.bind(...binds) : statement).first()) || {};
  } catch (error) {
    return { error: error?.message || "Query failed." };
  }
}
