import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as previewDownload } from "../functions/api/preview-download.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("preview download returns the free sample CSV before payment", async () => {
  const token = "tok_preview_download";
  const tokenHash = await sha256(token);
  const job = {
    id: "job_preview_download",
    token_hash: tokenHash,
    status: "preview_ready",
    paid_at: "",
    preview_key: "jobs/job_preview_download/preview.csv",
    original_file_name: "May Statement.pdf",
    expires_at: futureExpiry()
  };
  const objects = new Map([
    ["jobs/job_preview_download/preview.csv", "Date,Description,Amount\n2026-05-01,Deposit,100.00\n"]
  ]);

  const response = await previewDownload({
    env: fakeEnv(job, objects),
    request: new Request("https://aiconverter.app/api/preview-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token })
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(response.headers.get("content-disposition") || "", /aiconverter-May-Statement-preview\.csv/);
  assert.match(await response.text(), /Deposit/);
});

test("preview download rejects the wrong token", async () => {
  const tokenHash = await sha256("right_token");
  const job = {
    id: "job_preview_wrong_token",
    token_hash: tokenHash,
    status: "preview_ready",
    preview_key: "jobs/job_preview_wrong_token/preview.csv",
    expires_at: futureExpiry()
  };
  const response = await previewDownload({
    env: fakeEnv(job, new Map()),
    request: new Request("https://aiconverter.app/api/preview-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token: "wrong_token" })
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Unknown or expired/);
});

function fakeEnv(job, objects) {
  return {
    AICONVERTER_BUCKET: {
      get: async (key) =>
        objects.has(key)
          ? {
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
