// Live edge path is worker.js (Workers + assets). Keep this file's
// publicPaths/redirects/HSTS and the branded 404 branch identical — tests
// enforce the shared contract.
const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png", // iOS home-screen icon, referenced by the generated head
  "/og-image.svg", // social share card, referenced by the generated head
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml"
]);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a middleware edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
const fontPath = /^\/fonts\/[a-z0-9-]+\.woff2$/;

const redirects = new Map([
  ["/index.html", "/"],
  ["/daily", "/"],
  ["/daily/", "/"],
  ["/daily/index.html", "/"],
  ["/daily/app.js", "/app.js"],
  ["/daily/styles.css", "/styles.css"],
  ["/daily/latest.json", "/latest.json"],
  ["/daily/feed.xml", "/feed.xml"],
  ["/daily/sitemap.xml", "/sitemap.xml"]
]);

// The site is HTTPS-only, so every response from the middleware can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
const hstsHeader = "max-age=31536000; includeSubDomains";

// Mirrors worker.js: unknown paths answer with the deployed 404.html asset,
// streamed at HTTP 404 and never buffered, falling back to the plain-text
// line if the asset cannot be fetched. Pages Functions expose the same
// ASSETS binding. The asset is deliberately not in publicPaths: it is only
// reachable through this internal fetch, never as a public route.
const notFoundAsset = "/404.html";

function plainNotFound(method) {
  // Kept as the last-resort reply: if the asset cannot be fetched, serve the
  // original text 404 rather than exposing another asset or throwing. HEAD
  // stays bodyless on every path, fallback included.
  const body = method === "HEAD" ? null : "Not found";
  return new Response(body, {
    status: 404,
    headers: { "Cache-Control": "no-store" }
  });
}

async function serveNotFound(request, url, env) {
  try {
    const asset = await env.ASSETS.fetch(
      new Request(new URL(notFoundAsset, url.origin), { method: request.method })
    );
    if (!asset.ok) {
      return plainNotFound(request.method);
    }
    return new Response(asset.body, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (error) {
    return plainNotFound(request.method);
  }
}

function withSecurityHeaders(response) {
  response.headers.set("Strict-Transport-Security", hstsHeader);
  return response;
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
    return withSecurityHeaders(await serveNotFound(context.request, url, context.env));
  }
  return withSecurityHeaders(await context.next());
}
