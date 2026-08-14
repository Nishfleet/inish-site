// Behavioral tests for the deployed Worker route decision (worker.js).
//
// worker.js is the live edge for inish.in. It imports the deny policy
// (publicPaths / fontPath / redirects) from functions/policy.js — the single
// source of truth — and keeps only the response plumbing inline. The Python
// suites prove that import by substring-matching the source; a runtime
// mutation like prefixing the deny check with `false &&`, or widening the
// policy allowlist, keeps every current test green while unlisted paths reach
// the ASSETS binding and can be served as static content.
//
// This suite drives the worker's default export directly with a recording
// ASSETS stub: denied paths must return 404 with the branded-404 read only
// (zero asset reads at all for HEAD), allowlisted paths must actually reach
// ASSETS, and redirects must preserve search and carry HSTS. The recording
// stub makes every assertion behavioral — it proves what the edge serves, not
// what the source says.
//
// Mutation experiments (run locally, reverted before commit; the suite goes
// red for each): a `false &&` prefix on the deny check, adding a deny sample
// to the policy's publicPaths allowlist, dropping `destination.search =` from
// the redirect, and dropping the HSTS set in withSecurityHeaders.
//
// node --test runs this file directly; no transpiler, no third-party deps.
// CI executes it through the required `test` job's Node discovery step
// (`node --test "tests/**/*.test.mjs"`, added by the required-CI Node-family
// packet): because the file lives under tests/, it is inside that scope.
// package.json's `test` script currently names only the middleware suite;
// discovery-based CI covers both.

import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker.js";

const ORIGIN = "https://inish.in";
const HSTS = "max-age=31536000; includeSubDomains";

// Negative space mirrors the middleware suite's samples and adds paths that
// specifically probe the shared policy. /private/notes.txt is the path
// used by the allowlist-widening mutation experiment: adding it to the
// policy's publicPaths must turn this suite red.
const DENY_SAMPLES = [
  "/admin",
  "/admin/",
  "/admin/login",
  "/secrets.json",
  "/.env",
  "/wp-login.php",
  "/private/notes.txt", // the widening-mutation sample; must stay denied
  "/daily/2026-08-08", // a dated deep-link that is not a redirect target
  "/daily/2026-08-08/story-1",
  "/404.html", // the branded 404 asset itself stays internal
  "/og-image.jpg", // wrong extension on the social card
  "/apple-touch-icon.ico", // wrong extension on the home-screen icon
  "/fonts/nope.ttf", // wrong extension in the fonts directory
  "/fonts/nope.woff2/", // trailing slash breaks the pattern
  "/fonts/OFL.md", // license text is the exact path; .md is not served
  "/fonts/nope.woff2.css", // suffix injection
  "/latest.json.bak", // suffix injection on a public path
  "/index.html.bak" // suffix injection on a redirect target
];

// The policy allowlist: every entry must reach the ASSETS binding.
const ALLOW_SAMPLES = [
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png",
  "/og-image.svg", // legacy share-card source, kept reachable
  "/og-image.png", // raster social share card, referenced by the generated head
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/fonts/OFL.txt"
];

// The font pattern is not an exact list: any /fonts/<name>.woff2 is static.
const FONT_SAMPLES = [
  "/fonts/archivo-700.woff2",
  "/fonts/archivo-400.woff2",
  "/fonts/archivo-italic-700.woff2",
  "/fonts/a.woff2",
  "/fonts/0.woff2"
];

const REDIRECTS = [
  ["/index.html", "/"],
  ["/daily", "/"],
  ["/daily/", "/"],
  ["/daily/index.html", "/"],
  ["/daily/app.js", "/app.js"],
  ["/daily/styles.css", "/styles.css"],
  ["/daily/latest.json", "/latest.json"],
  ["/daily/feed.xml", "/feed.xml"],
  ["/daily/sitemap.xml", "/sitemap.xml"]
];

// A recording ASSETS binding: serves the published surface with 200 (plus the
// branded /404.html the worker's notFoundResponse reads), answers anything
// else with 404, and records every URL it was asked to serve. The worker must
// never hand it a denied path — that forwarding is exactly the defect this
// suite exists to catch.
const SERVED = new Set([...ALLOW_SAMPLES, ...FONT_SAMPLES]);

function makeAssets() {
  const reads = [];
  return {
    reads,
    async fetch(input) {
      const url = new URL(typeof input === "string" ? input : input.url);
      reads.push(url.pathname);
      if (url.pathname === "/404.html") {
        return new Response("<html>branded 404</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      }
      if (SERVED.has(url.pathname)) {
        const body = url.pathname === "/" ? "<html>index</html>" : `asset ${url.pathname}`;
        return new Response(body, { status: 200 });
      }
      return new Response("missing", { status: 404 });
    }
  };
}

async function call(path, { method = "GET", search = "" } = {}) {
  const assets = makeAssets();
  const request = new Request(`${ORIGIN}${path}${search}`, { method });
  const response = await worker.fetch(request, { ASSETS: assets });
  return { response, assets };
}

test("deny: unlisted paths return 404 and the request never reaches ASSETS", async () => {
  for (const path of DENY_SAMPLES) {
    const { response, assets } = await call(path);
    assert.equal(response.status, 404, `expected 404 for ${path}`);
    // The denied request itself must never be forwarded to the assets
    // binding: the only permitted read is the branded /404.html lookup the
    // deny response performs. A `false &&` deny-bypass mutation forwards the
    // request and this read record changes — the suite goes red.
    assert.deepEqual(
      assets.reads,
      ["/404.html"],
      `denied path ${path} reached ASSETS; only the branded-404 read is allowed`
    );
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      HSTS,
      `404 for ${path} must carry HSTS`
    );
  }
});

test("deny: HEAD requests return 404 with zero asset reads at all", async () => {
  for (const path of DENY_SAMPLES) {
    const { response, assets } = await call(path, { method: "HEAD" });
    assert.equal(response.status, 404, `expected 404 HEAD for ${path}`);
    assert.deepEqual(assets.reads, [], `HEAD ${path} must not read any asset`);
  }
});

test("allow: every allowlisted path reaches ASSETS and carries HSTS", async () => {
  for (const path of ALLOW_SAMPLES) {
    const { response, assets } = await call(path);
    assert.equal(response.status, 200, `expected 200 for ${path}`);
    assert.ok(assets.reads.includes(path), `allowlisted ${path} must reach ASSETS`);
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      HSTS,
      `200 for ${path} must carry HSTS`
    );
  }
});

test("allow: the font pattern serves any /fonts/<name>.woff2 from ASSETS", async () => {
  for (const path of FONT_SAMPLES) {
    const { response, assets } = await call(path);
    assert.equal(response.status, 200, `expected 200 for ${path}`);
    assert.ok(assets.reads.includes(path), `font ${path} must reach ASSETS`);
  }
});

test("redirect: every legacy path 301s to its target preserving search", async () => {
  for (const [from, to] of REDIRECTS) {
    const search = "?q=1&r=2";
    const { response, assets } = await call(from, { search });
    assert.equal(response.status, 301, `expected 301 for ${from}`);
    const expected = new URL(to, ORIGIN);
    expected.search = search;
    assert.equal(
      response.headers.get("Location"),
      expected.href,
      `redirect from ${from} must preserve search`
    );
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      HSTS,
      `301 for ${from} must carry HSTS`
    );
    assert.deepEqual(assets.reads, [], `redirect ${from} must not touch ASSETS`);
  }
});

test("redirect: a path without search 301s to the bare target with HSTS", async () => {
  for (const [from, to] of REDIRECTS) {
    const { response, assets } = await call(from);
    assert.equal(response.status, 301, `expected 301 for ${from}`);
    assert.equal(
      response.headers.get("Location"),
      new URL(to, ORIGIN).href,
      `redirect from ${from} must keep its bare target`
    );
    assert.equal(response.headers.get("Strict-Transport-Security"), HSTS);
    assert.deepEqual(assets.reads, []);
  }
});
