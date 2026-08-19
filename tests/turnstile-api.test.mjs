import test from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "../functions/lib/turnstile.js";

test("Turnstile verification is skipped when keys are not configured", async () => {
  const result = await verifyTurnstile({}, new Request("https://aiconverter.app/api/convert"), "");
  assert.deepEqual(result, { ok: true, skipped: true, message: "" });
});

test("Turnstile verification fails closed when token is missing", async () => {
  const result = await verifyTurnstile(
    { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" },
    new Request("https://aiconverter.app/api/convert"),
    ""
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /Complete the human check/);
});

test("Turnstile verification accepts siteverify success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }));
  try {
    const result = await verifyTurnstile(
      { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" },
      new Request("https://aiconverter.app/api/convert", { headers: { "CF-Connecting-IP": "203.0.113.1" } }),
      "token"
    );
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Turnstile verification rejects siteverify failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }));
  try {
    const result = await verifyTurnstile(
      { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" },
      new Request("https://aiconverter.app/api/convert"),
      "token"
    );
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["timeout-or-duplicate"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
