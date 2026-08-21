// Live edge path is worker.js (Workers + assets). Keep this file's
// publicPaths/redirects/HSTS identical — tests enforce the shared contract.
//
// The decision lives in ./policy.js so the deny/allow/redirect branch can be
// exercised by real tests against the imported function rather than by
// substring matching on this file.
import {
  canonicalize,
  decide,
  fontPath,
  hstsHeader,
  notFoundAssetUrl,
  redirects,
  securityHeaders
} from "./policy.js";

// HSTS lives in public-paths.json as the single source of truth for the route
// contract; policy.js re-exports it and the middleware applies it to every
// response. The value itself is route data, not plumbing. The remaining
// security headers (nosniff, referrer policy, CSP, frame guard) flow through
// the same contract and are applied right after HSTS on every response class.

// Fonts mirror the worker's cache policy: stable URLs, never change between
// editions, one-year immutable cache so the browser stops revalidating them
// on every visit. The narrow font pattern keeps the header off everything
// else. The literal must stay identical to worker.js — the worker is the live
// edge and this file is its kept-in-sync mirror.
const FONT_CACHE_CONTROL = "public, max-age=31536000, immutable";

function withSecurityHeaders(response) {
  response.headers.set("Strict-Transport-Security", hstsHeader);
  for (const [name, value] of securityHeaders) {
    response.headers.set(name, value);
  }
  return response;
}

// Mirrors the worker's notFoundResponse exactly: serve the branded /404.html
// asset through the ASSETS binding with status 404, stream the body, keep HEAD
// bodyless, and fall back to the historical plain 404 if the asset is missing.
// The asset URL is route data, derived from canonicalOrigin by policy.js, so
// the worker and the kept-in-sync middleware always point at the same place.
const notFoundHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8"
};

async function notFoundResponse(request, env) {
  if (request.method === "HEAD") {
    return new Response(null, { status: 404, headers: notFoundHeaders });
  }
  try {
    const asset = await env.ASSETS.fetch(notFoundAssetUrl);
    if (asset.ok) {
      return new Response(asset.body, { status: 404, headers: notFoundHeaders });
    }
  } catch {
    // The asset or binding failed; fall back rather than surfacing an error.
  }
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Canonicalize to https://inish.in{path}{search} before any path-based
  // decision runs: http://, www., and the combined cases all collapse to a
  // single 301 instead of serving three extra copies of the site.
  const canonical = canonicalize(url);
  if (canonical !== null) {
    return withSecurityHeaders(
      new Response(null, {
        status: 301,
        headers: { Location: canonical }
      })
    );
  }
  const decision = decide(url.pathname);
  if (decision === "redirect") {
    const target = redirects.get(url.pathname);
    const destination = new URL(target, url.origin);
    destination.search = url.search;
    // Manual 301 instead of Response.redirect(): the runtime's redirect
    // response has immutable headers, so HSTS could not be added to it.
    return withSecurityHeaders(
      new Response(null, {
        status: 301,
        headers: { Location: destination.href }
      })
    );
  }
  if (decision === "deny") {
    return withSecurityHeaders(await notFoundResponse(context.request, context.env));
  }
  const response = await context.next();
  if (fontPath.test(url.pathname)) {
    response.headers.set("Cache-Control", FONT_CACHE_CONTROL);
  }
  return withSecurityHeaders(response);
}
