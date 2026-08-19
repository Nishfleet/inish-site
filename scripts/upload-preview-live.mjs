const baseUrl = process.env.AICONVERTER_BASE_URL || "https://aiconverter.app";
const turnstileResponseToken = process.env.TURNSTILE_RESPONSE_TOKEN || "";

const config = await fetch(new URL("/api/config", baseUrl)).then((response) => response.json()).catch(() => ({}));
if (config.turnstileSiteKey && !turnstileResponseToken) {
  fail("Turnstile is active. Set TURNSTILE_RESPONSE_TOKEN from a human-solved or dummy-key environment before running this upload smoke.");
}

const form = new FormData();
form.append("converterId", "universal-file");
form.append("outputFormat", "xlsx");
form.append("planId", "starter");
form.append("estimatedPages", "1");
form.append("email", "qa+aiconverter@example.com");
form.append("funnelSessionId", `smoke_${Date.now().toString(36)}`);
if (turnstileResponseToken) form.append("turnstileToken", turnstileResponseToken);
form.append(
  "file",
  new File(["Date,Description,Amount\n2026-05-18,Smoke test,1.00\n"], "preview-smoke.csv", { type: "text/csv" })
);

const response = await fetch(new URL("/api/convert", baseUrl), { method: "POST", body: form });
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  fail(`Preview upload failed with ${response.status}: ${payload.error || payload.message || "unknown error"}`);
}
if (payload.status !== "preview_ready" || !payload.jobId || !payload.token) {
  fail(`Preview upload did not return preview_ready: ${JSON.stringify(payload)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      status: payload.status,
      converterId: payload.converterId,
      outputFormat: payload.outputFormat,
      rowCount: payload.rowCount,
      jobId: payload.jobId
    },
    null,
    2
  )
);

function fail(message) {
  console.error(JSON.stringify({ ok: false, baseUrl, message }, null, 2));
  process.exit(1);
}
