// Behavioral tests for the edge: nish.sh/daily is served from the static assets
// and every URL on the retired inish.in answers with one permanent redirect.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import worker from "../worker.js";
import { assetFor, redirectFor } from "../policy.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = JSON.parse(readFileSync(join(ROOT, "public-paths.json"), "utf8"));
const DAILY = "https://nish.sh/daily";
// No includeSubDomains: this worker owns only /daily on nish.sh, not the whole zone.
const HSTS = "max-age=31536000";

// The files the binding can serve under html_handling "none": real paths only.
const SERVED = new Set(["/daily/index.html", ...CONTRACT.publicPaths, "/404.html"]);

function makeAssets() {
  const reads = [];
  return {
    reads,
    async fetch(input) {
      const { pathname } = new URL(typeof input === "string" ? input : input.url);
      reads.push(pathname);
      if (!SERVED.has(pathname)) return new Response("missing", { status: 404 });
      const type = pathname.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream";
      return new Response(`asset ${pathname}`, { status: 200, headers: { "Content-Type": type } });
    }
  };
}

async function call(url, { method = "GET" } = {}) {
  const assets = makeAssets();
  const response = await worker.fetch(new Request(url, { method, redirect: "manual" }), { ASSETS: assets });
  return { response, assets };
}

// --- route / redirect behavior -------------------------------------------------

test("inish.in: every request is a 301 to https://nish.sh/daily", async () => {
  const samples = [
    "https://inish.in/",
    "https://inish.in",
    "https://inish.in/latest.json",
    "https://inish.in/daily/2026-08-08",
    "https://inish.in/about.html?utm=x",
    "https://inish.in/feed.xml",
    "https://www.inish.in/",
    "https://www.inish.in/anything/at/all",
    "http://inish.in/",
    "http://www.inish.in/x",
    "https://inish-site.example.workers.dev/"
  ];
  for (const url of samples) {
    for (const method of ["GET", "HEAD"]) {
      const { response, assets } = await call(url, { method });
      assert.equal(response.status, 301, `${method} ${url}`);
      assert.equal(response.headers.get("Location"), DAILY, `${method} ${url}`);
      assert.equal(response.headers.get("Strict-Transport-Security"), HSTS);
      assert.deepEqual(assets.reads, [], `${url} must not read assets`);
    }
  }
});

test("nish.sh: plain http moves to https and keeps path and query", () => {
  assert.equal(redirectFor(new URL("http://nish.sh/daily?x=1")), "https://nish.sh/daily?x=1");
  assert.equal(redirectFor(new URL("https://nish.sh/daily")), null);
});

test("http://nish.sh/daily?x=1 through the worker is one 301 to https with the query intact", async () => {
  const { response } = await call("http://nish.sh/daily?x=1&next=/daily/daily");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), "https://nish.sh/daily?x=1&next=/daily/daily");
});

test("the HSTS value never claims subdomains", () => {
  assert.ok(!CONTRACT.hstsHeader.includes("includeSubDomains"));
});

test("nish.sh/daily and /daily/ serve the index page with a 200, no redirect", async () => {
  for (const path of ["/daily", "/daily/", "/daily/index.html"]) {
    const { response, assets } = await call(`https://nish.sh${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("Content-Type"), /^text\/html/);
    assert.equal(await response.text(), "asset /daily/index.html");
    assert.deepEqual(assets.reads, ["/daily/index.html"]);
  }
});

test("nish.sh/daily?query still serves the page", async () => {
  const { response } = await call("https://nish.sh/daily?utm_source=newtab");
  assert.equal(response.status, 200);
});

test("every public asset is served from its own path under /daily", async () => {
  assert.ok(CONTRACT.publicPaths.length >= 4);
  for (const path of CONTRACT.publicPaths) {
    assert.ok(path.startsWith("/daily/"), path);
    const { response, assets } = await call(`https://nish.sh${path}`);
    assert.equal(response.status, 200, path);
    assert.deepEqual(assets.reads, [path]);
  }
});

test("unknown paths under /daily are a branded 404 that never reaches the asset", async () => {
  for (const path of ["/daily/nope", "/daily/2026-08-08", "/daily/.env", "/daily/latest.json.bak", "/dailyx", "/404.html", "/", "/daily//"]) {
    const { response, assets } = await call(`https://nish.sh${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), "asset /404.html");
    assert.deepEqual(assets.reads, ["/404.html"], path);
  }
});

test("HEAD on an unknown path is a bodyless 404 with no asset reads", async () => {
  const { response, assets } = await call("https://nish.sh/daily/nope", { method: "HEAD" });
  assert.equal(response.status, 404);
  assert.deepEqual(assets.reads, []);
});

test("assetFor maps only the page paths and the listed assets", () => {
  assert.equal(assetFor("/daily"), "/daily/index.html");
  assert.equal(assetFor("/daily/"), "/daily/index.html");
  assert.equal(assetFor("/daily/styles.css"), "/daily/styles.css");
  assert.equal(assetFor("/daily/other"), null);
});

// --- security headers -----------------------------------------------------------

test("every response class carries the full security header set", async () => {
  const urls = ["https://nish.sh/daily", "https://nish.sh/daily/styles.css", "https://nish.sh/daily/nope", "https://inish.in/"];
  for (const url of urls) {
    const { response } = await call(url);
    assert.equal(response.headers.get("Strict-Transport-Security"), HSTS, url);
    for (const [name, value] of Object.entries(CONTRACT.securityHeaders)) {
      assert.equal(response.headers.get(name), value, `${url} ${name}`);
    }
  }
});

test("inline-style hashes published by the build widen style-src, nothing else", async () => {
  const hash = "'sha256-p6Yxjd+yDzlohSSUThXMlMzIJ/WR/en0qGJRQ68kLBM='";
  for (const [header, expected] of [[hash, `style-src 'self' ${hash}`], ["'unsafe-inline'", "style-src 'self'"], [`${hash}; script-src *`, "style-src 'self'"]]) {
    const assets = {
      async fetch() {
        return new Response("x", { status: 200, headers: { "Content-Type": "text/html", "X-Style-Hashes": header } });
      }
    };
    const response = await worker.fetch(new Request("https://nish.sh/daily"), { ASSETS: assets });
    const styleSrc = response.headers.get("Content-Security-Policy").split(";").map((p) => p.trim()).find((p) => p.startsWith("style-src"));
    assert.equal(styleSrc, expected);
    assert.equal(response.headers.get("X-Style-Hashes"), null);
  }
  assert.ok(!CONTRACT.securityHeaders["Content-Security-Policy"].includes("unsafe-inline"));
});

// --- deployment contract ----------------------------------------------------------

function wranglerConfig() {
  const text = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(text);
}

test("wrangler routes: the daily page on nish.sh, redirects on inish.in, never the whole nish.sh zone", () => {
  const routes = wranglerConfig().routes.map((r) => `${r.zone_name} ${r.pattern}`);
  assert.deepEqual(
    routes.sort(),
    [
      "inish.in inish.in",
      "inish.in inish.in/*",
      "inish.in www.inish.in",
      "inish.in www.inish.in/*",
      "nish.sh nish.sh/daily",
      "nish.sh nish.sh/daily/*"
    ]
  );
  for (const route of routes) {
    assert.notEqual(route, "nish.sh nish.sh/*", "must not shadow fleet-console");
    assert.ok(!/^nish\.sh \*/.test(route));
  }
});

test("the committed site has every file the worker serves", () => {
  for (const path of CONTRACT.publicPaths) {
    assert.ok(existsSync(join(ROOT, "public", path)), `public${path} is missing`);
  }
  assert.ok(existsSync(join(ROOT, "public", "daily", "index.html")));
  assert.ok(existsSync(join(ROOT, "public", "404.html")));
});
