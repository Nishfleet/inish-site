import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { hasRequiredBindings, randomId, requestFingerprint } from "../lib/jobs.js";
import { verifyTurnstile } from "../lib/turnstile.js";

const CATEGORIES = new Set(["conversion", "payment", "refund", "deletion", "security", "other"]);

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure support storage is not configured yet.");
  }

  const data = await readBody(request);
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");

  if (String(data.website || "").trim()) {
    return wantsJson ? json({ ok: true }) : supportHtml("Request received", "Thanks. Your request has been received.");
  }

  const turnstile = await verifyTurnstile(
    env,
    request,
    data["cf-turnstile-response"] || data.turnstileToken
  );
  if (!turnstile.ok) {
    return wantsJson
      ? json({ error: turnstile.message }, { status: 403 })
      : supportHtml("Human check failed", turnstile.message, 403);
  }

  const email = String(data.email || "").trim().slice(0, 160);
  const jobId = String(data.jobId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  const category = CATEGORIES.has(String(data.category || "")) ? String(data.category) : "other";
  const message = String(data.message || "").trim().slice(0, 4000);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return wantsJson ? badRequest("Use a valid email address or leave it blank.") : supportHtml("Check your email", "Use a valid email address or leave it blank.", 400);
  }

  if (message.length < 12) {
    return wantsJson ? badRequest("Add a short description of the issue.") : supportHtml("Add more detail", "Add a short description of the issue.", 400);
  }

  const fingerprint = await requestFingerprint(env, request);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const recent = await env.AICONVERTER_DB.prepare(
    "SELECT COUNT(*) AS count FROM support_requests WHERE ip_hash = ? AND created_at > ?"
  )
    .bind(fingerprint.ipHash, hourAgo)
    .first();

  if (Number(recent?.count || 0) >= 5) {
    return wantsJson ? json({ error: "Too many support requests. Try again later." }, { status: 429 }) : supportHtml("Try again later", "Too many support requests. Try again later.", 429);
  }

  const id = randomId("sup");
  await env.AICONVERTER_DB.prepare(
    `INSERT INTO support_requests (
      id, job_id, email, category, message, ip_hash, user_agent_hash, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  )
    .bind(id, jobId, email, category, message, fingerprint.ipHash, fingerprint.userAgentHash, now.toISOString())
    .run();

  if (wantsJson) return json({ ok: true, id });

  return supportHtml(
    "Support request received",
    `Your request ID is ${id}. We prioritize payment, refund, deletion, and security issues.`
  );
}

async function readBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return request.json().catch(() => ({}));
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function supportHtml(title, message, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} - AI Converter</title>
    <link rel="stylesheet" href="/legal.css" />
  </head>
  <body>
    <main class="legal-shell">
      <header class="legal-header">
        <a class="brand" href="/"><span class="brand-mark">AI</span><span class="brand-name">AI Converter</span></a>
        <a class="top-link" href="/support/">Back to support</a>
      </header>
      <section class="legal-hero">
        <p class="eyebrow">Support</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(message)}</p>
      </section>
      <p class="notice">Do not email or paste full source-file data into support messages. Use the secure upload flow for sensitive files.</p>
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
