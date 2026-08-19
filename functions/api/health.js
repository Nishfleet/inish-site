import { json, methodNotAllowed } from "../lib/http.js";
import { hasCloudConvertConfig } from "../lib/cloudconvert.js";
import { hasConvertioConfig } from "../lib/convertio.js";
import { dodoProductIdForPlan, hasDodoApi, hasDodoWebhookSecret } from "../lib/dodo.js";
import { hasExtractorBinding, hasMistralConfig, hasRequiredBindings, PLANS, rateLimitSaltStatus } from "../lib/jobs.js";

export function onRequestPost() {
  return methodNotAllowed("GET");
}

export async function onRequestGet({ env }) {
  const storage = hasRequiredBindings(env);
  const dodoProducts = Object.keys(PLANS).reduce((acc, planId) => {
    acc[planId] = Boolean(dodoProductIdForPlan(env, planId));
    return acc;
  }, {});
  const missing = [];
  if (!storage) missing.push("storage/database bindings");
  if (!hasDodoApi(env)) missing.push("Dodo API key");
  if (!hasDodoWebhookSecret(env)) missing.push("Dodo webhook secret");
  Object.entries(dodoProducts).forEach(([planId, present]) => {
    if (!present) missing.push(`Dodo ${planId} product ID`);
  });
  if (!hasExtractorBinding(env)) missing.push("AI/OCR provider");
  if (!env.AI) missing.push("Workers AI binding");
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) missing.push("Turnstile keys");
  if (!hasCloudConvertConfig(env) && !hasConvertioConfig(env)) missing.push("universal conversion provider");
  if (!rateLimitSaltStatus(env).ok) missing.push("strong rate-limit salt");

  let database = "unchecked";
  if (storage) {
    try {
      await env.AICONVERTER_DB.prepare("SELECT 1").first();
      database = "ready";
    } catch {
      database = "error";
      missing.push("D1 query");
    }
  }

  return json({
    ok: missing.length === 0,
    generatedAt: new Date().toISOString(),
    status: missing.length ? "attention" : "ready",
    missing,
    capabilities: {
      storage,
      database,
      dodo: {
        apiConfigured: hasDodoApi(env),
        webhookConfigured: hasDodoWebhookSecret(env),
        products: dodoProducts,
        freeDownloads: env.FREE_DOWNLOADS_ENABLED === "true"
      },
      ai: {
        workersAi: Boolean(env.AI),
        markdownConversion: Boolean(env.AI?.toMarkdown),
        whisper: Boolean(env.AI?.run),
        screenshotVision: Boolean(env.AI?.run),
        mistralOcr: hasMistralConfig(env),
        cloudConvert: hasCloudConvertConfig(env),
        convertioBackup: hasConvertioConfig(env)
      },
      protection: {
        uploadRateLimit: true,
        turnstile: Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY)
      }
    }
  });
}
