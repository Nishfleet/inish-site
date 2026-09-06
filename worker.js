// Live edge worker for inish.in (Workers + static assets).
// The public route contract — the publicPaths allowlist, the font pattern, the
// redirects, and HSTS — has ONE source of truth: public-paths.json. The
// policy module (functions/policy.js) imports that data and layers the
// runtime decision and canonicalization on top; worker.js and the Pages
// mirror functions/_middleware.js both import it, so adding a public path is
// a single data edit in public-paths.json instead of a hunt through mirrored
// literals. Pages Functions are no longer the production edge path — the VPS
// fleet token can deploy Workers but not Cloudflare Pages, and OAuth expired
// 2026-08-04 left the site four days stale.
import { canonicalize, decide, redirects, hstsHeader } from "./functions/policy.js";

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
    if (decision === "deny") {
      return withSecurityHeaders(await notFoundResponse(request, env));
    }
    // Assets binding resolves "/" to index.html via html_handling defaults.
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
