// Live edge worker for inish.in (Workers + static assets).
// The route contract (publicPaths, font pattern, redirects, HSTS) lives in
// route-contract.js — the single source of truth both edges import. Pages
// Functions are no longer the production edge path — the VPS fleet token can
// deploy Workers but not Cloudflare Pages, and OAuth expired 2026-08-04 left
// the site four days stale — but functions/_middleware.js mirrors this file
// and tests enforce the shared contract.
import { publicPaths, fontPath, redirects, hstsHeader } from "./route-contract.js";

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", hstsHeader);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// The branded 404 page ships in the assets payload as /404.html (staged by
// deploy_daily.sh beside index.html) and is served through the ASSETS binding,
// so the edge never embeds markup. The hostname in an internally constructed
// asset URL is ignored; the path is what matches. Unknown paths keep their 404
// status, the asset body is streamed rather than buffered, HEAD requests stay
// bodyless, and a failed asset fetch falls back to the historical plain 404.
const notFoundHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8"
};

async function notFoundResponse(request, env) {
  if (request.method === "HEAD") {
    return new Response(null, { status: 404, headers: notFoundHeaders });
  }
  try {
    const asset = await env.ASSETS.fetch("https://inish.in/404.html");
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = redirects.get(url.pathname);
    if (target) {
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
    if (!publicPaths.has(url.pathname) && !fontPath.test(url.pathname)) {
      return withSecurityHeaders(await notFoundResponse(request, env));
    }
    // Assets binding resolves "/" to index.html via html_handling defaults.
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
