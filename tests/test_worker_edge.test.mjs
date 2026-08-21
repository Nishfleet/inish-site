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
import { readFileSync } from "node:fs";

import worker from "../worker.js";
import { securityHeaders } from "../functions/policy.js";

const ORIGIN = "https://inish.in";
const HSTS = "max-age=31536000; includeSubDomains";
const FONT_CACHE_CONTROL = "public, max-age=31536000, immutable";

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
  "/llms.txt",
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

async function call(path, { method = "GET", search = "", origin = ORIGIN } = {}) {
  const assets = makeAssets();
  const request = new Request(`${origin}${path}${search}`, { method });
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

test("cache: every font response carries the one-year immutable cache header", async () => {
  // The four webfonts are referenced by stable, fingerprint-free URLs, so a
  // browser revalidates them on every visit unless the response is
  // immutable. The header must ride on every /fonts/<name>.woff2 response —
  // the exact pattern the deny policy uses — and on no other static asset.
  for (const path of FONT_SAMPLES) {
    const { response } = await call(path);
    assert.equal(
      response.headers.get("Cache-Control"),
      FONT_CACHE_CONTROL,
      `font ${path} must carry the immutable cache header`
    );
  }
  for (const path of ["/", "/styles.css", "/app.js", "/fonts/OFL.txt"]) {
    const { response } = await call(path);
    assert.notEqual(
      response.headers.get("Cache-Control"),
      FONT_CACHE_CONTROL,
      `non-font ${path} must not carry the font immutable cache header`
    );
  }
});

test("cache: font responses survive the runtime's immutable asset headers", async () => {
  // The real Workers runtime returns ASSETS responses whose headers reject
  // mutation; setting Cache-Control in place throws and the edge answers
  // error 1101 (observed live 2026-08-21). The mock here reproduces that
  // contract: any in-place header write on the asset response throws, so a
  // regression back to asset.headers.set() goes red while the rebuild path
  // stays green.
  async function callImmutable(path) {
    const assets = {
      async fetch(input) {
        const url = new URL(typeof input === "string" ? input : input.url);
        const response = new Response(`asset ${url.pathname}`, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" }
        });
        // A real Headers whose write path throws: exactly the runtime
        // contract (reads and copy-construction work, mutation does not).
        response.headers.set = (name) => {
          throw new TypeError(
            `Cannot mutate immutable asset headers (${String(name)})`
          );
        };
        return response;
      }
    };
    const request = new Request(`${ORIGIN}${path}`, { method: "GET" });
    return worker.fetch(request, { ASSETS: assets });
  }
  for (const path of FONT_SAMPLES) {
    const response = await callImmutable(path);
    assert.equal(response.status, 200, `font ${path} must still serve 200`);
    assert.equal(
      response.headers.get("Cache-Control"),
      FONT_CACHE_CONTROL,
      `font ${path} must carry the immutable cache header`
    );
  }
  const plain = await callImmutable("/styles.css");
  assert.equal(plain.status, 200, "non-font asset must still serve 200");
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

// Canonical host/scheme redirect — http:// and www. both 301 to the
// bare-apex HTTPS origin. The path is preserved as-is, search is preserved,
// and the redirect short-circuits ASSETS (the assets binding is only for
// canonical-origin reads). A regression that drops the canonical check
// serves the site from three extra origins; this suite pins it to behavior.

const CANONICAL_TARGET = "https://inish.in";

test("canonical: http://inish.in/* 301s to https://inish.in/* preserving search", async () => {
  for (const [path, search, expected] of [
    ["/", "", `${CANONICAL_TARGET}/`],
    ["/", "?q=1", `${CANONICAL_TARGET}/?q=1`],
    ["/feed.xml", "?utm=feed", `${CANONICAL_TARGET}/feed.xml?utm=feed`],
    ["/daily", "?from=old", `${CANONICAL_TARGET}/daily?from=old`]
  ]) {
    const { response, assets } = await call(path, {
      search,
      origin: "http://inish.in"
    });
    assert.equal(response.status, 301, `expected 301 for http://inish.in${path}`);
    assert.equal(
      response.headers.get("Location"),
      expected,
      `Location must point to canonical origin for http://inish.in${path}${search}`
    );
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      HSTS,
      `301 for http://inish.in${path} must carry HSTS`
    );
    assert.deepEqual(assets.reads, [], `canonical redirect must not touch ASSETS`);
  }
});

test("canonical: https://www.inish.in/* 301s to https://inish.in/* preserving search", async () => {
  for (const [path, search, expected] of [
    ["/", "", `${CANONICAL_TARGET}/`],
    ["/", "?q=hello", `${CANONICAL_TARGET}/?q=hello`],
    ["/feed.xml", "?utm=feed", `${CANONICAL_TARGET}/feed.xml?utm=feed`],
    ["/fonts/archivo-700.woff2", "", `${CANONICAL_TARGET}/fonts/archivo-700.woff2`]
  ]) {
    const { response, assets } = await call(path, {
      search,
      origin: "https://www.inish.in"
    });
    assert.equal(response.status, 301, `expected 301 for https://www.inish.in${path}`);
    assert.equal(
      response.headers.get("Location"),
      expected,
      `Location must drop the www. host for https://www.inish.in${path}${search}`
    );
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      HSTS,
      `301 for https://www.inish.in${path} must carry HSTS`
    );
    assert.deepEqual(assets.reads, [], `www. redirect must not touch ASSETS`);
  }
});

test("canonical: http://www.inish.in/* collapses to a single 301", async () => {
  // Combined case: one 301 to the canonical origin handles both http→https
  // and www→bare. A regression that only checks one dimension would either
  // redirect to http://inish.in (still wrong scheme) or to https://www.inish.in
  // (still wrong host) and this test fails.
  for (const [path, search, expected] of [
    ["/", "", `${CANONICAL_TARGET}/`],
    ["/", "?q=1", `${CANONICAL_TARGET}/?q=1`],
    ["/feed.xml", "", `${CANONICAL_TARGET}/feed.xml`]
  ]) {
    const { response, assets } = await call(path, {
      search,
      origin: "http://www.inish.in"
    });
    assert.equal(response.status, 301, `expected 301 for http://www.inish.in${path}`);
    assert.equal(
      response.headers.get("Location"),
      expected,
      `Location must collapse both http and www in one hop`
    );
    assert.equal(response.headers.get("Strict-Transport-Security"), HSTS);
    assert.deepEqual(assets.reads, []);
  }
});

test("canonical: the canonical origin is not self-redirected (loop guard)", async () => {
  // The bare-apex HTTPS origin must NOT produce a 301 to itself: that would
  // be a redirect loop on the first visit. The canonical check must return
  // null for it and let the path-based decision run normally.
  for (const path of ["/", "/feed.xml", "/styles.css", "/admin", "/daily/2026-08-09"]) {
    const { response } = await call(path, { origin: CANONICAL_TARGET });
    assert.notEqual(response.status, 301, `canonical origin must not 301 ${path}`);
  }
});

test("canonical: HEAD on a non-canonical URL still 301s without reading ASSETS", async () => {
  // Same canonical behavior for HEAD as for GET: 301 with HSTS, zero asset
  // reads (the redirect short-circuits the asset lookup).
  for (const origin of ["http://inish.in", "https://www.inish.in", "http://www.inish.in"]) {
    const { response, assets } = await call("/", { method: "HEAD", origin });
    assert.equal(response.status, 301, `HEAD on ${origin}/ must 301`);
    assert.equal(
      response.headers.get("Location"),
      `${CANONICAL_TARGET}/`,
      `HEAD on ${origin}/ must redirect to the canonical origin`
    );
    assert.equal(response.headers.get("Strict-Transport-Security"), HSTS);
    assert.deepEqual(assets.reads, [], `HEAD canonical redirect must not touch ASSETS`);
  }
});

// Security headers beyond HSTS — route data in public-paths.json, applied by
// withSecurityHeaders on every response class. The behavioral assertions below
// read the contract file directly (not policy.js's re-export) so a stubbed or
// emptied export cannot silently pass, and the source-contract suite in
// tests/test_verify_live.py pins that the edge sources derive the values from
// the contract instead of redeclaring them.

const CONTRACT = JSON.parse(
  readFileSync(new URL("../public-paths.json", import.meta.url), "utf8")
);

test("route contract: securityHeaders carries the hardening set", () => {
  const names = Object.keys(CONTRACT.securityHeaders ?? {});
  for (const name of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Content-Security-Policy",
    "X-Frame-Options"
  ]) {
    assert.ok(names.includes(name), `public-paths.json must declare ${name}`);
    assert.ok(CONTRACT.securityHeaders[name].length > 0, `${name} must have a value`);
  }
  assert.ok(
    CONTRACT.securityHeaders["Content-Security-Policy"].includes("default-src 'none'"),
    "the CSP must be deny-by-default"
  );
  assert.ok(
    CONTRACT.securityHeaders["Content-Security-Policy"].includes("frame-ancestors 'none'"),
    "the CSP must forbid framing"
  );
  // policy.js must expose exactly what the contract declares — no drift.
  assert.deepEqual(securityHeaders, Object.entries(CONTRACT.securityHeaders));
});

test("security headers: a served asset carries the full contract set", async () => {
  const { response } = await call("/styles.css");
  assert.equal(response.status, 200);
  for (const [name, value] of securityHeaders) {
    assert.equal(response.headers.get(name), value, `200 /styles.css must carry ${name}`);
  }
});

test("security headers: the branded 404 carries the full contract set", async () => {
  const { response } = await call("/admin");
  assert.equal(response.status, 404);
  for (const [name, value] of securityHeaders) {
    assert.equal(response.headers.get(name), value, `404 /admin must carry ${name}`);
  }
});

test("security headers: a legacy redirect carries the full contract set", async () => {
  const { response } = await call("/daily/feed.xml");
  assert.equal(response.status, 301);
  for (const [name, value] of securityHeaders) {
    assert.equal(response.headers.get(name), value, `301 /daily/feed.xml must carry ${name}`);
  }
});

test("security headers: a canonical-host redirect carries the full contract set", async () => {
  const { response } = await call("/feed.xml", { origin: "https://www.inish.in" });
  assert.equal(response.status, 301);
  for (const [name, value] of securityHeaders) {
    assert.equal(response.headers.get(name), value, `canonical 301 must carry ${name}`);
  }
});

test("security headers: a bodyless HEAD denial still carries the full contract set", async () => {
  const { response } = await call("/secrets.json", { method: "HEAD" });
  assert.equal(response.status, 404);
  for (const [name, value] of securityHeaders) {
    assert.equal(response.headers.get(name), value, `HEAD 404 must carry ${name}`);
  }
});
