// Edge route policy for The Daily (nish.sh/daily) and the retired inish.in.
//
// The route data lives once in public-paths.json. This module turns it into
// constants plus two pure functions the worker calls on every request:
// redirectFor() for host and scheme, and assetFor() for the path.
import routeContract from "./public-paths.json" with { type: "json" };

export const canonicalHost = routeContract.canonicalHost;
export const dailyUrl = routeContract.dailyUrl;
export const indexAsset = routeContract.indexAsset;
export const pagePaths = new Set(routeContract.pagePaths);
export const publicPaths = new Set(routeContract.publicPaths);

// The site is HTTPS-only, so every response from the worker can carry HSTS.
export const hstsHeader = routeContract.hstsHeader;
export const securityHeaders = Object.entries(routeContract.securityHeaders);

// The branded 404 page ships as public/404.html and is read through the ASSETS
// binding. The hostname in an internally constructed asset URL is ignored.
export const notFoundAssetUrl = new URL("/404.html", dailyUrl).href;

// Where this request must go instead, or null when it is served here.
// inish.in is retired: every URL on it (and on www., and on workers.dev) is a
// permanent redirect to the daily page. On nish.sh only plain http moves.
export function redirectFor(url) {
  if (url.hostname !== canonicalHost) return dailyUrl;
  if (url.protocol !== "https:") return new URL(url.pathname + url.search, dailyUrl).href.replace("/daily/daily", "/daily");
  return null;
}

// The asset to serve for `pathname` on nish.sh, or null for a 404.
export function assetFor(pathname) {
  if (pagePaths.has(pathname)) return indexAsset;
  if (publicPaths.has(pathname)) return pathname;
  return null;
}

// Build-time inline-style hashes. build.mjs inlines each page's CSS and
// publishes the sha256 of every <style> block in dist/_headers as an internal
// X-Style-Hashes header on the asset. The worker allows exactly those blocks in
// style-src, so the CSP never needs 'unsafe-inline'. Anything not shaped like a
// list of sha256 sources is ignored, so a malformed header cannot widen it.
export const styleHashesHeader = "X-Style-Hashes";
const styleHashList = /^'sha256-[A-Za-z0-9+/]+={0,2}'( 'sha256-[A-Za-z0-9+/]+={0,2}')*$/;

export function withStyleHashes(csp, hashes) {
  if (hashes === null || !styleHashList.test(hashes)) return csp;
  return csp.replace("style-src 'self'", `style-src 'self' ${hashes}`);
}
