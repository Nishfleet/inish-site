// Live edge worker for inish.in (Workers + static assets).
// Mirrors the route contract in functions/_middleware.js: same publicPaths,
// font pattern, redirects, and HSTS. Pages Functions are no longer the
// production edge path — the VPS fleet token can deploy Workers but not
// Cloudflare Pages, and OAuth expired 2026-08-04 left the site four days stale.
const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png", // iOS home-screen icon, referenced by the generated head
  "/og-image.svg", // social share card, referenced by the generated head
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/fonts/OFL.txt" // SIL OFL 1.1 license text, referenced by styles.css
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
