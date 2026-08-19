import { bankDownloadFileName } from "../lib/accounting-exports.js";
import { badRequest, json, methodNotAllowed, serverError, withSecurityHeaders } from "../lib/http.js";
import { getAuthorizedJob, hasRequiredBindings, jobOutputFormat, outputFormatFromResultKey, tokenFromBodyOrCookie, updateJob } from "../lib/jobs.js";
import { isUniversalConverter } from "../lib/universal.js";
import { createZip, textBytes } from "../lib/zip.js";

export async function onRequestPost(context) {
  return handleBatchDownload(context);
}

export function onRequestGet() {
  return methodNotAllowed("POST");
}

async function handleBatchDownload({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid batch download request.");
  }

  const items = Array.isArray(body.jobs) ? body.jobs.slice(0, 50) : [];
  if (!items.length) return badRequest("Choose completed conversions first.");

  const zipEntries = [];
  const usedNames = new Set();
  const manifest = [
    "AI Converter batch export",
    `Created: ${new Date().toISOString()}`,
    ""
  ];

  for (const item of items) {
    const jobId = String(item.jobId || "");
    const bodyToken = String(item.token || "");
    const token = tokenFromBodyOrCookie(request, jobId, bodyToken);
    const job = await getAuthorizedJob(env, jobId, token);
    if (!job) {
      manifest.push(`${jobId || "unknown job"}: skipped, unknown or expired`);
      continue;
    }

    if (job.status !== "complete") {
      manifest.push(`${job.original_file_name || job.id}: skipped, not complete`);
      continue;
    }

    const freeDownloads = env.FREE_DOWNLOADS_ENABLED === "true";
    if (!job.paid_at && !freeDownloads) {
      manifest.push(`${job.original_file_name || job.id}: skipped, payment required`);
      continue;
    }

    const object = await env.AICONVERTER_BUCKET.get(job.result_key);
    if (!object) {
      manifest.push(`${job.original_file_name || job.id}: skipped, file expired`);
      continue;
    }

    const exportName = uniqueZipName(`exports/${downloadFileName(job)}`, usedNames);
    zipEntries.push({
      name: exportName,
      bytes: new Uint8Array(await object.arrayBuffer())
    });

    if (job.validation_report_key) {
      const report = await env.AICONVERTER_BUCKET.get(job.validation_report_key).catch(() => null);
      if (report) {
        zipEntries.push({
          name: uniqueZipName(`reports/${reportFileName(job)}`, usedNames),
          bytes: new Uint8Array(await report.arrayBuffer())
        });
      }
    }

    manifest.push(`${job.original_file_name || job.id}: included as ${exportName}`);
    await updateJob(env, job.id, {
      download_count: Number(job.download_count || 0) + 1
    }).catch(() => {});
  }

  if (!zipEntries.length) {
    return json({ error: "No completed paid exports were available for ZIP download." }, { status: 400 });
  }

  zipEntries.push({
    name: "aiconverter-batch-manifest.txt",
    bytes: textBytes(`${manifest.join("\n")}\n`)
  });

  const zip = createZip(zipEntries);
  return withSecurityHeaders(
    new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="aiconverter-batch-${new Date().toISOString().slice(0, 10)}.zip"`,
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, noarchive, nosnippet"
      }
    })
  );
}

function downloadFileName(job) {
  if (job.converter_id === "bank") return bankDownloadFileName(jobOutputFormat(job), job.original_file_name || "bank-statement");
  const extension = outputFormatFromResultKey(job.result_key);
  let prefix = "bank-statement";
  if (job.converter_id === "audio-transcript") prefix = "audio-transcript";
  if (job.converter_id === "document-markdown") prefix = "document-markdown";
  if (job.converter_id === "screenshot-code") prefix = "screenshot-html";
  if (job.converter_id === "invoice") prefix = "invoice";
  if (job.converter_id === "receipt") prefix = "receipt-expense";
  if (job.converter_id === "screenshot") prefix = "screenshot-table";
  if (isUniversalConverter(job.converter_id)) prefix = "converted-file";
  return `aiconverter-${prefix}.${extension}`;
}

function reportFileName(job) {
  const stem = String(job.original_file_name || "bank-statement")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bank-statement";
  return `aiconverter-${stem}-validation-report.txt`;
}

function uniqueZipName(name, usedNames) {
  const clean = String(name || "export.txt");
  if (!usedNames.has(clean)) {
    usedNames.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf(".");
  const prefix = dot > clean.lastIndexOf("/") ? clean.slice(0, dot) : clean;
  const extension = dot > clean.lastIndexOf("/") ? clean.slice(dot) : "";
  let index = 2;
  while (usedNames.has(`${prefix}-${index}${extension}`)) index += 1;
  const unique = `${prefix}-${index}${extension}`;
  usedNames.add(unique);
  return unique;
}
