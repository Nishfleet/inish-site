import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as download } from "../functions/api/download.js";
import { onRequestPost as batchDownload } from "../functions/api/batch-download.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

// Locks the free full-export gate that customer trials rely on
// (see ops/customer-trials.md): a complete job downloads with paid_at set, or
// without paid_at only when FREE_DOWNLOADS_ENABLED === "true".
test("download: unpaid complete job is gated to 402 by default", async () => {
  const { jobs, objects } = await jobFixture("job_unpaid", { paid_at: null });
  const response = await downloadRequest(jobs, objects, { freeDownloads: false, jobId: "job_unpaid" });

  assert.equal(response.status, 402);
  assert.match(await response.text(), /Payment is required/);
  assert.equal(jobs.get("job_unpaid").download_count, 0);
});

test("download: unpaid complete job downloads free when FREE_DOWNLOADS_ENABLED is true", async () => {
  const { jobs, objects } = await jobFixture("job_trial", { paid_at: null });
  const response = await downloadRequest(jobs, objects, { freeDownloads: true, jobId: "job_trial" });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(response.headers.get("content-disposition"), /aiconverter-May-Statement-clean\.csv/);
  assert.equal(await response.text(), "Date,Description,Amount\n05/01/2026,Stripe,100.00\n");
  assert.equal(jobs.get("job_trial").download_count, 1);
});

test("download: paid job downloads regardless of the free-downloads flag", async () => {
  const { jobs, objects } = await jobFixture("job_paid", { paid_at: "2026-05-18T00:00:00.000Z" });
  const response = await downloadRequest(jobs, objects, { freeDownloads: false, jobId: "job_paid" });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "Date,Description,Amount\n05/01/2026,Stripe,100.00\n");
  assert.equal(jobs.get("job_paid").download_count, 1);
});

test("download: unknown or expired job is rejected even with the flag on", async () => {
  const { jobs, objects } = await jobFixture("job_unknown", { paid_at: null });
  const response = await downloadRequest(jobs, objects, { freeDownloads: true, jobId: "missing", token: "nope" });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Unknown or expired/);
});

test("batch download: unpaid job is skipped as payment required unless the flag is on", async () => {
  const { jobs, objects } = await jobFixture("job_trial_batch", { paid_at: null });
  const gated = await batchDownload({
    env: fakeEnv(jobs, objects, false),
    request: new Request("https://aiconverter.app/api/batch-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: [{ jobId: "job_trial_batch", token: "tok_trial" }] })
    })
  });
  assert.equal(gated.status, 400);
  assert.match(await gated.text(), /No completed paid exports/);
  assert.equal(jobs.get("job_trial_batch").download_count, 0);

  const { jobs: freeJobs, objects: freeObjects } = await jobFixture("job_trial_batch", { paid_at: null });
  const free = await batchDownload({
    env: fakeEnv(freeJobs, freeObjects, true),
    request: new Request("https://aiconverter.app/api/batch-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: [{ jobId: "job_trial_batch", token: "tok_trial" }] })
    })
  });
  assert.equal(free.status, 200);
  const zipText = new TextDecoder().decode(await free.arrayBuffer());
  assert.match(zipText, /May Statement\.pdf: included as exports\/aiconverter-May-Statement-clean\.csv/);
});

async function jobFixture(jobId, overrides) {
  const jobs = new Map([
    [
      jobId,
      {
        id: jobId,
        token_hash: await sha256("tok_trial"),
        status: "complete",
        paid_at: overrides.paid_at ?? null,
        converter_id: "bank",
        output_format: "csv",
        result_key: `jobs/${jobId}/result.csv`,
        original_file_name: "May Statement.pdf",
        expires_at: futureExpiry(),
        download_count: 0
      }
    ]
  ]);
  const objects = new Map([
    [`jobs/${jobId}/result.csv`, "Date,Description,Amount\n05/01/2026,Stripe,100.00\n"]
  ]);
  return { jobs, objects };
}

async function downloadRequest(jobs, objects, { freeDownloads, jobId = "job_trial", token = "tok_trial" }) {
  return download({
    env: fakeEnv(jobs, objects, freeDownloads),
    request: new Request("https://aiconverter.app/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, token })
    })
  });
}

function fakeEnv(jobs, objects, freeDownloads) {
  return {
    FREE_DOWNLOADS_ENABLED: freeDownloads ? "true" : "false",
    AICONVERTER_BUCKET: {
      get: async (key) =>
        objects.has(key)
          ? {
              body: objects.get(key),
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
