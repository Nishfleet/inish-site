import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as redoGet, onRequestPost as redo } from "../functions/api/redo.js";
import { sha256 } from "../functions/lib/jobs.js";

const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const nowIso = () => new Date().toISOString();
const dayAgoIso = () => new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

// Locks the paid-redo money gate (public promise: "One automatic stronger redo
// for paid jobs"): unpaid jobs never redo, exactly one redo per paid job, the
// redo window is bounded by source retention, universal converters do not use
// the AI redo path, and a failed post-payment redo fails closed with the job
// marked failed and a refund due (credit_due when no cash payment exists).
test("redo: GET is not allowed", async () => {
  const response = await redoGet();
  assert.equal(response.status, 405);
  assert.match(await response.text(), /Method not allowed/);
});

test("redo: missing storage bindings is a 500", async () => {
  const response = await redo({
    env: {},
    request: new Request("https://aiconverter.app/api/redo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "job_x", token: "tok" })
    })
  });
  assert.equal(response.status, 500);
  assert.match(await response.text(), /not configured/);
});

test("redo: invalid JSON is a 400", async () => {
  const response = await redo({
    env: (await fakeEnv({})).env,
    request: new Request("https://aiconverter.app/api/redo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json"
    })
  });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid redo request/);
});

test("redo: unknown job is a 400", async () => {
  const response = await redo({
    env: (await fakeEnv({})).env,
    request: new Request("https://aiconverter.app/api/redo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "job_missing", token: "tok_redo" })
    })
  });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Unknown or expired/);
});

test("redo: unpaid job is a 402 even when otherwise eligible", async () => {
  const job = baseJob({ paid_at: null });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 402);
  const payload = await response.json();
  assert.match(payload.error, /only after payment/);
});

test("redo: universal converter job is a 400 (no AI redo path)", async () => {
  const job = baseJob({ converter_id: "universal-file", paid_at: nowIso() });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /do not use the AI redo path/);
});

test("redo: job that already used its automatic redo is a 429", async () => {
  const job = baseJob({ paid_at: nowIso(), redo_count: 1 });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 429);
  const payload = await response.json();
  assert.match(payload.error, /already used its automatic redo/);
});

test("redo: job not complete or failed is a 400", async () => {
  const job = baseJob({ paid_at: nowIso(), status: "preview_ready" });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /not ready for redo/);
});

test("redo: expired redo window (source already deleted) is a 410", async () => {
  const job = baseJob({ paid_at: nowIso(), source_deleted_at: nowIso() });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 410);
  const payload = await response.json();
  assert.match(payload.error, /redo window has expired/);
});

test("redo: expired redo window (older than 24h source retention) is a 410", async () => {
  const job = baseJob({ paid_at: nowIso(), created_at: dayAgoIso() });
  const response = await redoRequest(job, {});
  assert.equal(response.status, 410);
  const payload = await response.json();
  assert.match(payload.error, /redo window has expired/);
});

test("redo: failed post-payment redo marks the job failed and refund due, never charged again", async () => {
  const job = baseJob({ paid_at: nowIso(), download_count: 0 });
  const { env, updates, inserts } = await fakeEnv({ job }, { sourcePresent: false });
  const response = await redoRequest(job, { env });

  // runFullConversion throws on a missing source object; the redo endpoint
  // fails closed: failed status, refund due, source lifecycle recorded.
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "failed");
  assert.equal(payload.redoAvailable, false);
  assert.match(payload.refundStatus, /credit_due|refund_due/);

  const failedUpdate = updates.find((u) => u.values.includes("failed"));
  assert.ok(failedUpdate, "job status update to failed is recorded");
  const refundDueUpdate = updates.find((u) => u.values.some((v) => v === "credit_due" || v === "refund_due"));
  assert.ok(refundDueUpdate, "refund due is recorded on the job");
  assert.ok(inserts.some((i) => i.sql.startsWith("INSERT INTO dodo_refund_events")), "refund event is recorded");
  assert.ok(inserts.some((i) => i.sql.startsWith("INSERT INTO job_attempts")), "attempt is recorded");
});

test("redo: a paid job keeps redo_count unchanged until the redo actually runs", async () => {
  // Gate rejection paths must not consume the automatic redo: a 410 window
  // expiry leaves redo_count untouched, so a redo is not burned on a rejected
  // request.
  const job = baseJob({ paid_at: nowIso(), source_deleted_at: nowIso() });
  const { env, updates } = await fakeEnv({ job });
  const response = await redoRequest(job, { env });
  assert.equal(response.status, 410);
  assert.ok(!updates.some((u) => u.sql.includes("redo_count")), "redo_count is not incremented on a rejected redo");
});

async function redoRequest(job, { env } = {}) {
  return redo({
    env: env || (await fakeEnv({ job })).env,
    request: new Request("https://aiconverter.app/api/redo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token: "tok_redo" })
    })
  });
}

function baseJob(overrides = {}) {
  return {
    id: "job_redo",
    token_hash: "pending",
    status: "complete",
    plan_id: "starter",
    converter_id: "bank",
    output_format: "csv",
    result_key: "jobs/job_redo/result.csv",
    source_key: "sources/job_redo/source.pdf",
    original_file_name: "May Statement.pdf",
    paid_at: overrides.paid_at ?? null,
    redo_count: 0,
    download_count: 0,
    created_at: nowIso(),
    expires_at: futureExpiry(),
    ...overrides
  };
}

async function fakeEnv({ job } = {}, { sourcePresent = true } = {}) {
  const storedJob = job ? { ...job, token_hash: await sha256("tok_redo") } : null;
  const updates = [];
  const inserts = [];

  const applyUpdate = (sql, values) => {
    updates.push({ sql, values });
    if (!storedJob) return;
    const setClause = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] || "";
    const assignments = setClause.split(",").map((part) => part.trim()).filter(Boolean);
    assignments.forEach((assignment, index) => {
      const match = assignment.match(/^(\w+)\s*=\s*\?$/);
      if (!match) return;
      const column = match[1];
      if (column === "updated_at") return;
      storedJob[column] = values[index];
    });
  };

  return {
    env: {
      AICONVERTER_BUCKET: {
        get: async () =>
          sourcePresent
            ? {
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
                text: async () => "pdf"
              }
            : null,
        delete: async () => {},
        put: async () => {}
      },
      AICONVERTER_DB: {
        prepare(sql) {
          if (sql.startsWith("SELECT * FROM jobs")) {
            return {
              bind(id, tokenHash) {
                return {
                  first: async () => (storedJob && id === storedJob.id && tokenHash === storedJob.token_hash ? storedJob : null)
                };
              }
            };
          }
          if (sql.startsWith("UPDATE jobs SET")) {
            return {
              bind(...values) {
                return {
                  run: async () => applyUpdate(sql, values)
                };
              }
            };
          }
          if (sql.startsWith("INSERT INTO")) {
            return {
              bind(...values) {
                return {
                  run: async () => {
                    inserts.push({ sql, values });
                  }
                };
              }
            };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        }
      }
    },
    updates,
    inserts
  };
}
