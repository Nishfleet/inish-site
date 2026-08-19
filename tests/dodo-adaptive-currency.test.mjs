import test from "node:test";
import assert from "node:assert/strict";
import {
  createDodoCheckout,
  isDodoPaymentAmountTooLow,
  previewDodoPlanPrices,
  processDodoWebhookEvent,
  syncDodoProductPrices
} from "../functions/lib/dodo.js";
import { PLANS } from "../functions/lib/jobs.js";

test("Dodo pricing preview returns Dodo-calculated local totals", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const responses = {
    prod_starter_in: { currency: "INR", current_breakup: { total_amount: 39900 }, billing_country: "IN" },
    prod_batch_in: { currency: "INR", current_breakup: { total_amount: 79900 }, billing_country: "IN" },
    prod_pro_in: { currency: "INR", current_breakup: { total_amount: 139900 }, billing_country: "IN" }
  };

  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), headers: options.headers, body });
    return Response.json(responses[body.product_cart[0].product_id]);
  };

  try {
    const preview = await previewDodoPlanPrices({
      env: {
        DODO_PAYMENTS_API_KEY: "dodo_test",
        DODO_PRODUCT_STARTER_ID: "prod_starter_in",
        DODO_PRODUCT_BATCH_ID: "prod_batch_in",
        DODO_PRODUCT_PRO_ID: "prod_pro_in"
      },
      request: new Request("https://aiconverter.app/api/pricing-preview", {
        headers: { "CF-IPCountry": "IN" }
      })
    });

    assert.equal(preview.available, true);
    assert.equal(preview.provider, "dodo");
    assert.equal(preview.prices.starter.currency, "INR");
    assert.equal(preview.prices.starter.amount, 39900);
    assert.match(preview.prices.starter.display, /399/);
    assert.doesNotMatch(preview.prices.starter.display, /\./);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, "https://live.dodopayments.com/checkouts/preview");
    assert.equal(calls[0].headers.Authorization, "Bearer dodo_test");
    assert.equal(calls[0].body.billing_address.country, "IN");
    assert.equal("adaptive_currency_fees_inclusive" in calls[0].body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Dodo checkout requests fee-inclusive adaptive currency", async () => {
  const originalFetch = globalThis.fetch;
  let checkoutBody;
  globalThis.fetch = async (_url, options = {}) => {
    checkoutBody = JSON.parse(options.body);
    return Response.json({
      session_id: "cks_test",
      checkout_url: "https://checkout.dodopayments.com/session/cks_test"
    });
  };

  const updates = [];
  const env = {
    DODO_PAYMENTS_API_KEY: "dodo_test",
    DODO_PRODUCT_STARTER_ID: "prod_starter",
    DODO_CURRENCY: "INR",
    AICONVERTER_DB: {
      prepare(sql) {
        return {
          bind(...values) {
            updates.push({ sql, values });
            return { run: async () => ({ success: true }) };
          }
        };
      }
    }
  };

  try {
    const checkoutUrl = await createDodoCheckout({
      env,
      request: new Request("https://aiconverter.app/api/checkout", {
        headers: { "CF-IPCountry": "AU" }
      }),
      job: { id: "job_123" },
      plan: PLANS.starter,
      email: "customer@example.com"
    });

    assert.equal(checkoutUrl, "https://checkout.dodopayments.com/session/cks_test");
    assert.equal(checkoutBody.adaptive_currency_fees_inclusive, true);
    assert.equal(checkoutBody.billing_address.country, "AU");
    assert.equal(checkoutBody.customer.email, "customer@example.com");
    assert.equal(checkoutBody.metadata.expected_amount, "39900");
    assert.equal(checkoutBody.metadata.expected_currency, "INR");
    assert.equal(updates.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Dodo failed payment webhooks are recorded without unlocking the job", async () => {
  const job = {
    id: "job_failed_payment",
    plan_id: "starter",
    checkout_session_id: "cks_failed_payment",
    payment_id: "",
    paid_at: ""
  };
  const paymentEvents = [];

  const result = await processDodoWebhookEvent(
    fakePaymentEventEnv(job, paymentEvents),
    {
      type: "payment.failed",
      data: {
        id: "pay_failed_payment",
        checkout_session_id: "cks_failed_payment",
        status: "failed",
        total_amount: 39900,
        currency: "INR",
        business_id: "biz_test",
        metadata: { job_id: job.id, plan_id: "starter" },
        product_cart: [{ product_id: "prod_starter" }]
      }
    },
    { webhookId: "evt_failed_payment", payloadHash: "hash_failed_payment" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.ignored, true);
  assert.equal(result.reason, "not_paid");
  assert.equal(job.payment_id, "");
  assert.equal(job.paid_at, "");
  assert.equal(paymentEvents.length, 1);
  assert.equal(paymentEvents[0].event_type, "payment.failed");
  assert.equal(paymentEvents[0].job_id, job.id);
  assert.equal(paymentEvents[0].payment_id, "pay_failed_payment");
  assert.equal(paymentEvents[0].status, "failed");
  assert.equal(paymentEvents[0].match_status, "matched");
});

test("adaptive currency payments are not rejected as underpaid local minor units", () => {
  assert.equal(
    isDodoPaymentAmountTooLow({}, { amount: 250, currency: "INR" }, PLANS.starter),
    false
  );
  assert.equal(
    isDodoPaymentAmountTooLow({}, { amount: 250, currency: "USD" }, PLANS.starter),
    true
  );
  assert.equal(
    isDodoPaymentAmountTooLow({ DODO_ADAPTIVE_CURRENCY: "false", DODO_CURRENCY: "INR" }, { amount: 250, currency: "INR" }, PLANS.starter),
    true
  );
});

function fakePaymentEventEnv(job, paymentEvents) {
  return {
    DODO_BUSINESS_ID: "biz_test",
    DODO_PRODUCT_STARTER_ID: "prod_starter",
    DODO_CURRENCY: "INR",
    DODO_ADAPTIVE_CURRENCY: "false",
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs WHERE id = ?")) {
          return {
            bind(id) {
              return { first: async () => (id === job.id ? job : null) };
            }
          };
        }
        if (sql.startsWith("SELECT * FROM jobs WHERE checkout_session_id = ?")) {
          return {
            bind(checkoutSessionId) {
              return { first: async () => (checkoutSessionId === job.checkout_session_id ? job : null) };
            }
          };
        }
        if (sql.startsWith("SELECT * FROM jobs WHERE payment_id = ?")) {
          return {
            bind(paymentId) {
              return { first: async () => (paymentId && paymentId === job.payment_id ? job : null) };
            }
          };
        }
        if (sql.startsWith("INSERT INTO dodo_payment_events")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  paymentEvents.push({
                    id: values[0],
                    provider_event_id: values[1],
                    event_type: values[2],
                    job_id: values[3],
                    payment_id: values[4],
                    checkout_session_id: values[5],
                    product_id: values[6],
                    plan_id: values[7],
                    status: values[8],
                    amount: values[9],
                    currency: values[10],
                    business_id: values[11],
                    matched_by: values[12],
                    match_status: values[13]
                  });
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
                  assignments.forEach((assignment, index) => {
                    const key = assignment.split(" = ")[0];
                    if (key !== "updated_at") job[key] = values[index];
                  });
                }
              };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };
}

test("Dodo product price sync patches INR one-time prices", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    return Response.json({ price: JSON.parse(options.body).price });
  };

  try {
    const result = await syncDodoProductPrices({
      DODO_PAYMENTS_API_KEY: "dodo_test",
      DODO_PRODUCT_STARTER_ID: "prod_starter",
      DODO_PRODUCT_BATCH_ID: "prod_batch",
      DODO_PRODUCT_PRO_ID: "prod_pro"
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, "https://live.dodopayments.com/products/prod_starter");
    assert.equal(calls[0].headers.Authorization, "Bearer dodo_test");
    assert.deepEqual(calls.map((call) => call.body.price.price), [39900, 79900, 139900]);
    assert.deepEqual(calls.map((call) => call.body.price.currency), ["INR", "INR", "INR"]);
    assert.deepEqual(calls.map((call) => call.body.price.purchasing_power_parity), [true, true, true]);
    assert.deepEqual(calls.map((call) => call.body.price.type), ["one_time_price", "one_time_price", "one_time_price"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
