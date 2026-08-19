import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as readJob } from "../functions/api/job.js";
import { sha256 } from "../functions/lib/jobs.js";

test("job read keeps failed card attempts retryable and exposes a payment notice", async () => {
  const token = "token_failed_payment";
  const job = {
    id: "job_failed_card",
    token_hash: await sha256(token),
    status: "preview_ready",
    plan_id: "starter",
    converter_id: "bank",
    result_key: "jobs/job_failed_card/result.csv",
    preview_key: "jobs/job_failed_card/preview.csv",
    output_format: "csv",
    row_count: 2,
    confidence: 0.9,
    paid_at: "",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
  const paymentEvent = {
    event_type: "payment.failed",
    status: "failed",
    created_at: "2026-05-18T09:14:19.449Z"
  };

  const response = await readJob({
    env: fakeEnv(job, paymentEvent),
    request: new Request("https://aiconverter.app/api/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token })
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "preview_ready");
  assert.equal(payload.paid, false);
  assert.equal(payload.paymentStatus, "failed");
  assert.equal(payload.paymentEvent, "payment.failed");
  assert.equal(payload.paymentMessage, "Payment failed. Try again with another card.");
});

function fakeEnv(job, paymentEvent) {
  return {
    AICONVERTER_BUCKET: {
      get: async () => ({
        text: async () => "Date,Description,Amount\n2026-05-18,Coffee Shop,-4.50\n"
      })
    },
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
        if (sql.startsWith("SELECT event_type, status, created_at")) {
          return {
            bind(id) {
              return { first: async () => (id === job.id ? paymentEvent : null) };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };
}
