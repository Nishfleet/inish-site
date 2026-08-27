# Security headers — HSTS, CSP, Referrer-Policy, nosniff, frame guard

Every response class on the live edge carries the full security-header
set. The values live in `public-paths.json` as the single source of
truth for the route contract: `hstsHeader` is a string, `securityHeaders`
is a `{ name: value }` object. `policy.js` re-exports both, and the
worker's `withSecurityHeaders(response)` rebuilds every response with
the full set. There is no per-class omission — the branded 404, the
apex canonicalize 301, the legacy `/daily/*` redirects, the asset
served 200s, the font-served 200s, the OG image, the raster social
card: all five headers, every time.

## How to drive it

```bash
BASE=http://127.0.0.1:4891
PROBE_PATHS="/ /about.html /admin /fonts/archivo-700.woff2 /feed.xml /latest.json /about /index.html"
for path in $PROBE_PATHS; do
    echo "== $path =="
    curl -sI "$BASE$path" | grep -iE '^(strict-transport-security|content-security-policy|referrer-policy|x-content-type-options|x-frame-options):'
    echo
done
```

Every block must contain all five headers, with the same values
across paths (the only path-dependent header is the 404's
`Cache-Control: no-store`).

Expected values (from `public-paths.json`):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

The CSP is the most fragile — it forbids everything except first-party
stylesheets, scripts, fonts, and images. A regression that adds a
CDN-hosted font (the kind of regression the live edge's Cloudflare
beacon probe would silently absorb) shows up here as a CSP that
allows `cdn.example.com` and a probe that passes the bare check.

## What proves success

- All five headers present on every probed path.
- Header values are exactly the `public-paths.json` values, byte for
  byte.
- A redirect response (301) carries the headers, not just the 200s.
- A 404 response (deny path) carries the headers, including the
  `no-store` cache header on top.

## Local honesty note

The local launch's security headers are identical to live: same
`policy.js`, same `securityHeaders` object, same `withSecurityHeaders`
rebuild. The harness's `tests/test_middleware.py` and
`tests/test_worker_edge.test.mjs` pin the per-class contract on
the in-process side; this feature is the network-level proof.
