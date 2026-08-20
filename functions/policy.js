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
// The route DATA — the publicPaths allowlist, the font pattern, the redirects,
// the HSTS value, and the canonical origin — has ONE source of truth:
// public-paths.json. worker.js and this file both read it, and
// scripts/verify_live.py plus the test suite derive their expectations from
// it, so adding a public path is a single data edit instead of a multi-file
// contract change. This module derives the constants from that file and
// exposes the decision as a pure function; the render of `decide()` is the
// contract, the constants are the data.
//
// `canonicalOrigin` and `canonicalize()` cover the host/scheme side of the
// same contract: the bare-apex HTTPS origin is the only URL the site serves
// from, and any request that arrives on http://, on the www subdomain, or on
// any other combination gets 301'd to that origin before the path-based
// decision runs. Both edge entrypoints (the live Worker and the kept-in-sync
// Pages middleware) call `canonicalize()` first so the bare-apex visitor
// never reaches the policy module twice.
import routeContract from "../public-paths.json" with { type: "json" };

export const canonicalOrigin = routeContract.canonicalOrigin;

export const publicPaths = new Set(routeContract.publicPaths);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a middleware edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
export const fontPath = new RegExp(routeContract.fontPath);

export const redirects = new Map(Object.entries(routeContract.redirects));

// The site is HTTPS-only, so every response from the middleware can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
export const hstsHeader = routeContract.hstsHeader;

// The branded 404 page ships as /404.html in the deploy payload (staged beside
// index.html by deploy_daily.sh). The edge reads it through the ASSETS binding
// using this URL — derived from canonicalOrigin so a host change or a rename
// of the asset are single edits to public-paths.json instead of mirrored
// literals in both edge sources. The hostname in an internally constructed
// asset URL is ignored; the path is what matches.
export const notFoundAssetUrl = new URL("/404.html", canonicalOrigin).href;

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

// Returns the canonical URL string for `url` (scheme + bare apex + path +
// search), or null when the URL is already on the canonical origin. Called
// before `decide()` in both edge entrypoints so a single 301 handles
// http→https, www→bare, and any combined case in one hop — without it the
// worker would serve three extra copies of the site on http://inish.in/,
// https://www.inish.in/, and http://www.inish.in/. The search string is
// preserved because analytics and link previews care about it; the fragment
// is never part of the request URL anyway.
export function canonicalize(url) {
  const isHttps = url.protocol === "https:";
  const isBare = url.hostname === "inish.in";
  if (isHttps && isBare) return null;
  return new URL(url.pathname + url.search, canonicalOrigin).href;
}
