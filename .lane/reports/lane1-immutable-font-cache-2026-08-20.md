# Lane 1 report — immutable webfont cache

**Item:** stop revalidating the four unchanged webfonts on every visit by giving `/fonts/*.woff2` a long immutable cache

**Branch:** `lane1/immutable-font-cache-2026-08-20`
**Commit:** `7636f56`
**PR:** https://github.com/nish3451/inish-site/pull/100

## What changed

| File | Change |
| --- | --- |
| `worker.js` | Static branch now stamps `Cache-Control: public, max-age=31536000, immutable` on responses whose pathname matches the `fontPath` pattern from `functions/policy.js` (the same narrow regex the deny decision uses). |
| `functions/_middleware.js` | Identical mirror for the kept-in-sync Pages middleware path. |
| `tests/test_worker_edge.test.mjs` | New behavioral test: every `/fonts/<name>.woff2` response carries the immutable header; `/`, `/styles.css`, `/app.js`, `/fonts/OFL.txt` do not. |
| `tests/test_middleware_deny.test.mjs` | New sync test: both edges share the exact same header literal and apply it via `fontPath.test(url.pathname)`. |

## Why this is the right shape

- The four faces (`archivo-400.woff2`, `archivo-400-italic.woff2`, `archivo-700.woff2`, `space-mono-700.woff2`) are referenced by stable, fingerprint-free URLs in `styles.css` and `index.html`, so without `immutable` every visit triggers a conditional revalidation.
- The header is applied only when the path matches the narrow `fontPath` regex — nothing but woff2 files from `/fonts` can receive it (tested).
- `immutable` is safe because the URLs are never fingerprinted: a real font change ships a new filename.
- The live verifier (`scripts/verify_live.py`) byte-checks fonts with a cache-busting `?deploy=` query, so the new header cannot interfere with deploy verification.
- Route data (the font pattern) still flows from `public-paths.json` → `functions/policy.js`; the cache header is response plumbing in the edge sources, matching the existing HSTS/404 pattern.

## Verification

- `node --test tests/test_worker_edge.test.mjs tests/test_middleware_deny.test.mjs` — 30 + 18 pass
- `python3 -m unittest discover -s tests -p "test_*.py"` — 112 pass
- Deploy payload logic untouched; `scripts/deploy_daily.sh` stages `fonts/` as before.

## Claims

`functions/_middleware.js`, `functions/policy.js` (read-only, no edit needed), `tests/test_middleware_deny.test.mjs`, `tests/test_worker_edge.test.mjs`, `worker.js`
