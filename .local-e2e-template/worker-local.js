// LOCAL-ONLY shim: re-exports the production worker with one adjustment
// that makes a local wrangler dev launch reachable from a loopback curl.
// The production worker is imported by reference, so its deny decision,
// security headers, font cache, and 404 page are unchanged.
//
// The adjustment:
//   The worker's canonicalize() redirects every non-canonical host
//   to https://inish.in/. workerd hands the worker a Request whose URL
//   reflects the listening socket (e.g. http://127.0.0.1:4891/), so a
//   local curl otherwise bounces to the live site. The shim rewrites
//   the request URL to the bare-apex HTTPS origin before forwarding,
//   which makes canonicalize() accept the request. Path and search are
//   preserved exactly so the deny/allow/redirect tree runs as it would
//   for the live edge.
//
// Local/live parity on "/" (documented in the harness SKILL.md):
//   the production worker rewrites "/" to "/index.html" before the
//   asset fetch, so html_handling "none" strands nothing and "/" serves
//   200 locally exactly as it does live. Probes still use a literal
//   asset path (/about.html) to isolate the binding's own serving.
//
// Lives under .local-e2e-template/ beside wrangler.local.jsonc; `npm run dev`
// serves it. Never imported from the production wrangler.jsonc.
import productionWorker from "../worker.js";

function rewriteRequestUrl(request) {
  const url = new URL(request.url);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    return request;
  }
  const rewritten = new URL(url.pathname + url.search, "https://inish.in/");
  return new Request(rewritten.href, request);
}

export default {
  fetch(request, env) {
    return productionWorker.fetch(rewriteRequestUrl(request), env);
  }
};
