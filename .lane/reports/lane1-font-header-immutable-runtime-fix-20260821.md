# Lane 1: font responses crash the edge on the runtime's immutable asset headers

Date: 2026-08-21. Branch: `lane1/font-header-immutable-runtime-fix-20260821`.

## Symptom (live)

After the 2026-08-21 edition deploy, every `/fonts/*.woff2` request returned
HTTP 500 with body `error code: 1101` (unhandled worker exception):

```
$ curl -s https://inish.in/fonts/archivo-400.woff2
error code: 1101
```

`scripts/verify_live.py` caught it during the deploy's post-publish parity
check (`/fonts/archivo-400.woff2: expected exact 200 body, got 500`).

## Root cause

PR #100's immutable font cache header was applied by mutating the asset
response in place (`worker.js`):

```js
const asset = await env.ASSETS.fetch(request);
if (fontPath.test(url.pathname)) {
  asset.headers.set("Cache-Control", FONT_CACHE_CONTROL);
}
```

The Workers runtime returns `env.ASSETS.fetch()` responses whose headers are
immutable; `.set()` throws and the fetch handler rejects → edge error 1101.
Every other response class already rebuilds its response (the redirect paths
and `withSecurityHeaders` construct fresh Responses), so only fonts broke.
The Node test suite missed it because the mock ASSETS binding returned plain
`new Response(...)` objects whose headers are mutable in undici.

## Fix

Rebuild the response for font paths instead of mutating: copy the headers
into a fresh `Headers`, set the cache header there, and wrap the body in a
new `Response` — the same pattern every other response class already uses.

## Test

New edge test `cache: font responses survive the runtime's immutable asset
headers` models the runtime contract (a real Headers whose `set` throws) and
was verified in both directions:

- with the fix: 19/19 pass
- with the old mutating line restored: fails with
  `Cannot mutate immutable asset headers (Cache-Control)`

Full suites green: `node --test tests/*.test.mjs` 37 pass / 0 fail;
`python3 -m unittest discover -s tests` 114 tests OK.

## Live delivery

Deployed to live via the guarded publisher path (rollback target captured,
post-deploy `verify_live.py` parity gate). Re-verified live after the fix:

- `/fonts/archivo-400.woff2` → 200 with `Cache-Control: public, max-age=31536000, immutable`
- full `verify_live.py` parity against the deployed tree passes
