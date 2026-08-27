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
// Known local divergence (documented in the harness SKILL.md):
//   With html_handling "none", the local wrangler dev binding serves
//   only literal asset paths; "/" is not mapped to index.html. The
//   live inish.in binding serves "/" with 200. A future fix on main
//   would close the gap. The shim does not paper over it — the local
//   launch reports what the local binding actually does, and the
//   harness SKILL.md tells agents to probe a non-root path when they
//   need an asset-served 200 locally.
//
// Lives under .local-e2e-template/ so the harness script copies it into
// the temp work dir alongside the real worker. Never imported from the
// production wrangler.jsonc.
import productionWorker from "./worker.js";

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
