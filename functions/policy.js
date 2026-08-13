// Single source of truth for the Pages middleware route decision.
//
// The edge policy has to be tested by behavior, not by reading the source:
// substring matching on the deny branch is exactly the regression the focused
// suite exists to catch, but a mutation that keeps the substring while
// flipping the runtime meaning (e.g. prefixing the deny with `false &&`)
// would pass a static test. This module exposes the decision as a pure
// function returning one of "redirect", "deny", or "static", so the focused
// test can import it and exercise the deny property against real inputs.
//
// `publicPaths`, `fontPath`, and `redirects` are also exported so the
// middleware (and any future caller) can read the same constants the
// decision was made against. The render of `decide()` is the contract; the
// constants are the data.
export const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png", // iOS home-screen icon, referenced by the generated head
  "/og-image.svg", // legacy share-card source, kept reachable for compatibility
  "/og-image.png", // raster social share card, referenced by the generated head
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/fonts/OFL.txt" // SIL OFL 1.1 license text, referenced by styles.css
]);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a middleware edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
export const fontPath = /^\/fonts\/[a-z0-9-]+\.woff2$/;

export const redirects = new Map([
  ["/index.html", "/"],
  ["/daily", "/"],
  ["/daily/", "/"],
  ["/daily/index.html", "/"],
  ["/daily/app.js", "/app.js"],
  ["/daily/styles.css", "/styles.css"],
  ["/daily/latest.json", "/latest.json"],
  ["/daily/feed.xml", "/feed.xml"],
  ["/daily/sitemap.xml", "/sitemap.xml"]
]);

// Decide what the middleware should do for `pathname`.
//
// The deny branch must stay anchored to the two checks below. A catch-all, a
// widened allowlist, or a `false &&` prefix would let every unlisted path
// through to the static layer, and the focused test suite in
// tests/test_middleware_deny.test.mjs is the executable proof.
export function decide(pathname) {
  if (redirects.has(pathname)) return "redirect";
  if (!publicPaths.has(pathname) && !fontPath.test(pathname)) return "deny";
  return "static";
}
