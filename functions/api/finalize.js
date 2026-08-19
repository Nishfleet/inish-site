import { runFullConversion } from "../lib/conversion.js";
import { refreshUniversalProviderConversion } from "../lib/universal-providers.js";
import { verifyDodoPayment } from "../lib/dodo.js";
import { CONVERTER_COLUMNS } from "../lib/extract.js";
import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import { getAuthorizedJob, hasRequiredBindings, jobOutputFormat, outputFormatFromResultKey, parseStoredPreview, PLANS, retentionFields, sourceAvailableForRedo, tokenFromBodyOrCookie } from "../lib/jobs.js";
import { isBinaryOutputFormat, isUniversalConverter, UNIVERSAL_COLUMNS } from "../lib/universal.js";

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
    return badRequest("Invalid finalize request.");
  }

  const jobId = String(body.jobId || "");
  const bodyToken = String(body.token || "");
  const token = tokenFromBodyOrCookie(request, jobId, bodyToken);
  let job = await getAuthorizedJob(env, jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");

  if (!job.paid_at && env.FREE_DOWNLOADS_ENABLED !== "true") {
    const verified = await verifyDodoPayment(env, String(body.paymentId || ""), job);
    if (!verified) return json({ error: "Payment could not be verified yet." }, { status: 402 });
    job = await getAuthorizedJob(env, jobId, token);
  }

  if (job.status === "complete") {
    const object = await env.AICONVERTER_BUCKET.get(job.result_key);
    const resultFormat = outputFormatFromResultKey(job.result_key);
    const selectedFormat = jobOutputFormat(job);
    const previewRows = isUniversalConverter(job.converter_id) || isBinaryOutputFormat(resultFormat)
      ? await storedPreviewRows(env, job)
      : object
        ? parseStoredPreview(await object.text(), job.result_key, 5)
        : [];
    return json({
      status: "complete",
      jobId: job.id,
      token: bodyToken ? token : "",
      plan: PLANS[job.plan_id] || PLANS.starter,
      converterId: job.converter_id || "bank",
      outputFormat: selectedFormat,
      columns: columnsForPreview(job.converter_id || "bank", previewRows),
      paid: true,
      previewRows,
      confidence: job.confidence || 0,
      rowCount: job.row_count || 0,
      validationReportAvailable: Boolean(job.validation_report_key),
      redoAvailable: !isUniversalConverter(job.converter_id) && Number(job.redo_count || 0) < 1 && sourceAvailableForRedo(job),
      ...retentionFields(job),
      refundStatus: job.refund_status || ""
    });
  }

  if (job.status !== "preview_ready") {
    if (job.status === "converting_full" && isUniversalConverter(job.converter_id)) {
      const refreshed = await refreshUniversalProviderConversion(env, job);
      return json(responseForConversion(job, token, bodyToken, refreshed));
    }
    return badRequest("The conversion is not ready to finalize.");
  }

  try {
    const result = await runFullConversion(env, job);
    if (result.pending) return json(responseForConversion(job, token, bodyToken, result));
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
        ...retentionFields(job),
        refundStatus: result.refundStatus || ""
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
      redoAvailable: !isUniversalConverter(job.converter_id) && sourceAvailableForRedo(job),
      ...retentionFields(job),
      refundStatus: ""
    });
  } catch (error) {
    return json(
      {
        error: error?.message || "The full file could not be generated."
      },
      { status: 500 }
    );
  }
}

function responseForConversion(job, token, bodyToken, result) {
  const updatedJob = result.job || job;
  return {
    status: result.status || (result.pending ? "converting_full" : result.ok ? "complete" : "failed"),
    jobId: job.id,
    token: bodyToken ? token : "",
    plan: PLANS[job.plan_id] || PLANS.starter,
    converterId: job.converter_id || "bank",
    outputFormat: result.outputFormat || jobOutputFormat(updatedJob),
    columns: result.columns || columnsForPreview(job.converter_id || "bank", result.previewRows || []),
    paid: true,
    previewRows: result.previewRows || [],
    confidence: result.confidence || 0,
    rowCount: result.rowCount || 0,
    validationReportAvailable: Boolean(result.validationReportAvailable || updatedJob.validation_report_key),
    redoAvailable: Boolean(result.ok && !result.pending && !isUniversalConverter(job.converter_id) && sourceAvailableForRedo(job)),
    refundStatus: result.refundStatus || "",
    ...retentionFields(updatedJob),
    message: result.message || ""
  };
}

async function storedPreviewRows(env, job) {
  if (!job.preview_key) return [];
  const object = await env.AICONVERTER_BUCKET.get(job.preview_key);
  const rows = object ? parseStoredPreview(await object.text(), job.preview_key, 5) : [];
  return job.status === "complete" && isUniversalConverter(job.converter_id)
    ? rows.map((row) => ({ ...row, status: "Ready to download" }))
    : rows;
}

function columnsForPreview(converterId, previewRows) {
  if (previewRows.length) {
    return Object.keys(previewRows[0]).slice(0, 8).map((key) => ({
      key,
      label: labelForKey(key)
    }));
  }
  if (isUniversalConverter(converterId)) return UNIVERSAL_COLUMNS;
  return CONVERTER_COLUMNS[converterId] || CONVERTER_COLUMNS.bank;
}

function labelForKey(key) {
  return String(key)
    .replace(/^column_(\d+)$/i, "Column $1")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
