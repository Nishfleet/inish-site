import { bankOutputLabel, isBankOutputFormat } from "./accounting-exports.js";
import { jobOutputFormat, retentionFields, sourceAvailableForRedo } from "./jobs.js";
import { isUniversalConverter } from "./universal.js";

const CONVERTER_LABELS = {
  bank: "Bank statement",
  receipt: "Receipt",
  screenshot: "Screenshot table",
  invoice: "Invoice",
  "audio-transcript": "Audio transcript",
  "document-markdown": "Document Markdown",
  "screenshot-code": "Screenshot to HTML",
  "universal-file": "Universal file"
};

export function buildConversionBrief(job, options = {}) {
  const status = String(job?.status || "");
  const converterId = String(job?.converter_id || "bank");
  const outputFormat = jobOutputFormat(job);
  const paymentEvent = options.paymentEvent || null;
  const paid = Boolean(job?.paid_at) || paymentSucceeded(paymentEvent);
  const mode = modeForJob(job, { paid });
  const accountingReadiness = buildAccountingReadiness(job, outputFormat);
  const redoAvailable = redoAvailableFor(job, { converterId, paid, status });

  return {
    generatedAt: new Date().toISOString(),
    jobId: job?.id || "",
    mode,
    status,
    converterId,
    converterLabel: CONVERTER_LABELS[converterId] || CONVERTER_LABELS.bank,
    outputFormat,
    outputLabel: outputLabelFor(converterId, outputFormat),
    summary: summaryForJob(job, { mode, paid }),
    validation: {
      available: Boolean(job?.validation_report_key),
      requiredBeforeImport: accountingReadiness.applicable,
      confidence: Number(job?.confidence || 0),
      rowCount: Number(job?.row_count || 0)
    },
    payment: {
      paid,
      status: String(paymentEvent?.status || ""),
      event: String(paymentEvent?.event_type || "")
    },
    retention: retentionFields(job),
    redo: {
      available: redoAvailable
    },
    accountingReadiness,
    nextActions: nextActionsForJob(job, { mode, paid, outputFormat, accountingReadiness, redoAvailable }),
    support: {
      category: supportCategoryFor(job, paymentEvent),
      href: supportHref(job?.id, supportCategoryFor(job, paymentEvent)),
      reference: job?.id || "",
      safeMessage: "Share the job ID, selected conversion, what you expected, and what went wrong. Do not paste bank, receipt, invoice, screenshot, or source-file data.",
      doNotShare: ["source file", "full exported rows", "bank credentials", "card details", "access tokens"]
    },
    handoffRules: [
      "Use the job ID as the support reference; do not request source files in chat or email.",
      "Answer from job status, validation state, retention windows, and documented product limits only.",
      "Escalate payment, refund, deletion, and security issues instead of improvising.",
      "Treat accounting exports as preparation files that need customer review before import."
    ]
  };
}

function modeForJob(job, { paid }) {
  const status = String(job?.status || "");
  if (["deleted", "expired"].includes(status)) return "expired_or_deleted";
  if (status === "failed" && (paid || job?.refund_status)) return "refund_review";
  if (status === "failed") return "safe_failure";
  if (status === "converting_full") return "wait_for_provider";
  if (status === "complete") return "self_serve_download";
  if (status === "preview_ready") return paid ? "self_serve_unlock" : "self_serve_preview";
  return "self_serve_preview";
}

function summaryForJob(job, { mode, paid }) {
  const status = String(job?.status || "");
  if (mode === "refund_review") return "The paid export failed after checkout. Keep the job ID and use the refund/support path.";
  if (mode === "safe_failure") return "The converter stopped safely. No charge should be made for a failed preview.";
  if (mode === "expired_or_deleted") return "This conversion is no longer stored. Upload again if you still need the file.";
  if (mode === "wait_for_provider") return "The full export is still being generated. Refresh this conversion shortly.";
  if (mode === "self_serve_download") return "The converted file is ready to download and review.";
  if (mode === "self_serve_unlock" || paid) return "Payment is recorded. Generate the full export from this conversion.";
  if (status === "preview_ready") return "The free preview is ready. Unlock only if the sample looks useful.";
  return "Upload a supported file and generate a private preview first.";
}

function nextActionsForJob(job, { mode, paid, outputFormat, accountingReadiness, redoAvailable }) {
  const actions = [];
  if (mode === "refund_review") {
    actions.push("Contact refund support with the job ID.");
    actions.push("Do not send source-file data through support.");
    actions.push("Upload again only if you still need a fresh conversion.");
    return actions;
  }
  if (mode === "safe_failure") {
    actions.push("Try a clearer, smaller, unlocked file.");
    actions.push("Contact support with the job ID if this file should have worked.");
    actions.push("Do not send source-file data through support.");
    return actions;
  }
  if (mode === "expired_or_deleted") {
    actions.push("Upload the file again if you need a new conversion.");
    actions.push("Delete old local downloads if they are no longer needed.");
    return actions;
  }
  if (mode === "wait_for_provider") {
    actions.push("Refresh this conversion in a moment.");
    actions.push("Keep the job ID for support if it remains stuck.");
    return actions;
  }
  if (mode === "self_serve_download") {
    actions.push("Download the full export.");
    if (job?.validation_report_key) actions.push("Download the validation report before importing.");
    if (accountingReadiness.applicable) actions.push(`Review the ${outputLabelFor("bank", outputFormat)} before using it in accounting software.`);
    if (redoAvailable) actions.push("Use the stronger redo before source retention expires if the export looks wrong.");
    actions.push("Delete the conversion when you are done.");
    return actions.slice(0, 4);
  }
  if (mode === "self_serve_unlock") {
    actions.push("Generate the paid full export.");
    actions.push("Keep this tab open until the file is ready.");
    actions.push("Contact support with the job ID if payment succeeded but generation fails.");
    return actions;
  }
  actions.push("Review the preview rows.");
  actions.push("Download the free sample if you need to inspect the shape.");
  actions.push(accountingReadiness.applicable ? `Unlock only if the ${outputLabelFor("bank", outputFormat)} preview is useful.` : "Unlock only if the preview is useful.");
  return actions;
}

function redoAvailableFor(job, { converterId, paid, status }) {
  return paid && status === "complete" && !isUniversalConverter(converterId) && Number(job?.redo_count || 0) < 1 && sourceAvailableForRedo(job);
}

function buildAccountingReadiness(job, outputFormat) {
  const converterId = String(job?.converter_id || "bank");
  const applicable = converterId === "bank" && isBankOutputFormat(outputFormat);
  if (!applicable) {
    return {
      applicable: false,
      status: "not_accounting_output",
      outputLabel: outputLabelFor(converterId, outputFormat),
      checks: []
    };
  }

  return {
    applicable: true,
    status: job?.status === "complete" ? "review_before_import" : "pending_export",
    outputLabel: bankOutputLabel(outputFormat),
    checks: [
      "Compare opening and closing balances against the statement.",
      "Check date range, duplicate rows, and missing amounts.",
      "Import only after reviewing the file inside your accounting workflow."
    ],
    cautions: [
      "AI Converter does not provide accounting, tax, reconciliation, or official platform support.",
      "QuickBooks, Xero, Wave, GnuCash, OFX, QBO, and QIF files may still need mapping or cleanup."
    ]
  };
}

function outputLabelFor(converterId, outputFormat) {
  if (converterId === "bank" && isBankOutputFormat(outputFormat)) return bankOutputLabel(outputFormat);
  return String(outputFormat || "output").toUpperCase();
}

function supportCategoryFor(job, paymentEvent) {
  const eventType = String(paymentEvent?.event_type || "").toLowerCase();
  const status = String(paymentEvent?.status || "").toLowerCase();
  if (String(job?.status || "") === "failed" && (job?.paid_at || paymentSucceeded(paymentEvent) || job?.refund_status)) return "refund";
  if (String(job?.refund_status || "")) return "refund";
  if (
    ["failed", "cancelled", "processing"].includes(status) ||
    ["payment.failed", "payment.cancelled", "payment.processing"].includes(eventType)
  ) {
    return "payment";
  }
  if (String(job?.status || "") === "failed") return "conversion";
  return "conversion";
}

function paymentSucceeded(paymentEvent) {
  const eventType = String(paymentEvent?.event_type || "").toLowerCase();
  const status = String(paymentEvent?.status || "").toLowerCase();
  const matchStatus = String(paymentEvent?.match_status || "").toLowerCase();
  if (matchStatus && matchStatus !== "matched") return false;
  return ["succeeded", "paid", "complete", "completed"].includes(status) || ["payment.succeeded", "payment.paid", "payment.completed"].includes(eventType);
}

function supportHref(jobId = "", category = "conversion") {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (jobId) params.set("jobId", jobId);
  return `/support/${params.toString() ? `?${params}` : ""}`;
}
