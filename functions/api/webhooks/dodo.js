import {
  dodoWebhookSecret,
  markDodoWebhookProcessed,
  processDodoWebhookEvent,
  reserveDodoWebhookEvent,
  verifyDodoWebhookSignature
} from "../../lib/dodo.js";
import { json, methodNotAllowed } from "../../lib/http.js";
import { sha256 } from "../../lib/jobs.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!env.AICONVERTER_DB || !dodoWebhookSecret(env)) {
    return json({ error: "Dodo webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const webhookId = request.headers.get("webhook-id") || "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") || "";
  const webhookSignature = request.headers.get("webhook-signature") || "";

  const verified = await verifyDodoWebhookSignature({
    payload,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    secret: dodoWebhookSecret(env)
  });
  if (!verified) return json({ error: "Invalid signature." }, { status: 400 });

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventType = String(event?.type || "");
  const payloadHash = await sha256(payload);
  const reserved = await reserveDodoWebhookEvent(env, { webhookId, eventType, payloadHash, payload: event });
  if (reserved.duplicate) return json({ received: true, duplicate: true });

  try {
    const result = await processDodoWebhookEvent(env, event, { webhookId, payloadHash });
    await markDodoWebhookProcessed(env, webhookId, "processed");
    return json(result);
  } catch (error) {
    await markDodoWebhookProcessed(env, webhookId, "error", error?.message || "Webhook processing failed.");
    return json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
