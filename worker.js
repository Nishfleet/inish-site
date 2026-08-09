// Live edge worker for inish.in (Workers + static assets).
// Mirrors the route contract in functions/_middleware.js: same publicPaths,
// font pattern, redirects, HSTS, and the branded 404 for unknown paths.
// Pages Functions are no longer the production edge path — the VPS fleet
// token can deploy Workers but not Cloudflare Pages, and OAuth expired
// 2026-08-04 left the site four days stale.
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

// The branded 404 page ships in the deployed public dir (deploy_daily.sh
// copies 404.html into the payload), so unknown paths answer with the real
// page while the status stays a truthful 404 and the body stays uncached.
// It is deliberately NOT added to publicPaths: the asset is served only
// through this internal fetch, never as a public route.
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
    // Internal fetch on the assets binding: only the path is matched, so the
    // hostname is irrelevant and /404.html resolves inside the deployed
    // public dir. The request method is preserved so HEAD stays bodyless,
    // and the asset body is streamed through untouched — never buffered.
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
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", hstsHeader);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
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
      return withSecurityHeaders(await serveNotFound(request, url, env));
    }
    // Assets binding resolves "/" to index.html via html_handling defaults.
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
