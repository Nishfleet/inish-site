// Live edge worker for inish.in (Workers + static assets).
// The public route contract — the publicPaths allowlist, the font pattern, the
// redirects, and HSTS — has ONE source of truth: public-paths.json. worker.js
// and the Pages parity mirror functions/_middleware.js both read it, and
// scripts/verify_live.py plus the test suite derive their expectations from
// it, so adding a public path is a single data edit instead of a multi-file
// contract change. Pages Functions are no longer the production edge path —
// the VPS fleet token can deploy Workers but not Cloudflare Pages, and OAuth
// expired 2026-08-04 left the site four days stale.
import routeContract from "./public-paths.json";

const publicPaths = new Set(routeContract.publicPaths);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a middleware edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
const fontPath = new RegExp(routeContract.fontPath);

const redirects = new Map(Object.entries(routeContract.redirects));

// The site is HTTPS-only, so every response from the middleware can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
const hstsHeader = routeContract.hstsHeader;

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
