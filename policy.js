// Edge route policy for inish.in, imported by worker.js.
//
// The route data (public paths, font pattern, redirects, security headers,
// canonical origin) lives once in public-paths.json. This module turns it into
// constants plus two pure functions the worker calls on every request:
// canonicalize() for host/scheme and decide() for the path.
import routeContract from "./public-paths.json" with { type: "json" };

export const canonicalOrigin = routeContract.canonicalOrigin;

export const publicPaths = new Set(routeContract.publicPaths);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a code edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
export const fontPath = new RegExp(routeContract.fontPath);

export const redirects = new Map(Object.entries(routeContract.redirects));

// The site is HTTPS-only, so every response from the worker can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
export const hstsHeader = routeContract.hstsHeader;

// The rest of the security-header set (nosniff, referrer policy, CSP, frame
// guard), stored as ordered [name, value] pairs so both edge entrypoints apply
// them in contract order with a plain loop. The page itself is what makes a
// strict CSP possible: no inline styles, scripts, or handlers, no forms, no
// frames, every asset self-hosted, and the JSON-LD block is non-executable
// data that script-src does not govern. Route data lives here for the same
// reason HSTS does — one edit in public-paths.json, never mirrored literals.
export const securityHeaders = Object.entries(routeContract.securityHeaders);

// Headers added to HTML responses only. No Link preload header: build.mjs
// inlines the whole stylesheet. Cache-Control keeps the asset default and adds
// no-transform, so the edge does not inject the third-party analytics beacon
// into the page. Route data lives in public-paths.json like everything above.
export const htmlHeaders = Object.entries(routeContract.htmlHeaders);

// The branded 404 page ships as public/404.html. The edge reads it through the ASSETS binding
// using this URL — derived from canonicalOrigin so a host change or a rename
// of the asset are single edits to public-paths.json instead of mirrored
// literals in both edge sources. The hostname in an internally constructed
// asset URL is ignored; the path is what matches.
export const notFoundAssetUrl = new URL("/404.html", canonicalOrigin).href;

// Decide what the worker should do for `pathname`. Anything not listed and
// not a font is denied; tests/test_policy.test.mjs is the executable proof.
export function decide(pathname) {
  if (redirects.has(pathname)) return "redirect";
  if (!publicPaths.has(pathname) && !fontPath.test(pathname)) return "deny";
  return "static";
}

// Returns the canonical URL string for `url` (scheme + bare apex + path +
// search), or null when the URL is already canonical. One 301 covers
// http→https, www→bare, and the workers.dev hostname.
export function canonicalize(url) {
  if (url.protocol === "https:" && url.hostname === "inish.in") return null;
  return new URL(url.pathname + url.search, canonicalOrigin).href;
}

// Build-time inline-style hashes. build.mjs inlines each page's critical CSS
// and publishes the sha256 of every <style> block in dist/_headers as an
// internal X-Style-Hashes header on the asset. The worker allows exactly those
// blocks in style-src, so the CSP never needs 'unsafe-inline' and no hash is
// maintained by hand. Anything not shaped like a list of sha256 sources is
// ignored, so a malformed header cannot widen the policy.
export const styleHashesHeader = "X-Style-Hashes";
const styleHashList = /^'sha256-[A-Za-z0-9+/]+={0,2}'( 'sha256-[A-Za-z0-9+/]+={0,2}')*$/;

export function withStyleHashes(csp, hashes) {
  if (hashes === null || !styleHashList.test(hashes)) return csp;
  return csp.replace("style-src 'self'", `style-src 'self' ${hashes}`);
}
