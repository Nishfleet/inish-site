import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const expectedRoutes = [
  "/bank-statement-pdf-to-csv/",
  "/pdf-bank-statement-to-quickbooks-csv/",
  "/pdf-bank-statement-to-xero-csv/",
  "/pdf-bank-statement-to-wave-csv/",
  "/scanned-bank-statement-to-excel/",
  "/credit-card-statement-pdf-to-csv/",
  "/formats/",
  "/privacy/",
  "/security/",
  "/data-retention/",
  "/refund/"
];

const expectedLabels = [
  "bank statement PDF to CSV",
  "PDF bank statement to QuickBooks CSV",
  "PDF bank statement to Xero CSV",
  "PDF bank statement to Wave CSV",
  "scanned bank statement to Excel",
  "credit card statement PDF to CSV",
  "formats page",
  "privacy policy",
  "security notes",
  "data retention policy",
  "refund policy"
];

function primaryRoutes(html) {
  return [...html.matchAll(/<a data-primary-route[\s\S]*?href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/g)].map(
    ([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, "").trim() })
  );
}

test("custom 404 page exposes only verified recovery routes", () => {
  const html = readFileSync("public/404.html", "utf8");
  const routes = primaryRoutes(html);

  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.match(html, /id="attempted-url"/);
  assert.match(html, /id="rescue-slider"/);
  assert.match(html, /id="route-search-input"/);
  assert.match(html, /id="report-link"/);
  assert.match(html, /<script src="\/404\.js" defer><\/script>/);
  assert.doesNotMatch(html, /<script(?![^>]+src=)/);

  assert.deepEqual(
    routes.map((route) => route.href).sort(),
    [...expectedRoutes].sort()
  );
  assert.deepEqual(
    routes.map((route) => route.label),
    expectedLabels
  );

  for (const label of expectedLabels) {
    assert.ok(html.includes(`>${label}</a>`), `footer should include ${label}`);
  }
});

test("404 interaction script uses the page route source and support prefill", () => {
  const script = readFileSync("public/404.js", "utf8");
  const supportScript = readFileSync("public/support/turnstile.js", "utf8");

  assert.match(script, /querySelectorAll\("\[data-primary-route\]"\)/);
  assert.match(script, /rescue-slider/);
  assert.match(script, /supportUrl\.searchParams\.set\("message", message\)/);
  assert.match(supportScript, /params\.get\("message"\)/);
  assert.match(supportScript, /messageInput\.value = message/);
});

test("Cloudflare Pages routing does not soft-404 unknown paths", () => {
  const redirects = readFileSync("public/_redirects", "utf8");
  const middleware = readFileSync("functions/_middleware.js", "utf8");

  assert.doesNotMatch(redirects, /\/\*\s+\/index\.html\s+200/);
  assert.match(redirects, /404\.html/);
  assert.match(middleware, /status:\s*knownMarkdown\s*\?\s*200\s*:\s*404/);
});
