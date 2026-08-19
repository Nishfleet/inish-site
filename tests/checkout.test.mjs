import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as checkout } from "../functions/api/checkout.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("paid jobs do not create duplicate checkout handoffs", async () => {
  const token = "tok_paid_checkout";
  const tokenHash = await sha256(token);
  const job = {
    id: "job_paid_checkout",
    token_hash: tokenHash,
    status: "preview_ready",
    plan_id: "starter",
    paid_at: "2026-05-18T00:00:00.000Z",
    expires_at: futureExpiry()
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("checkout should not be created for paid jobs");
  };

  try {
    const response = await checkout({
      env: fakeEnv(job),
      request: new Request("https://aiconverter.app/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, token })
      })
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.mode, "finalize");
    assert.equal(payload.finalizeUrl, "/api/finalize");
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function fakeEnv(job) {
  return {
    AICONVERTER_BUCKET: {},
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs WHERE id = ? AND token_hash = ?")) {
          return {
            bind(id, tokenHash) {
              return {
                first: async () => (id === job.id && tokenHash === job.token_hash ? job : null)
              };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };
}
