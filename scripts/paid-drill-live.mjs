import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

loadLocalMonitorEnv();

const baseUrl = process.env.AICONVERTER_MONITOR_URL || process.env.AICONVERTER_STRESS_URL || "https://aiconverter.app";
const adminToken =
  process.env.AICONVERTER_MONITOR_ADMIN_TOKEN || process.env.AICONVERTER_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
const mode = process.argv[2] || "create";
const jobId = process.env.PAID_DRILL_JOB_ID || process.argv[3] || "";
const token = process.env.PAID_DRILL_JOB_TOKEN || process.argv[4] || "";

if (!adminToken) fail("Set AICONVERTER_ADMIN_TOKEN or add it to .monitor.env.");

if (mode === "create") {
  const response = await fetch(new URL("/api/admin/checkout-drill", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      returnCheckoutUrl: true,
      includeToken: true,
      customerEmail: process.env.PAID_DRILL_CUSTOMER_EMAIL || ""
    })
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok || body.ok !== true || !body.checkoutUrl || !body.jobId || !body.token) {
    fail("Could not create paid drill checkout.", body);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        next: "Open checkoutUrl, pay it with a real card, then run verify with PAID_DRILL_JOB_ID and PAID_DRILL_JOB_TOKEN.",
        jobId: body.jobId,
        token: body.token,
        checkoutUrl: body.checkoutUrl,
        checkoutHost: body.checkoutHost,
        plan: body.plan
      },
      null,
      2
    )
  );
} else if (mode === "verify") {
  if (!jobId || !token) fail("Provide PAID_DRILL_JOB_ID and PAID_DRILL_JOB_TOKEN.");
  const result = await waitForPaidJob(jobId, token, Number(process.env.PAID_DRILL_WAIT_SECONDS || 180));
  if (["failed", "cancelled"].includes(String(result.paymentStatus || "").toLowerCase())) {
    fail("Payment did not complete.", {
      jobId,
      status: result.status,
      paymentStatus: result.paymentStatus,
      paymentEvent: result.paymentEvent,
      paymentMessage: result.paymentMessage
    });
  }
  if (!result.paid) fail("Payment was not detected before timeout.", result);

  const finalized = result.status === "complete" ? result : await finalize(jobId, token);
  if (finalized.status !== "complete") fail("Finalize did not complete.", finalized);

  const download = await downloadResult(jobId, token);
  const validation = await maybeDownloadValidationReport(jobId, token);
  console.log(
    JSON.stringify(
      {
        ok: true,
        jobId,
        paid: true,
        status: finalized.status,
        outputFormat: finalized.outputFormat,
        rowCount: finalized.rowCount,
        download,
        validation
      },
      null,
      2
    )
  );
} else if (mode === "refund") {
  if (!jobId) fail("Provide PAID_DRILL_JOB_ID.");
  const response = await fetch(new URL("/api/admin/refund-drill", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jobId,
      confirmJobId: jobId,
      reason: "Operator paid-path drill refund."
    })
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok || body.ok !== true) fail("Refund drill did not complete.", body);
  console.log(JSON.stringify({ ok: true, ...body }, null, 2));
} else {
  fail("Use one of: create, verify, refund.");
}

async function waitForPaidJob(jobId, token, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await readJob(jobId, token);
    if (latest.paid) return latest;
    if (["failed", "cancelled"].includes(String(latest.paymentStatus || "").toLowerCase())) return latest;
    await sleep(3000);
  }
  return latest || { paid: false };
}

async function readJob(jobId, token) {
  const response = await fetch(new URL("/api/job", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, token })
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) fail("Could not read drill job.", body);
  return body;
}

async function finalize(jobId, token) {
  const response = await fetch(new URL("/api/finalize", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, token })
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) fail("Could not finalize drill job.", body);
  return body;
}

async function downloadResult(jobId, token) {
  const response = await fetch(new URL("/api/download", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, token })
  });
  if (!response.ok) {
    const body = await response.json().catch(async () => ({ raw: await response.text() }));
    fail("Could not download drill result.", body);
  }
  const text = await response.text();
  const filePath = writeArtifact(jobId, "result.csv", text);
  return {
    ok: text.includes("Opening Deposit") && text.includes("Coffee Shop"),
    bytes: text.length,
    filePath
  };
}

async function maybeDownloadValidationReport(jobId, token) {
  const response = await fetch(new URL("/api/validation-report", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, token })
  });
  if (!response.ok) return { ok: false, status: response.status };
  const text = await response.text();
  return {
    ok: text.includes("AI Converter validation report"),
    bytes: text.length,
    filePath: writeArtifact(jobId, "validation-report.txt", text)
  };
}

function writeArtifact(jobId, name, content) {
  const dir = resolve(process.cwd(), ".drill-artifacts", jobId);
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content);
  return path;
}

function loadLocalMonitorEnv() {
  const envPath = resolve(process.cwd(), ".monitor.env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name]) continue;
    process.env[name] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message, detail = {}) {
  console.error(JSON.stringify({ ok: false, message, detail }, null, 2));
  process.exit(1);
}
