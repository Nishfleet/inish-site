import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as loadRows } from "../functions/api/result-rows.js";
import { onRequestPost as saveRows } from "../functions/api/update-result-rows.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("paid bank CSV export rows can be loaded and saved", async () => {
  const token = "tok_rows";
  const tokenHash = await sha256(token);
  const updates = [];
  const objects = new Map([
    ["jobs/job_rows/result.csv", "Date,Description,Amount\n05/01/2026,Stripe,1000.00\n"]
  ]);
  const job = {
    id: "job_rows",
    token_hash: tokenHash,
    status: "complete",
    paid_at: "2026-05-18T00:00:00.000Z",
    converter_id: "bank",
    output_format: "quickbooks-csv",
    result_key: "jobs/job_rows/result.csv",
    validation_report_key: "jobs/job_rows/validation.txt",
    original_file_name: "statement.pdf",
    expires_at: futureExpiry()
  };
  const env = fakeEnv(job, objects, updates);

  const loadResponse = await loadRows({
    env,
    request: new Request("https://aiconverter.app/api/result-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token })
    })
  });
  assert.equal(loadResponse.status, 200);
  const loaded = await loadResponse.json();
  assert.equal(loaded.outputFormat, "quickbooks-csv");
  assert.deepEqual(loaded.columns.map((column) => column.key), ["Date", "Description", "Amount"]);
  assert.equal(loaded.rows[0].Description, "Stripe");

  const saveResponse = await saveRows({
    env,
    request: new Request("https://aiconverter.app/api/update-result-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        token,
        columns: loaded.columns,
        rows: [{ Date: "05/01/2026", Description: "Stripe payout", Amount: "1000.00" }]
      })
    })
  });
  assert.equal(saveResponse.status, 200);
  assert.match(objects.get("jobs/job_rows/result.csv"), /Stripe payout/);
  assert.match(objects.get("jobs/job_rows/validation.txt"), /Rows saved: 1/);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].fields.row_count, 1);
});

test("bank-feed exports do not expose row editor", async () => {
  const token = "tok_ofx";
  const tokenHash = await sha256(token);
  const job = {
    id: "job_ofx",
    token_hash: tokenHash,
    status: "complete",
    paid_at: "2026-05-18T00:00:00.000Z",
    converter_id: "bank",
    output_format: "ofx",
    result_key: "jobs/job_ofx/result.ofx"
  };
  const response = await loadRows({
    env: fakeEnv(job, new Map([["jobs/job_ofx/result.ofx", "OFXHEADER:100\n"]]), []),
    request: new Request("https://aiconverter.app/api/result-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token })
    })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /bank-feed file/);
});

test("inline row editor refuses to save truncated large exports", async () => {
  const token = "tok_large_rows";
  const tokenHash = await sha256(token);
  const csv = [
    "Date,Description,Amount",
    ...Array.from({ length: 5001 }, (_, index) => `05/01/2026,Row ${index + 1},1.00`)
  ].join("\n");
  const objects = new Map([["jobs/job_large/result.csv", `${csv}\n`]]);
  const job = {
    id: "job_large",
    token_hash: tokenHash,
    status: "complete",
    paid_at: "2026-05-18T00:00:00.000Z",
    converter_id: "bank",
    output_format: "quickbooks-csv",
    result_key: "jobs/job_large/result.csv",
    original_file_name: "large-statement.pdf",
    expires_at: futureExpiry()
  };

  const response = await saveRows({
    env: fakeEnv(job, objects, []),
    request: new Request("https://aiconverter.app/api/update-result-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        token,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Description", label: "Description" },
          { key: "Amount", label: "Amount" }
        ],
        rows: [{ Date: "05/01/2026", Description: "Only one row", Amount: "1.00" }]
      })
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /more than 5000 rows/);
  assert.match(objects.get("jobs/job_large/result.csv"), /Row 5001/);
});

function fakeEnv(job, objects, updates) {
  return {
    AICONVERTER_BUCKET: {
      get: async (key) =>
        objects.has(key)
          ? {
              text: async () => objects.get(key),
              arrayBuffer: async () => new TextEncoder().encode(objects.get(key)).buffer
            }
          : null,
      put: async (key, value) => {
        objects.set(key, String(value));
      }
    },
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs")) {
          return {
            bind(id, hash) {
              return {
                first: async () => (id === job.id && hash === job.token_hash ? job : null)
              };
            }
          };
        }
        if (sql.startsWith("UPDATE jobs SET")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  const fields = {};
                  const assignments = sql.match(/SET (.*) WHERE/)?.[1]?.split(", ") || [];
                  assignments.forEach((assignment, index) => {
                    const key = assignment.split(" = ")[0];
                    if (key !== "updated_at") fields[key] = values[index];
                  });
                  updates.push({ sql, values, fields });
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
