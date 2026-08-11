// Pages middleware mirror of the live edge path (worker.js). The route
// contract (publicPaths, font pattern, redirects, HSTS) lives in the shared
// route-contract.js — the single source of truth both edges import, which the
// tests enforce.
import { publicPaths, fontPath, redirects, hstsHeader } from "../route-contract.js";

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
