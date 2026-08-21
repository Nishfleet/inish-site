// Live edge worker for inish.in (Workers + static assets).
// The public route contract — the publicPaths allowlist, the font pattern, the
// redirects — has ONE source of truth: functions/policy.js. worker.js and the
// Pages mirror functions/_middleware.js both import it, so adding a public
// path is a single edit in the policy module, never a hunt through mirrored
// literals. Pages Functions are no longer the production edge path — the VPS
// fleet token can deploy Workers but not Cloudflare Pages, and OAuth expired
// 2026-08-04 left the site four days stale.
import {
  canonicalize,
  decide,
  fontPath,
  hstsHeader,
  notFoundAssetUrl,
  redirects,
  securityHeaders
} from "./functions/policy.js";

// HSTS lives in public-paths.json as the single source of truth for the route
// contract; policy.js re-exports it and the worker applies it to every
// response. The value itself is route data, not plumbing. The remaining
// security headers (nosniff, referrer policy, CSP, frame guard) flow through
// the same contract and are applied right after HSTS on every response class.

// The four webfonts ship under stable, fingerprint-free URLs (styles.css
// references /fonts/<face>.woff2 directly), so a browser revalidates them on
// every visit unless the response says otherwise. They never change between
// editions, so the worker gives them a one-year immutable cache: the browser
// skips the request entirely after the first fetch. The font pattern is the
// same narrow one policy.js uses for the deny decision — nothing but woff2
// files from /fonts can ever receive this header.
const FONT_CACHE_CONTROL = "public, max-age=31536000, immutable";

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", hstsHeader);
  for (const [name, value] of securityHeaders) {
    headers.set(name, value);
  }
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
// The asset URL itself is route data: policy.js derives it from canonicalOrigin,
// so a canonical-host change is a single edit and so is a rename of the 404
// asset to a path other than /404.html.
const notFoundHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8"
};

async function notFoundResponse(request, env) {
  if (request.method === "HEAD") {
    return new Response(null, { status: 404, headers: notFoundHeaders });
  }
  try {
    const asset = await env.ASSETS.fetch(notFoundAssetUrl);
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
    const asset = await env.ASSETS.fetch(request);
    // The runtime hands back asset responses with immutable headers, so the
    // font cache header cannot be set in place — that mutation throws and
    // surfaces as an edge 1101. Rebuild the response with a fresh Headers
    // copy instead; every other response class already flows through this
    // rebuild inside withSecurityHeaders.
    let response = asset;
    if (fontPath.test(url.pathname)) {
      const headers = new Headers(asset.headers);
      headers.set("Cache-Control", FONT_CACHE_CONTROL);
      response = new Response(asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers
      });
    }
    // Assets binding resolves "/" to index.html via html_handling defaults.
    return withSecurityHeaders(response);
  }
};
