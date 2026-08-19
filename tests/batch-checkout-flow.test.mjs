import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as batchCheckout } from "../functions/api/batch-checkout.js";
import { processDodoWebhookEvent } from "../functions/lib/dodo.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("batch checkout creates one Dodo handoff for multiple previewed jobs", async () => {
  const token = "tok_batch_checkout";
  const env = await fakeEnv(token);
  const originalFetch = globalThis.fetch;
  let checkoutBody;
  globalThis.fetch = async (_url, options) => {
    checkoutBody = JSON.parse(options.body);
    return Response.json({
      session_id: "cks_batch",
      checkout_url: "https://checkout.dodopayments.com/session/cks_batch"
    });
  };

  try {
    const response = await batchCheckout({
      env,
      request: new Request("https://aiconverter.app/api/batch-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "customer@example.com",
          jobs: [
            { jobId: "job_batch_a", token },
            { jobId: "job_batch_b", token }
          ]
        })
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.mode, "checkout");
    assert.equal(payload.checkoutUrl, "https://checkout.dodopayments.com/session/cks_batch");
    assert.equal(checkoutBody.metadata.batch_id, payload.batchId);
    assert.equal(checkoutBody.metadata.job_count, "2");
    assert.equal(checkoutBody.product_cart[0].product_id, "prod_batch");
    assert.equal(env.jobs.get("job_batch_a").batch_id, payload.batchId);
    assert.equal(env.jobs.get("job_batch_b").checkout_session_id, "cks_batch");
    assert.equal(env.batches.get(payload.batchId).status, "checkout_created");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("batch Dodo webhook marks every job in the batch paid", async () => {
  const token = "tok_batch_webhook";
  const env = await fakeEnv(token);
  env.batches.set("batch_paid", {
    id: "batch_paid",
    checkout_session_id: "cks_batch_paid",
    plan_id: "batch",
    payment_id: "",
    status: "checkout_created"
  });
  env.jobs.get("job_batch_a").batch_id = "batch_paid";
  env.jobs.get("job_batch_b").batch_id = "batch_paid";
  env.jobs.get("job_batch_a").checkout_session_id = "cks_batch_paid";
  env.jobs.get("job_batch_b").checkout_session_id = "cks_batch_paid";

  const result = await processDodoWebhookEvent(
    env,
    {
      type: "payment.succeeded",
      data: {
        id: "pay_batch",
        status: "succeeded",
        checkout_session_id: "cks_batch_paid",
        amount: 79900,
        currency: "INR",
        product_cart: [{ product_id: "prod_batch" }],
        metadata: { batch_id: "batch_paid", plan_id: "batch" }
      }
    },
    { webhookId: "wh_batch", payloadHash: "hash_batch" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.batchId, "batch_paid");
  assert.equal(env.jobs.get("job_batch_a").payment_id, "pay_batch");
  assert.equal(env.jobs.get("job_batch_b").payment_id, "pay_batch");
  assert.ok(env.jobs.get("job_batch_a").paid_at);
  assert.equal(env.batches.get("batch_paid").payment_id, "pay_batch");
});

async function fakeEnv(token) {
  const tokenHash = await sha256(token);
  const jobs = new Map([
    ["job_batch_a", previewJob("job_batch_a", tokenHash, 40)],
    ["job_batch_b", previewJob("job_batch_b", tokenHash, 35)]
  ]);
  const batches = new Map();
  const paymentEvents = [];

  return {
    jobs,
    batches,
    paymentEvents,
    DODO_PAYMENTS_API_KEY: "dodo_test",
    DODO_PRODUCT_STARTER_ID: "prod_starter",
    DODO_PRODUCT_BATCH_ID: "prod_batch",
    DODO_PRODUCT_PRO_ID: "prod_pro",
    AICONVERTER_BUCKET: {},
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs WHERE id = ? AND token_hash = ?")) {
          return {
            bind(id, hash) {
              return { first: async () => (jobs.get(id)?.token_hash === hash ? jobs.get(id) : null) };
            }
          };
        }
        if (sql.startsWith("INSERT INTO batch_checkouts")) {
          return {
            bind(id, planId, amount, currency, jobCount, jobIdsJson, email, createdAt, updatedAt) {
              return {
                run: async () => {
                  batches.set(id, {
                    id,
                    status: "created",
                    plan_id: planId,
                    amount,
                    currency,
                    job_count: jobCount,
                    job_ids_json: jobIdsJson,
                    email,
                    created_at: createdAt,
                    updated_at: updatedAt
                  });
                }
              };
            }
          };
        }
        if (sql.startsWith("UPDATE batch_checkouts SET checkout_session_id")) {
          return {
            bind(checkoutSessionId, updatedAt, id) {
              return {
                run: async () => Object.assign(batches.get(id), { checkout_session_id: checkoutSessionId, updated_at: updatedAt })
              };
            }
          };
        }
        if (sql.startsWith("UPDATE batch_checkouts SET status = 'checkout_created'")) {
          return {
            bind(updatedAt, id) {
              return {
                run: async () => Object.assign(batches.get(id), { status: "checkout_created", updated_at: updatedAt })
              };
            }
          };
        }
        if (sql.startsWith("SELECT * FROM batch_checkouts WHERE id = ?")) {
          return {
            bind(id) {
              return { first: async () => batches.get(id) || null };
            }
          };
        }
        if (sql.startsWith("UPDATE batch_checkouts SET payment_id")) {
          return {
            bind(paymentId, status, paidAt, updatedAt, id) {
              return {
                run: async () => Object.assign(batches.get(id), { payment_id: paymentId, status, paid_at: paidAt, updated_at: updatedAt })
              };
            }
          };
        }
        if (sql.startsWith("UPDATE jobs SET payment_id")) {
          return {
            bind(paymentId, paidAt, updatedAt, batchId) {
              return {
                run: async () => {
                  for (const job of jobs.values()) {
                    if (job.batch_id === batchId) Object.assign(job, { payment_id: paymentId, paid_at: job.paid_at || paidAt, updated_at: updatedAt });
                  }
                }
              };
            }
          };
        }
        if (sql.startsWith("UPDATE jobs SET")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  const assignments = sql.match(/SET (.*) WHERE/)?.[1]?.split(", ") || [];
                  const id = values.at(-1);
                  const job = jobs.get(id);
                  assignments.forEach((assignment, index) => {
                    const key = assignment.split(" = ")[0];
                    if (key !== "updated_at") job[key] = values[index];
                  });
                }
              };
            }
          };
        }
        if (sql.startsWith("INSERT INTO dodo_payment_events")) {
          return {
            bind(...values) {
              return { run: async () => paymentEvents.push(values) };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };
}

function previewJob(id, tokenHash, pages) {
  return {
    id,
    token_hash: tokenHash,
    status: "preview_ready",
    paid_at: "",
    plan_id: "starter",
    estimated_pages: pages,
    converter_id: "bank",
    result_key: `jobs/${id}/result.csv`,
    expires_at: futureExpiry()
  };
}
