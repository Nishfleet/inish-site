// Live edge path is worker.js (Workers + assets). Keep this file's
// publicPaths/redirects/HSTS identical — tests enforce the shared contract.
const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png", // iOS home-screen icon, referenced by the generated head
  "/og-image.svg", // social share card, referenced by the generated head
  "/fonts/OFL.txt", // the SIL OFL license text the shipped stylesheet points at
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
