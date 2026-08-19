import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isActionableUnmatchedPayment } from "../functions/api/admin/overview.js";

test("admin overview exposes preview funnel counts and safe issue rows", () => {
  const apiSource = readFileSync(new URL("../functions/api/admin/overview.js", import.meta.url), "utf8");
  const adminSource = readFileSync(new URL("../public/admin/admin.js", import.meta.url), "utf8");

  assert.match(apiSource, /FROM preview_funnel_events/);
  assert.match(apiSource, /previewFunnel/);
  assert.match(apiSource, /previewFunnelByRoute/);
  assert.match(apiSource, /previewFunnelIssues/);
  assert.match(apiSource, /previewErrors/);
  assert.match(apiSource, /turnstileFailures/);
  assert.match(apiSource, /customerRefundDue/);
  assert.match(apiSource, /drillRefundDue/);
  assert.match(apiSource, /Drill refund retry needed/);
  // Unmatched-payment noise filter: failed attempts without an app job and
  // zero-amount succeeded sandbox events are excluded from the alert list.
  assert.match(apiSource, /AND COALESCE\(amount, 0\) = 0/);
  assert.match(apiSource, /isNonActionableTestEvent/);

  assert.match(adminSource, /renderFunnel/);
  assert.match(adminSource, /Preview funnel/);
  assert.match(adminSource, /Privacy-safe events only/i);
  assert.match(adminSource, /Preview funnel issues/);
});

test("failed Dodo attempts and zero-amount sandbox events without an app job do not block readiness", () => {
  assert.equal(
    isActionableUnmatchedPayment({
      event_type: "payment.failed",
      status: "failed",
      match_status: "job_not_found",
      job_id: ""
    }),
    false
  );
  // A zero-amount payment.succeeded with no app job is Dodo sandbox/test
  // noise (decision 2026-08-10): no money moved, so it must not alert.
  assert.equal(
    isActionableUnmatchedPayment({
      event_type: "payment.succeeded",
      status: "succeeded",
      match_status: "job_not_found",
      job_id: "",
      amount: 0
    }),
    false
  );
  // Any paid-but-unmatched succeeded event still alerts, including a
  // zero-amount event that carries an app job id.
  assert.equal(
    isActionableUnmatchedPayment({
      event_type: "payment.succeeded",
      status: "succeeded",
      match_status: "job_not_found",
      job_id: "",
      amount: 99900
    }),
    true
  );
  assert.equal(
    isActionableUnmatchedPayment({
      event_type: "payment.succeeded",
      status: "succeeded",
      match_status: "job_not_found",
      job_id: "job_abc",
      amount: 0
    }),
    true
  );
  assert.equal(
    isActionableUnmatchedPayment({
      event_type: "payment.failed",
      status: "failed",
      match_status: "metadata_job_mismatch",
      job_id: ""
    }),
    true
  );
});
