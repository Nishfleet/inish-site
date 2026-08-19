import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/delete-job.js";
import { jobAccessCookie, sha256 } from "../functions/lib/jobs.js";

test("authorized delete removes stored job objects and clears matching cookie", async () => {
  const token = "tok_123";
  const tokenHash = await sha256(token);
  const deletedKeys = [];
  const updates = [];
  const job = {
    id: "job_123",
    token_hash: tokenHash,
    status: "complete",
    source_key: "sources/job_123/source.pdf",
    preview_key: "jobs/job_123/preview.csv",
    result_key: "jobs/job_123/result.csv",
    validation_report_key: "jobs/job_123/validation.txt",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  const env = {
    AICONVERTER_BUCKET: {
      delete: async (key) => {
        deletedKeys.push(key);
      }
    },
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs")) {
          return {
            bind(id, hash) {
              return {
                first: async () => (id === job.id && hash === tokenHash ? job : null)
              };
            }
          };
        }
        if (sql.startsWith("UPDATE jobs SET")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  updates.push({ sql, values });
                }
              };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };

  const response = await onRequestPost({
    env,
    request: new Request("https://aiconverter.app/api/delete-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: jobAccessCookie(job.id, token).split(";")[0]
      },
      body: JSON.stringify({ jobId: job.id })
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(deletedKeys.sort(), [
    "jobs/job_123/preview.csv",
    "jobs/job_123/result.csv",
    "jobs/job_123/validation.txt",
    "sources/job_123/source.pdf"
  ]);
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /status = \?/);
  assert.equal(updates[0].values[0], "deleted");
  assert.match(response.headers.get("Set-Cookie") || "", /Max-Age=0/);

  const payload = await response.json();
  assert.equal(payload.status, "deleted");
  assert.equal(payload.sourceDeletedAt.length > 0, true);
});

function makeJob(id = "job_123") {
  return {
    id,
    token_hash: "hash",
    status: "complete",
    source_key: `sources/${id}/source.pdf`,
    preview_key: `jobs/${id}/preview.csv`,
    result_key: `jobs/${id}/result.csv`,
    validation_report_key: `jobs/${id}/validation.txt`,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function makeTestEnv(job, failKeys) {
  const deletedKeys = [];
  const updates = [];
  const env = {
    AICONVERTER_BUCKET: {
      delete: async (key) => {
        deletedKeys.push(key);
        if (failKeys.has(key)) throw new Error(`R2 delete failed for ${key}`);
      }
    },
    AICONVERTER_DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT * FROM jobs")) {
          return {
            bind(id, hash) {
              return {
                first: async () => (id === job.id ? job : null)
              };
            }
          };
        }
        if (sql.startsWith("UPDATE jobs SET")) {
          return {
            bind(...values) {
              return {
                run: async () => {
                  updates.push({ sql, values });
                }
              };
            }
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    }
  };
  return { env, deletedKeys, updates, failKeys };
}

function deleteRequest(job, token = "tok_123") {
  return new Request("https://aiconverter.app/api/delete-job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jobAccessCookie(job.id, token).split(";")[0]
    },
    body: JSON.stringify({ jobId: job.id })
  });
}

test("one R2 delete fails: no deleted status, no 200 receipt, surviving key pointer preserved", async () => {
  const job = makeJob();
  const failingKey = `jobs/${job.id}/result.csv`;
  const { env, deletedKeys, updates } = makeTestEnv(job, new Set([failingKey]));

  const response = await onRequestPost({ env, request: deleteRequest(job) });

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Set-Cookie"), null);
  const payload = await response.json();
  assert.equal(payload.status, undefined);
  assert.match(payload.error, /did not complete/i);
  assert.equal(updates.length, 0, "no DB update means no pointer was cleared");
  assert.deepEqual(deletedKeys.sort(), [
    `jobs/${job.id}/preview.csv`,
    `jobs/${job.id}/result.csv`,
    `jobs/${job.id}/validation.txt`,
    `sources/${job.id}/source.pdf`
  ]);
});

test("every R2 delete fails: no deleted status, no 200 receipt, all four pointers preserved", async () => {
  const job = makeJob();
  const { env, updates, failKeys } = makeTestEnv(job, new Set([
    `sources/${job.id}/source.pdf`,
    `jobs/${job.id}/preview.csv`,
    `jobs/${job.id}/result.csv`,
    `jobs/${job.id}/validation.txt`
  ]));

  const response = await onRequestPost({ env, request: deleteRequest(job) });

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Set-Cookie"), null);
  const payload = await response.json();
  assert.equal(payload.status, undefined);
  assert.match(payload.error, /did not complete/i);
  assert.equal(updates.length, 0, "no DB update means no pointer was cleared");
  assert.equal(failKeys.size, 4);
});

test("retry after a failure with R2 healthy succeeds and clears pointers", async () => {
  const job = makeJob();
  const failKeys = new Set([
    `sources/${job.id}/source.pdf`,
    `jobs/${job.id}/preview.csv`,
    `jobs/${job.id}/result.csv`,
    `jobs/${job.id}/validation.txt`
  ]);
  const { env, updates } = makeTestEnv(job, failKeys);

  const first = await onRequestPost({ env, request: deleteRequest(job) });
  assert.equal(first.status, 500);
  assert.equal(updates.length, 0);

  failKeys.clear();
  const second = await onRequestPost({ env, request: deleteRequest(job) });

  assert.equal(second.status, 200);
  assert.match(second.headers.get("Set-Cookie") || "", /Max-Age=0/);
  const payload = await second.json();
  assert.equal(payload.status, "deleted");
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /status = \?/);
  assert.equal(updates[0].values[0], "deleted");
  assert.equal(updates[0].values[3], "", "source_key pointer cleared");
  assert.equal(updates[0].values[4], "", "preview_key pointer cleared");
  assert.equal(updates[0].values[5], "", "result_key pointer cleared");
  assert.equal(updates[0].values[6], "", "validation_report_key pointer cleared");
});
