# Font cache — `public, max-age=31536000, immutable`

The four webfonts ship under stable, fingerprint-free URLs
(`/fonts/<face>.woff2`) referenced directly from `styles.css`, so a
browser revalidates them on every visit unless the response says
otherwise. They never change between editions, so the worker gives
them a one-year immutable cache: the browser skips the request
entirely after the first fetch. The font pattern is the same narrow
one `policy.js` uses for the deny decision, so nothing but a woff2
from `/fonts` can ever receive this header.

## How to drive it

```bash
BASE=http://127.0.0.1:4891
for face in archivo-700 archivo-400 archivo-italic-700 space-mono-700; do
    cc=$(curl -sI "$BASE/fonts/${face}.woff2" \
        | awk 'tolower($1)=="cache-control:"{$1=""; sub(/^ /, ""); print}' \
        | tr -d '\r\n')
    [ "$cc" = "public, max-age=31536000, immutable" ] && echo "OK   $face" || echo "FAIL $face -> $cc"
done
```

The expected `Cache-Control` is exactly
`public, max-age=31536000, immutable`. The wrangler default
preserves the spaces the worker emits, so a local probe and a
live probe return the same value byte-for-byte.

```bash
# Deny other extensions from the same cache-control
for path in /fonts/OFL.txt /fonts/license.md; do
    cc=$(curl -sI "$BASE$path" | awk 'tolower($1)=="cache-control:"{print $2}' | tr -d '\r\n')
    echo "$cc  $path"
done
# The .txt path (in publicPaths) is NOT a woff2 and must NOT receive
# the immutable font cache. .md is a deny path entirely.
```

## What proves success

- Every woff2 face in `fonts/*.woff2` returns 200 with the immutable
  one-year cache header.
- The response carries the full security-header set (HSTS, CSP,
  Referrer-Policy, nosniff, frame guard) — the font cache header
  rides on the same `withSecurityHeaders()` rebuild as every other
  response class.
- The pattern is narrow: `/fonts/OFL.txt` (in `publicPaths` but not
  a woff2) and `/fonts/nope.woff2.css` (suffix injection) do not
  receive the immutable font cache header. A regression that widens
  the regex to serve the cache header on every `/fonts/*` path is
  exactly the kind of drift the
  `tests/test_middleware_deny.test.mjs` font samples catch.

## Local honesty note

The local font cache is identical to live: same `worker.js`, same
`policy.js`, same `fontPath` regex. The wrangler default
preserves the spaces the worker emits, so a local probe and a
live probe of the same path return the same `Cache-Control` value.
A `wrangler dev --local` that strips or rewrites this header would
be a wrangler bug to report upstream, not a harness regression.
