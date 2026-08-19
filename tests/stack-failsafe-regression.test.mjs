import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../public/support/turnstile.js", import.meta.url), "utf8");

test("React app is wrapped in a customer-facing crash recovery boundary", () => {
  assert.match(appSource, /class AppErrorBoundary extends React\.Component/);
  assert.match(appSource, /Something went wrong\./);
  assert.match(appSource, /trackFunnelEvent\("preview_error"/);
  assert.match(appSource, /errorCode: "ui_crash"/);
  assert.match(appSource, /<AppErrorBoundary>\s*<App \/>/);
});

test("API calls use safe JSON parsing and timeouts", () => {
  assert.match(appSource, /async function readJsonSafe/);
  assert.match(appSource, /async function fetchJsonResponse/);
  assert.match(appSource, /controller\.abort\(\)/);
  assert.doesNotMatch(appSource, /const payload = await response\.json\(\);/);
});

test("failed previews give the customer a clean recovery path", () => {
  assert.match(appSource, /result\.status === "failed"/);
  assert.match(appSource, /No charge\./);
  assert.match(appSource, /Upload another file/);
  assert.match(appSource, /supportHrefForJob\(result\.jobId, "conversion"\)/);
});

test("support page can prefill sanitized handoff details from a failed job", () => {
  assert.match(supportSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(supportSource, /input\[name="jobId"\]/);
  assert.match(supportSource, /select\[name="category"\]/);
  assert.match(supportSource, /replace\(\/\[\^a-zA-Z0-9_:-\]\//);
});
