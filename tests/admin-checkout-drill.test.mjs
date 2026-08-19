import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as checkoutDrill } from "../functions/api/admin/checkout-drill.js";

test("admin checkout drill creates a trusted Dodo handoff without exposing the checkout URL", async () => {
  const originalFetch = globalThis.fetch;
  const jobs = new Map();
  const objects = new Map();
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://live.dodopayments.com/checkouts");
    const body = JSON.parse(options.body);
    assert.equal(body.product_cart[0].product_id, "prod_starter");
    assert.equal(body.metadata.plan_id, "starter");
    return Response.json({
      session_id: "cks_admin_drill",
      checkout_url: "https://checkout.dodopayments.com/session/cks_admin_drill"
    });
  };

  try {
    const response = await checkoutDrill({
      env: fakeEnv(jobs, objects),
      request: new Request("https://aiconverter.app/api/admin/checkout-drill", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${"a".repeat(32)}`,
          "Content-Type": "application/json"
        },
        body: "{}"
      })
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.mode, "checkout");
    assert.equal(payload.checkoutHost, "checkout.dodopayments.com");
    assert.equal(payload.checkoutUrl, undefined);
    assert.equal(payload.token, undefined);
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") || "", /SameSite=Lax/);
    assert.equal(jobs.get(payload.jobId).checkout_session_id, "cks_admin_drill");
    assert.equal(jobs.get(payload.jobId).original_file_name, "checkout-drill-statement.pdf");
    assert.equal(jobs.get(payload.jobId).input_mime_type, "application/pdf");
    assert.ok(objects.has(`jobs/${payload.jobId}/preview.csv`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin checkout drill can return a real operator checkout URL and token when explicitly requested", async () => {
  const originalFetch = globalThis.fetch;
  const jobs = new Map();
  const objects = new Map();
  globalThis.fetch = async () =>
    Response.json({
      session_id: "cks_operator_drill",
      checkout_url: "https://checkout.dodopayments.com/session/cks_operator_drill"
    });

  try {
    const response = await checkoutDrill({
      env: fakeEnv(jobs, objects),
      request: new Request("https://aiconverter.app/api/admin/checkout-drill", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${"a".repeat(32)}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ returnCheckoutUrl: true, includeToken: true })
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.checkoutUrl, "https://checkout.dodopayments.com/session/cks_operator_drill");
    assert.match(payload.token, /^[a-f0-9]{48}$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function fakeEnv(jobs, objects) {
  return {
    ADMIN_TOKEN: "a".repeat(32),
    DODO_PAYMENTS_API_KEY: "dodo_test",
    DODO_PRODUCT_STARTER_ID: "prod_starter",
    AICONVERTER_BUCKET: {
      put: async (key, value) => {
        objects.set(key, value);
      }
    },
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("INSERT INTO jobs")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  const job = {
                    id: values[0],
                    token_hash: values[1],
                    status: values[2],
                    plan_id: values[3],
                    email: values[4],
                    source_key: values[5],
                    result_key: values[6],
                    original_file_name: values[7],
                    file_size: values[8],
                    estimated_pages: values[9],
                    file_hash: values[10],
                    ip_hash: values[11],
                    user_agent_hash: values[12],
                    converter_id: values[13],
                    input_mime_type: values[14],
                    output_format: values[15],
                    accounting_metadata_json: values[16],
                    created_at: values[17],
                    updated_at: values[18],
                    expires_at: values[19]
                  };
                  jobs.set(job.id, job);
                }
              };
            }
          };
        }
        if (sql.startsWith("SELECT * FROM jobs WHERE id = ?")) {
          return {
            bind(id) {
              return {
                first: async () => jobs.get(id) || null
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
                  const job = jobs.get(id) || {};
                  assignments.forEach((assignment, index) => {
                    const key = assignment.split(" = ")[0];
                    if (key !== "updated_at") job[key] = values[index];
                  });
                  jobs.set(id, job);
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
