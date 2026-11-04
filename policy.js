import routeContract from "./public-paths.json" with { type: "json" };

export const canonicalHost = routeContract.canonicalHost;
export const dailyUrl = routeContract.dailyUrl;
export const indexAsset = routeContract.indexAsset;
export const pagePaths = new Set(routeContract.pagePaths);
export const publicPaths = new Set(routeContract.publicPaths);

export const hstsHeader = routeContract.hstsHeader;
export const securityHeaders = Object.entries(routeContract.securityHeaders);

// upstream: the ASSETS binding matches only the pathname, https://developers.cloudflare.com/workers/static-assets/binding/
export const notFoundAssetUrl = new URL("/404.html", dailyUrl).href;

/**
 * @param {URL} url
 * @returns {string | null}
 */
export function redirectFor(url) {
  if (url.hostname !== canonicalHost && !url.hostname.endsWith(".workers.dev")) return dailyUrl;
  if (url.protocol === "https:") return null;
  const secure = new URL(url);
  secure.protocol = "https:";
  return secure.href;
}

/**
 * @param {string} pathname
 * @returns {string | null}
 */
export function assetFor(pathname) {
  if (pagePaths.has(pathname)) return indexAsset;
  if (publicPaths.has(pathname)) return pathname;
  return null;
}

export const styleHashesHeader = "X-Style-Hashes";
const styleHashList = /^'sha256-[A-Za-z0-9+/]+={0,2}'( 'sha256-[A-Za-z0-9+/]+={0,2}')*$/;

/**
 * @param {string} csp
 * @param {string | null} hashes
 * @returns {string}
 */
export function withStyleHashes(csp, hashes) {
  if (hashes === null || !styleHashList.test(hashes)) return csp;
  return csp.replace("style-src 'self'", `style-src 'self' ${hashes}`);
}
