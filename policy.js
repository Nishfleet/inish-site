import routeContract from "./public-paths.json" with { type: "json" };

export const canonicalHost = routeContract.canonicalHost;
export const dailyUrl = routeContract.dailyUrl;
export const indexAsset = routeContract.indexAsset;
export const pagePaths = new Set(routeContract.pagePaths);
export const publicPaths = new Set(routeContract.publicPaths);

export const hstsHeader = routeContract.hstsHeader;
export const securityHeaders = Object.entries(routeContract.securityHeaders);

// The ASSETS binding ignores the hostname of an internally constructed asset URL.
export const notFoundAssetUrl = new URL("/404.html", dailyUrl).href;

export function redirectFor(url) {
  if (url.hostname !== canonicalHost) return dailyUrl;
  if (url.protocol === "https:") return null;
  const secure = new URL(url);
  secure.protocol = "https:";
  return secure.href;
}

export function assetFor(pathname) {
  if (pagePaths.has(pathname)) return indexAsset;
  if (publicPaths.has(pathname)) return pathname;
  return null;
}

export const styleHashesHeader = "X-Style-Hashes";
const styleHashList = /^'sha256-[A-Za-z0-9+/]+={0,2}'( 'sha256-[A-Za-z0-9+/]+={0,2}')*$/;

export function withStyleHashes(csp, hashes) {
  if (hashes === null || !styleHashList.test(hashes)) return csp;
  return csp.replace("style-src 'self'", `style-src 'self' ${hashes}`);
}
