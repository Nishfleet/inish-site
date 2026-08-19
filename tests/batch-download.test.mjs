import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as batchDownload } from "../functions/api/batch-download.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("batch ZIP includes available exports and skips expired selections", async () => {
  const token = "tok_batch";
  const tokenHash = await sha256(token);
  const jobs = new Map([
    [
      "job_batch_1",
      {
        id: "job_batch_1",
        token_hash: tokenHash,
        status: "complete",
        paid_at: "2026-05-18T00:00:00.000Z",
        converter_id: "bank",
        output_format: "quickbooks-csv",
        result_key: "jobs/job_batch_1/result.csv",
        validation_report_key: "jobs/job_batch_1/validation.txt",
        original_file_name: "May Statement.pdf",
        expires_at: futureExpiry(),
        download_count: 0
      }
    ]
  ]);
  const objects = new Map([
    ["jobs/job_batch_1/result.csv", "Date,Description,Amount\n05/01/2026,Stripe,100.00\n"],
    ["jobs/job_batch_1/validation.txt", "AI Converter validation report\n"]
  ]);

  const response = await batchDownload({
    env: fakeEnv(jobs, objects),
    request: new Request("https://aiconverter.app/api/batch-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobs: [
          { jobId: "job_batch_1", token },
          { jobId: "job_expired", token: "missing" }
        ]
      })
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");
  const zipText = new TextDecoder().decode(await response.arrayBuffer());
  assert.match(zipText, /exports\/aiconverter-May-Statement-quickbooks\.csv/);
  assert.match(zipText, /reports\/aiconverter-May-Statement-validation-report\.txt/);
  assert.match(zipText, /job_expired: skipped, unknown or expired/);
  assert.equal(jobs.get("job_batch_1").download_count, 1);
});

function fakeEnv(jobs, objects) {
  return {
    AICONVERTER_BUCKET: {
      get: async (key) =>
        objects.has(key)
          ? {
              text: async () => objects.get(key),
              arrayBuffer: async () => new TextEncoder().encode(objects.get(key)).buffer
            }
          : null
    },
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs WHERE id = ? AND token_hash = ?")) {
          return {
            bind(id, tokenHash) {
              return {
                first: async () => {
                  const job = jobs.get(id);
                  return job && tokenHash === job.token_hash ? job : null;
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
