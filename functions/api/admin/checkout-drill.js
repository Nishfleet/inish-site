import { requireAdmin } from "../../lib/admin-auth.js";
import { createDodoCheckout } from "../../lib/dodo.js";
import { json, methodNotAllowed, serverError } from "../../lib/http.js";
import {
  hasRequiredBindings,
  insertJob,
  jobAccessCookie,
  PLANS,
  randomId,
  randomToken,
  RESULT_RETENTION_SECONDS,
  sha256,
  sha256Bytes,
  updateJob
} from "../../lib/jobs.js";

const DRILL_EMAIL = "admin-drill@aiconverter.app";
const TRUSTED_CHECKOUT_HOSTS = new Set(["checkout.dodopayments.com", "test.checkout.dodopayments.com"]);

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
  const returnCheckoutUrl = body.returnCheckoutUrl === true;
  const includeToken = body.includeToken === true;
  const checkoutEmail = String(body.customerEmail || "").trim().slice(0, 120);
  const plan = PLANS.starter;
  const jobId = randomId("checkout_drill");
  const token = randomToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RESULT_RETENTION_SECONDS * 1000).toISOString();
  const sourceBytes = buildDrillPdf([
    "Date Description Money Out Money In Balance",
    "2026-05-01 Opening Deposit 0.00 1000.00 1000.00",
    "2026-05-02 Coffee Shop 4.50 0.00 995.50",
    "2026-05-03 Hosting 12.30 0.00 983.20"
  ]);
  const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
  const sourceKey = `jobs/${jobId}/source.pdf`;
  const previewKey = `jobs/${jobId}/preview.csv`;
  const resultKey = `jobs/${jobId}/result.csv`;

  await insertJob(env, {
    id: jobId,
    tokenHash: await sha256(token),
    status: "preview_ready",
    planId: plan.id,
    email: DRILL_EMAIL,
    sourceKey,
    resultKey,
    originalFileName: "checkout-drill-statement.pdf",
    fileSize: sourceBytes.byteLength,
    estimatedPages: 1,
    converterId: "bank",
    inputMimeType: "application/pdf",
    outputFormat: "csv",
    fileHash: await sha256Bytes(sourceBuffer),
    ipHash: "admin-checkout-drill",
    userAgentHash: "admin-checkout-drill",
    now,
    expiresAt
  });

  await Promise.all([
    env.AICONVERTER_BUCKET.put(sourceKey, sourceBuffer, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { jobId, purpose: "admin-checkout-drill-source", deleteAfter: expiresAt }
    }),
    env.AICONVERTER_BUCKET.put(previewKey, "Date,Description,Money In,Money Out,Balance\n2026-05-01,Opening Deposit,1000.00,,1000.00\n", {
      httpMetadata: { contentType: "text/csv; charset=utf-8" },
      customMetadata: { jobId, purpose: "admin-checkout-drill-preview", deleteAfter: expiresAt }
    })
  ]);

  await updateJob(env, jobId, {
    preview_key: previewKey,
    confidence: 1,
    row_count: 3,
    extractor: "admin-checkout-drill"
  });

  const job = await readJob(env, jobId);
  let checkoutUrl = "";
  try {
    checkoutUrl = await createDodoCheckout({
      env,
      request,
      job,
      plan,
      email: checkoutEmail
    });
  } catch (error) {
    return json(
      {
        ok: false,
        jobId,
        code: error?.code || "DODO_CHECKOUT_ERROR",
        message: error?.message || "Dodo checkout could not be created."
      },
      { status: 503 }
    );
  }

  if (!checkoutUrl) {
    return json({ ok: false, jobId, message: "Dodo checkout URL was not returned." }, { status: 503 });
  }

  const checkout = new URL(checkoutUrl);
  if (!isTrustedCheckout(checkout)) {
    return json({ ok: false, jobId, message: "Dodo checkout host is not trusted." }, { status: 502 });
  }

  return json(
    {
      ok: true,
      mode: "checkout",
      jobId,
      checkoutHost: checkout.host,
      cookieSet: true,
      ...(returnCheckoutUrl ? { checkoutUrl } : {}),
      ...(includeToken ? { token } : {}),
      plan: {
        id: plan.id,
        detail: plan.detail,
        amount: plan.amount,
        currency: plan.currency
      },
      message: "Admin checkout drill created a live Dodo checkout handoff."
    },
    {
      headers: {
        "Set-Cookie": jobAccessCookie(jobId, token)
      }
    }
  );
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) return {};
  return request.json().catch(() => ({}));
}

async function readJob(env, jobId) {
  return env.AICONVERTER_DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(jobId).first();
}

function buildDrillPdf(lines) {
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 760 Td",
    ...lines.flatMap((line, index) => [
      ...(index ? ["0 -16 Td"] : []),
      `(${pdfTextEscape(line)}) Tj`
    ]),
    "ET"
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function pdfTextEscape(value) {
  return String(value).replace(/([\\()])/g, "\\$1");
}

function isTrustedCheckout(url) {
  return (
    url.protocol === "https:" &&
    (TRUSTED_CHECKOUT_HOSTS.has(url.hostname) || url.hostname.endsWith(".dodopayments.com"))
  );
}
