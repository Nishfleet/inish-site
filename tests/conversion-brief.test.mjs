import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequestPost } from "../functions/api/conversion-brief.js";
import { buildConversionBrief } from "../functions/lib/conversion-brief.js";
import { sha256 } from "../functions/lib/jobs.js";

test("conversion brief API returns safe self-serve state for an authorized accounting job", async () => {
  const token = "brief_token_123";
  const job = {
    id: "job_brief_123",
    token_hash: await sha256(token),
    status: "complete",
    plan_id: "starter",
    converter_id: "bank",
    output_format: "quickbooks-csv",
    row_count: 18,
    confidence: 0.92,
    paid_at: "2026-06-18T06:00:00.000Z",
    validation_report_key: "jobs/job_brief_123/validation.txt",
    source_key: "sources/job_brief_123/source.pdf",
    preview_key: "jobs/job_brief_123/preview.csv",
    result_key: "jobs/job_brief_123/result.csv",
    ip_hash: "private-ip-hash",
    user_agent_hash: "private-ua-hash",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  const response = await onRequestPost({
    env: fakeEnv(job, { event_type: "payment.succeeded", status: "succeeded" }),
    request: new Request("https://aiconverter.app/api/conversion-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, token })
    })
  });
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.mode, "self_serve_download");
  assert.equal(payload.outputLabel, "QuickBooks CSV");
  assert.equal(payload.validation.available, true);
  assert.equal(payload.accountingReadiness.applicable, true);
  assert.match(payload.support.href, /category=conversion/);
  assert.match(payload.support.href, /jobId=job_brief_123/);
  assert.match(payload.support.safeMessage, /Do not paste/);
  assert.ok(payload.nextActions.some((action) => /validation report/i.test(action)));
  assert.doesNotMatch(serialized, /source_key|preview_key|result_key|validation_report_key|token_hash|ip_hash|user_agent_hash/);
  assert.doesNotMatch(serialized, /sources\/job_brief_123|private-ip-hash|private-ua-hash/);
});

test("conversion brief maps failed previews to safe support handoff", () => {
  const brief = buildConversionBrief({
    id: "job_failed_preview",
    status: "failed",
    converter_id: "bank",
    output_format: "csv",
    row_count: 0,
    confidence: 0,
    created_at: new Date().toISOString()
  });

  assert.equal(brief.mode, "safe_failure");
  assert.match(brief.summary, /stopped safely/i);
  assert.ok(brief.nextActions.some((action) => /clearer, smaller, unlocked file/i.test(action)));
  assert.deepEqual(brief.support.doNotShare.includes("source file"), true);
});

test("conversion brief routes paid failed exports to refund support", () => {
  const brief = buildConversionBrief({
    id: "job_paid_failed",
    status: "failed",
    converter_id: "bank",
    output_format: "csv",
    row_count: 0,
    confidence: 0,
    paid_at: "2026-06-18T06:10:00.000Z",
    refund_status: "refund_due",
    created_at: new Date().toISOString()
  });

  assert.equal(brief.mode, "refund_review");
  assert.match(brief.summary, /paid export failed/i);
  assert.match(brief.support.href, /category=refund/);
  assert.ok(brief.nextActions.some((action) => /refund support/i.test(action)));
  assert.doesNotMatch(brief.summary, /No charge should be made/);
});

test("conversion brief treats successful payment events as paid failures", () => {
  const brief = buildConversionBrief(
    {
      id: "job_event_paid_failed",
      status: "failed",
      converter_id: "bank",
      output_format: "csv",
      row_count: 0,
      confidence: 0,
      paid_at: "",
      created_at: new Date().toISOString()
    },
    { paymentEvent: { event_type: "payment.succeeded", status: "succeeded", match_status: "matched" } }
  );

  assert.equal(brief.mode, "refund_review");
  assert.equal(brief.payment.paid, true);
  assert.match(brief.support.href, /category=refund/);
  assert.doesNotMatch(brief.summary, /No charge should be made/);
});

test("conversion brief ignores rejected successful-looking payment events", () => {
  const brief = buildConversionBrief(
    {
      id: "job_rejected_payment_failed",
      status: "failed",
      converter_id: "bank",
      output_format: "csv",
      row_count: 0,
      confidence: 0,
      paid_at: "",
      created_at: new Date().toISOString()
    },
    { paymentEvent: { event_type: "payment.succeeded", status: "succeeded", match_status: "amount_too_low" } }
  );

  assert.equal(brief.mode, "safe_failure");
  assert.equal(brief.payment.paid, false);
  assert.match(brief.support.href, /category=conversion/);
});

test("conversion brief does not suggest redo when the job cannot redo", () => {
  const brief = buildConversionBrief({
    id: "job_universal_complete",
    status: "complete",
    converter_id: "universal-file",
    output_format: "pdf",
    row_count: 1,
    confidence: 1,
    paid_at: "2026-06-18T06:20:00.000Z",
    redo_count: 0,
    created_at: new Date().toISOString()
  });

  assert.equal(brief.redo.available, false);
  assert.ok(!brief.nextActions.some((action) => /stronger redo/i.test(action)));
});

test("conversion brief UI is wired into the result panel", () => {
  const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const route = readFileSync(new URL("../functions/api/conversion-brief.js", import.meta.url), "utf8");

  assert.match(source, /api\/conversion-brief/);
  assert.match(route, /COALESCE\(match_status, ''\) IN \('', 'matched'\)/);
  assert.match(source, /result\?\.conversionBrief/);
  assert.match(source, /const deletionBrief = activeConversionBrief/);
  assert.match(source, /setConversionBrief\(null\);\n    fetchJson\("\/api\/conversion-brief"/);
  assert.match(source, /conversionBrief\?\.jobId && conversionBrief\.jobId === result\?\.jobId/);
  assert.match(source, /function renderConversionBriefCard/);
  assert.match(source, /conversionBriefModeLabel/);
  assert.match(source, /refund_review: "Refund review"/);
  assert.match(source, /conversion-brief-card/);
  assert.match(source, /Refund support/);
  assert.match(source, /Support handoff/);
  assert.match(source, /accountingReadiness/);
  assert.match(styles, /\.conversion-brief-card/);
  assert.match(styles, /\.conversion-brief-caution/);
});

function fakeEnv(job, paymentEvent = null) {
  return {
    AICONVERTER_BUCKET: {},
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
