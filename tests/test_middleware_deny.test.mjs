// Behavioral tests for the Pages middleware route decision.
//
// The Python test_middleware.py suite proves the publicPaths/redirects/font
// pattern stay in sync with the source. This suite proves the runtime
// decision still denies unlisted paths: it imports the pure decide() from
// functions/policy.js and checks its verdict against the real surface,
// which a `false &&` prefix or any other denial short-circuit would fail.
//
// node --test runs this file directly; no transpiler, no third-party deps.

import test from "node:test";
import assert from "node:assert/strict";

import { decide, publicPaths, redirects, fontPath } from "../functions/policy.js";

const DENY_SAMPLES = [
  // None of these are in the allowlist, none of these match the font pattern.
  "/admin",
  "/admin/",
  "/admin/login",
  "/secrets.json",
  "/.env",
  "/wp-login.php",
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
  "/index.html.bak", // suffix injection on a redirect target
];

const ALLOW_SAMPLES = [
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png",
  "/og-image.svg",
  "/og-image.png",
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/fonts/OFL.txt"
];

const REDIRECT_SAMPLES = [
  "/index.html",
  "/daily",
  "/daily/",
  "/daily/index.html",
  "/daily/app.js",
  "/daily/styles.css",
  "/daily/latest.json",
  "/daily/feed.xml",
  "/daily/sitemap.xml"
];

const FONT_SAMPLES = [
  "/fonts/archivo-700.woff2",
  "/fonts/archivo-400.woff2",
  "/fonts/archivo-italic-700.woff2",
  "/fonts/a.woff2",
  "/fonts/0.woff2"
];

test("deny: every unlisted sample path is denied", () => {
  for (const path of DENY_SAMPLES) {
    assert.equal(decide(path), "deny", `expected deny for ${path}`);
  }
});

test("deny: arbitrary paths under /daily/ are denied unless redirected", () => {
  // Sampled dates that are not in the redirect map: must be 404, not static.
  for (const date of ["2026-08-08", "2026-01-01", "2099-12-31"]) {
    const path = `/daily/${date}`;
    assert.equal(decide(path), "deny", `expected deny for ${path}`);
  }
});

test("allow: every public path is allowed", () => {
  for (const path of ALLOW_SAMPLES) {
    assert.equal(decide(path), "static", `expected static for ${path}`);
  }
});

test("allow: allowlist is exactly the published surface", () => {
  assert.deepEqual(
    [...publicPaths].sort(),
    [
      "/",
      "/app.js",
      "/styles.css",
      "/apple-touch-icon.png",
      "/og-image.svg",
      "/og-image.png",
      "/latest.json",
      "/feed.xml",
      "/robots.txt",
      "/sitemap.xml",
      "/fonts/OFL.txt"
    ].sort()
  );
});

test("redirect: every legacy redirected path is a redirect", () => {
  for (const path of REDIRECT_SAMPLES) {
    assert.equal(decide(path), "redirect", `expected redirect for ${path}`);
  }
});

test("redirect: redirect map is exactly the published surface", () => {
  assert.deepEqual(
    [...redirects.entries()].sort(),
    [
      ["/daily", "/"],
      ["/daily/", "/"],
      ["/daily/app.js", "/app.js"],
      ["/daily/feed.xml", "/feed.xml"],
      ["/daily/index.html", "/"],
      ["/daily/latest.json", "/latest.json"],
      ["/daily/sitemap.xml", "/sitemap.xml"],
      ["/daily/styles.css", "/styles.css"],
      ["/index.html", "/"]
    ].sort()
  );
});

test("font: every allowed woff2 from /fonts is static", () => {
  for (const path of FONT_SAMPLES) {
    assert.equal(decide(path), "static", `expected static for ${path}`);
  }
});

test("font: the narrow pattern only matches /fonts/<name>.woff2", () => {
  // These must be denied; the pattern must not be widened by a mutation.
  for (const path of [
    "/fonts/x.ttf",
    "/fonts/x.woff",
    "/fonts/x.css",
    "/fonts/x.woff2.css",
    "/fonts/x.woff2/",
    "/fonts/../app.js",
    "/fonts/.env"
  ]) {
    assert.equal(decide(path), "deny", `expected deny for ${path}`);
  }
  // The font regex itself must match exactly the prose above.
  assert.ok(fontPath.test("/fonts/archivo-700.woff2"));
  assert.equal(fontPath.test("/fonts/x.ttf"), false);
  assert.equal(fontPath.test("/fonts/../app.js"), false);
});

test("redirect: redirects take precedence over the allowlist", () => {
  // /styles.css is static on its own, but /daily/styles.css is a redirect
  // to it. The decision must return "redirect" for the redirect path,
  // never "static" — a mutation that drops the redirects.has() check would
  // misroute /daily/* into the static layer instead of the legacy path.
  assert.equal(decide("/styles.css"), "static");
  assert.equal(decide("/daily/styles.css"), "redirect");
  assert.equal(decide("/latest.json"), "static");
  assert.equal(decide("/daily/latest.json"), "redirect");
});

test("deny: a short-circuit of the deny condition flips the verdict", () => {
  // This is the negative-space test: we reimplement `decide` here with the
  // deny branch short-circuited to false, and assert that its verdict
  // disagrees with the real one for every deny sample. If the real
  // decision ever changed to also accept those paths, this test would
  // fail — which is the point: it pins the deny property to the behavior,
  // not the source.
  function short(pathname) {
    if (redirects.has(pathname)) return "redirect";
    // deny branch intentionally neutralised, mirroring the mutation under test
    if (false && !publicPaths.has(pathname) && !fontPath.test(pathname)) return "deny";
    return "static";
  }
  for (const path of DENY_SAMPLES) {
    assert.equal(decide(path), "deny", `real decide must deny ${path}`);
    assert.equal(short(path), "static", `mutated decide must allow ${path}`);
  }
});
