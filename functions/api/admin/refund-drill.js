import { requireAdmin } from "../../lib/admin-auth.js";
import { requestDodoRefund } from "../../lib/dodo.js";
import { badRequest, json, methodNotAllowed, serverError } from "../../lib/http.js";
import { hasRequiredBindings } from "../../lib/jobs.js";

const DRILL_EMAIL = "admin-drill@aiconverter.app";
const DRILL_FILE = "checkout-drill-statement.pdf";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await readJsonBody(request);
  const jobId = String(body.jobId || "").trim();
  const confirmJobId = String(body.confirmJobId || "").trim();
  if (!jobId || confirmJobId !== jobId) {
    return badRequest("Confirm the exact paid drill job ID before requesting a refund.");
  }

  const job = await env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(jobId).first();
  if (!job) return badRequest("Unknown drill job.");
  if (!isRefundableDrillJob(job)) {
    return badRequest("This endpoint only refunds admin checkout drill jobs.");
  }
  if (!job.paid_at || !job.payment_id) {
    return badRequest("The drill job is not paid yet.");
  }

  const refund = await requestDodoRefund(
    {
      ...env,
      AUTO_REFUNDS_ENABLED: "true",
      AUTO_REFUND_AFTER_DOWNLOAD: "true"
    },
    job,
    String(body.reason || "Operator paid-path drill refund.").slice(0, 3000),
    { cashRefund: true, retryDue: true }
  );

  return json({
    ok: Boolean(refund.status && refund.status !== "refund_due" && refund.status !== "credit_due"),
    jobId: job.id,
    paymentId: job.payment_id,
    refundStatus: refund.status,
    refundId: refund.refundId || "",
    message: refund.refundId
      ? "Refund request sent to Dodo."
      : "Refund could not be sent automatically; review the admin queue."
  });
}

function isRefundableDrillJob(job) {
  return (
    String(job.id || "").startsWith("checkout_drill_") &&
    String(job.email || "") === DRILL_EMAIL &&
    String(job.original_file_name || "") === DRILL_FILE
  );
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) return {};
  return request.json().catch(() => ({}));
}
