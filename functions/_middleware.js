// Pages parity mirror of the live edge worker (worker.js + Workers assets).
// The public route contract — the publicPaths allowlist, the font pattern, the
// redirects, and HSTS — has ONE source of truth: public-paths.json. worker.js
// and this file both read it, and scripts/verify_live.py plus the test suite
// derive their expectations from it, so a path addition is a single data edit
// instead of a multi-file contract change.
import routeContract from "../public-paths.json";

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
  response.headers.set("Strict-Transport-Security", hstsHeader);
  return response;
}

// Mirrors the worker's notFoundResponse exactly: serve the branded /404.html
// asset through the ASSETS binding with status 404, stream the body, keep HEAD
// bodyless, and fall back to the historical plain 404 if the asset is missing.
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

export async function onRequest(context) {
  const url = new URL(context.request.url);
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
    return withSecurityHeaders(await notFoundResponse(context.request, context.env));
  }
  return withSecurityHeaders(await context.next());
}
