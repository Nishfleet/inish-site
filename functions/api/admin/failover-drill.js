import { requireAdmin } from "../../lib/admin-auth.js";
import { json, methodNotAllowed, serverError } from "../../lib/http.js";
import {
  insertJob,
  PLANS,
  randomId,
  randomToken,
  RESULT_RETENTION_SECONDS,
  safeFileName,
  sha256,
  sha256Bytes,
  sourceObjectKey
} from "../../lib/jobs.js";
import { startUniversalProviderConversion, refreshUniversalProviderConversion } from "../../lib/universal-providers.js";

const DRILL_FILE_NAME = "aiconverter-failover-drill.csv";
const DRILL_MIME = "text/csv";
const DRILL_OUTPUT_FORMAT = "pdf";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!env.AICONVERTER_BUCKET || !env.AICONVERTER_DB) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const waitSeconds = await requestedWaitSeconds(request);
  const jobId = randomId("drill");
  const token = randomToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RESULT_RETENTION_SECONDS * 1000).toISOString();
  const fileName = safeFileName(DRILL_FILE_NAME);
  const sourceKey = sourceObjectKey(jobId, fileName, "universal-file");
  const resultKey = `jobs/${jobId}/result.${DRILL_OUTPUT_FORMAT}`;
  const bytes = new TextEncoder().encode(`name,total\nFailover drill,1.00\ncreated_at,${now}\n`);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  await insertJob(env, {
    id: jobId,
    tokenHash: await sha256(token),
    status: "processing",
    planId: PLANS.starter.id,
    email: "admin-drill@aiconverter.app",
    sourceKey,
    resultKey,
    originalFileName: fileName,
    fileSize: bytes.byteLength,
    estimatedPages: 1,
    converterId: "universal-file",
    inputMimeType: DRILL_MIME,
    outputFormat: DRILL_OUTPUT_FORMAT,
    fileHash: await sha256Bytes(arrayBuffer),
    ipHash: "admin-failover-drill",
    userAgentHash: "admin-failover-drill",
    now,
    expiresAt
  });

  await env.AICONVERTER_BUCKET.put(sourceKey, arrayBuffer, {
    httpMetadata: { contentType: DRILL_MIME },
    customMetadata: {
      jobId,
      purpose: "admin-failover-drill-source",
      deleteAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }
  });

  const drillEnv = {
    ...env,
    CLOUDCONVERT_API_KEY: ""
  };
  const started = await startUniversalProviderConversion(drillEnv, {
    id: jobId,
    source_key: sourceKey,
    result_key: resultKey,
    original_file_name: fileName,
    input_mime_type: DRILL_MIME,
    output_format: DRILL_OUTPUT_FORMAT,
    expires_at: expiresAt
  }, arrayBuffer);

  const firstJob = await readJob(env, jobId);
  const firstProvider = firstJob?.external_provider || started.provider || "";
  if (firstProvider !== "convertio") {
    return json(
      {
        ok: false,
        jobId,
        provider: firstProvider,
        status: firstJob?.status || started.status || "",
        message: "Failover drill did not route to Convertio.",
        started
      },
      { status: 502 }
    );
  }

  const final = waitSeconds > 0 ? await waitForProvider(env, jobId, waitSeconds) : { result: started, job: firstJob };
  const finalJob = final.job || (await readJob(env, jobId));

  return json({
    ok: true,
    jobId,
    provider: finalJob?.external_provider || firstProvider,
    status: finalJob?.status || started.status || "",
    externalStatus: finalJob?.external_status || "",
    completed: finalJob?.status === "complete",
    resultStored: finalJob?.status === "complete" ? Boolean(await env.AICONVERTER_BUCKET.head(resultKey)) : false,
    message:
      finalJob?.status === "complete"
        ? "Controlled failover drill completed through Convertio."
        : "Controlled failover drill routed to Convertio and is still converting.",
    preview: final.result?.previewRows?.[0] || started.previewRows?.[0] || null
  });
}

async function requestedWaitSeconds(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) return 20;
  const body = await request.json().catch(() => ({}));
  return Math.max(0, Math.min(25, Number(body.waitSeconds ?? 20)));
}

async function waitForProvider(env, jobId, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000;
  let result = null;
  let job = await readJob(env, jobId);

  while (job && job.status === "converting_full" && Date.now() < deadline) {
    result = await refreshUniversalProviderConversion(env, job);
    job = await readJob(env, jobId);
    if (job?.status === "complete" || job?.status === "failed") break;
    await sleep(1500);
  }

  return { result, job };
}

async function readJob(env, jobId) {
  return env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(jobId).first();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
