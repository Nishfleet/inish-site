import { runFullConversion } from "../lib/conversion.js";
import { requestDodoRefund } from "../lib/dodo.js";
import { CONVERTER_COLUMNS } from "../lib/extract.js";
import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { getAuthorizedJob, hasRequiredBindings, jobOutputFormat, PLANS, sourceAvailableForRedo, tokenFromBodyOrCookie, updateJob } from "../lib/jobs.js";
import { isUniversalConverter } from "../lib/universal.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid redo request.");
  }

  const jobId = String(body.jobId || "");
  const bodyToken = String(body.token || "");
  const token = tokenFromBodyOrCookie(request, jobId, bodyToken);
  let job = await getAuthorizedJob(env, jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");
  if (!job.paid_at) return json({ error: "Redo is available only after payment." }, { status: 402 });
  if (isUniversalConverter(job.converter_id)) return json({ error: "File-format conversions do not use the AI redo path." }, { status: 400 });
  if (Number(job.redo_count || 0) >= 1) {
    return json({ error: "This job already used its automatic redo." }, { status: 429 });
  }
  if (!["complete", "failed"].includes(job.status)) {
    return badRequest("The conversion is not ready for redo.");
  }
  if (!sourceAvailableForRedo(job)) {
    return json({ error: "The redo window has expired. Contact support with your job ID." }, { status: 410 });
  }

  await updateJob(env, job.id, {
    redo_count: Number(job.redo_count || 0) + 1,
    last_redo_at: new Date().toISOString()
  });
  job = await getAuthorizedJob(env, jobId, token);

  try {
    const result = await runFullConversion(env, job, {
      deleteSource: true,
      cashRefund: Number(job.download_count || 0) === 0,
      convertOptions: {
        forceProvider: "mistral",
        allowPaidFallback: true
      }
    });

    if (!result.ok) {
      return json({
        status: "failed",
        jobId: job.id,
        token: bodyToken ? token : "",
        plan: PLANS[job.plan_id] || PLANS.starter,
        converterId: job.converter_id || "bank",
        outputFormat: jobOutputFormat(job),
        columns: CONVERTER_COLUMNS[job.converter_id || "bank"] || [],
        message: result.message,
        confidence: result.confidence,
        rowCount: result.rowCount,
        redoAvailable: false,
        refundStatus: result.refundStatus || "refund_due"
      });
    }

    return json({
      status: "complete",
      jobId: job.id,
      token: bodyToken ? token : "",
      plan: PLANS[job.plan_id] || PLANS.starter,
      converterId: job.converter_id || "bank",
      outputFormat: result.outputFormat || jobOutputFormat(job),
      columns: result.columns || columnsForPreview(job.converter_id || "bank", result.previewRows || []),
      paid: true,
      previewRows: result.previewRows,
      confidence: result.confidence,
      rowCount: result.rowCount,
      validationReportAvailable: Boolean(result.validationReportAvailable),
      redoAvailable: false,
      refundStatus: ""
    });
  } catch (error) {
    const refund = await requestDodoRefund(env, job, error?.message || "Automatic redo could not be completed.", {
      cashRefund: Number(job.download_count || 0) === 0
    });
    await updateJob(env, job.id, {
      status: "failed",
      error: error?.message || "Automatic redo could not be completed.",
      refund_status: refund.status,
      refund_id: refund.refundId || "",
      source_deleted_at: new Date().toISOString()
    });

    return json({
      status: "failed",
      jobId: job.id,
      token: bodyToken ? token : "",
      plan: PLANS[job.plan_id] || PLANS.starter,
      converterId: job.converter_id || "bank",
      outputFormat: jobOutputFormat(job),
      columns: CONVERTER_COLUMNS[job.converter_id || "bank"] || [],
      message: error?.message || "Automatic redo could not be completed.",
      confidence: 0,
      rowCount: 0,
      redoAvailable: false,
      refundStatus: refund.status
    });
  }
}

function columnsForPreview(converterId, previewRows) {
  if (previewRows.length) {
    return Object.keys(previewRows[0]).slice(0, 8).map((key) => ({
      key,
      label: labelForKey(key)
    }));
  }
  return CONVERTER_COLUMNS[converterId] || CONVERTER_COLUMNS.bank;
}

function labelForKey(key) {
  return String(key)
    .replace(/^column_(\d+)$/i, "Column $1")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
