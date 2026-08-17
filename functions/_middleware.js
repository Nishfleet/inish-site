// Live edge path is worker.js (Workers + assets). Keep this file's
// publicPaths/redirects/HSTS identical — tests enforce the shared contract.
//
// The decision lives in ./policy.js so the deny/allow/redirect branch can be
// exercised by real tests against the imported function rather than by
// substring matching on this file.
import { canonicalize, decide, redirects } from "./policy.js";

// The site is HTTPS-only, so every response from the middleware can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
const hstsHeader = "max-age=31536000; includeSubDomains";

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
  return withSecurityHeaders(await context.next());
}
