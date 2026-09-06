// Single source of truth for the Pages middleware route decision.
//
// The public route contract — the publicPaths allowlist, the font pattern, the
// redirects, and HSTS — has ONE source of truth: public-paths.json at the
// repository root. This module imports that data and layers the runtime
// decision (decide) and the host/scheme canonicalization (canonicalize) on
// top, so the edge files never inline route data and never duplicate the
// contract. deploy_daily.sh ships both public-paths.json and this module
// beside worker.js so the import resolves at deploy time.
//
// The edge policy has to be tested by behavior, not by reading the source:
// substring matching on the deny branch is exactly the regression the focused
// suite exists to catch, but a mutation that keeps the substring while
// flipping the runtime meaning (e.g. prefixing the deny with `false &&`)
// would pass a static test. This module exposes the decision as a pure
// function returning one of "redirect", "deny", or "static", so the focused
// test can import it and exercise the deny property against real inputs.
//
// `publicPaths`, `fontPath`, `redirects`, and `hstsHeader` are derived from
// public-paths.json and re-exported so the middleware (and any future caller)
// can read the same constants the decision was made against. The render of
// `decide()` is the contract; the data is the source.
//
// `canonicalOrigin` and `canonicalize()` cover the host/scheme side of the
// same contract: the bare-apex HTTPS origin is the only URL the site serves
// from, and any request that arrives on http://, on the www subdomain, or on
// any other combination gets 301'd to that origin before the path-based
// decision runs. Both edge entrypoints (the live Worker and the kept-in-sync
// Pages middleware) call `canonicalize()` first so the bare-apex visitor
// never reaches the policy module twice.
import routeContract from "../public-paths.json";

export const canonicalOrigin = "https://inish.in/";

// The route data lives in public-paths.json; this module is the logic layer on
// top of that single data source. The edge files import the decision and the
// canonicalization from here and never re-declare their own literals.
export const hstsHeader = routeContract.hstsHeader;

export const publicPaths = new Set(routeContract.publicPaths);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a middleware edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
export const fontPath = new RegExp(routeContract.fontPath);

export const redirects = new Map(Object.entries(routeContract.redirects));

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
