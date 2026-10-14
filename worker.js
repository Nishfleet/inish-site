import {
  assetFor,
  hstsHeader,
  notFoundAssetUrl,
  redirectFor,
  securityHeaders,
  styleHashesHeader,
  withStyleHashes
} from "./policy.js";

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", hstsHeader);
  const styleHashes = headers.get(styleHashesHeader);
  headers.delete(styleHashesHeader);
  for (const [name, value] of securityHeaders) {
    headers.set(
      name,
      name === "Content-Security-Policy" ? withStyleHashes(value, styleHashes) : value
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

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
      const headers = new Headers(notFoundHeaders);
      const styleHashes = asset.headers.get(styleHashesHeader);
      if (styleHashes !== null) headers.set(styleHashesHeader, styleHashes);
      return new Response(asset.body, { status: 404, headers });
    }
  } catch {}
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const moved = redirectFor(url);
    if (moved !== null) {
      // Response.redirect() returns immutable headers, so HSTS cannot be added to it.
      return withSecurityHeaders(new Response(null, { status: 301, headers: { Location: moved } }));
    }
    const path = assetFor(url.pathname);
    if (path === null) {
      return withSecurityHeaders(await notFoundResponse(request, env));
    }
    const asset = await env.ASSETS.fetch(new Request(new URL(path, url), request));
    return withSecurityHeaders(asset);
  }
};
