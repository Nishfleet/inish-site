// Edge worker for The Daily (https://nish.sh/daily) and the retired inish.in.
// Workers + static assets. Route policy lives in policy.js; route data lives in
// public-paths.json.
//
// Routes (wrangler.jsonc): nish.sh/daily and nish.sh/daily/* are more specific
// than the zone's catch-all nish.sh/* (fleet-console), so Cloudflare sends only
// the daily page here. inish.in and www.inish.in stay routed to this worker
// solely to answer every request with a permanent redirect.
import {
  assetFor,
  hstsHeader,
  notFoundAssetUrl,
  redirectFor,
  securityHeaders,
  styleHashesHeader,
  withStyleHashes
} from "./policy.js";

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", hstsHeader);
  const styleHashes = headers.get(styleHashesHeader);
  headers.delete(styleHashesHeader);
  for (const [name, value] of securityHeaders) {
    headers.set(
      name,
      name === "Content-Security-Policy" ? withStyleHashes(value, styleHashes) : value
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// The branded 404 page ships in public/ as /404.html and is read through the
// ASSETS binding, so the edge never embeds markup. HEAD stays bodyless and a
// failed asset fetch falls back to a plain 404.
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
      const headers = new Headers(notFoundHeaders);
      const styleHashes = asset.headers.get(styleHashesHeader);
      if (styleHashes !== null) headers.set(styleHashesHeader, styleHashes);
      return new Response(asset.body, { status: 404, headers });
    }
  } catch {
    // The asset or binding failed; fall back rather than surfacing an error.
  }
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const moved = redirectFor(url);
    if (moved !== null) {
      // Manual 301 instead of Response.redirect(): the runtime's redirect
      // response has immutable headers, so HSTS could not be added to it.
      return withSecurityHeaders(new Response(null, { status: 301, headers: { Location: moved } }));
    }
    const path = assetFor(url.pathname);
    if (path === null) {
      return withSecurityHeaders(await notFoundResponse(request, env));
    }
    // html_handling is "none", so the binding serves files by their real path
    // only; /daily and /daily/ are rewritten to the index file here.
    const asset = await env.ASSETS.fetch(new Request(new URL(path, url), request));
    return withSecurityHeaders(asset);
  }
};
