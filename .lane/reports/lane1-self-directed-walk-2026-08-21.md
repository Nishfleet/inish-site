# Lane 1 — self-directed product walk 2026-08-21: edge security headers

Branch: `lane1/self-directed-walk-2026-08-21` (off origin/main `439416a`).
Item: self-directed cycle — walk the live product for public-promise gaps and
UX breakage; avoid ground already covered by open PRs.

## Walk performed

Live product (inish.in):
- All 12 allowlisted paths serve 200; an unknown path serves the branded 404
  with `no-store`; HSTS present on every response class.
- Live edition current for 2026-08-21; live head trails merged main only by
  today's not-yet-deployed PR #109 head metadata — owned by the daily deploy
  plus the hourly LIVE_IS_STALE check, not a defect.
- feed.xml well-formed XML with one item carrying the full edition;
  latest.json parses; robots.txt carries Sitemap + Content-Signal.
- og-image.png verified 1200x630 PNG; apple-touch-icon.png verified 180x180.
- Filter UX: `[hidden]` hiding pinned by `.story[hidden] { display:none }`
  (styles.css); quiet-day path renders no filter nav and app.js guards the
  missing live region.
- Deliberately untouched: the whole head/SEO surface (sameAs, knowsAbout,
  author @id, og:url, article image/description/dateModified, sitemap lastmod,
  llms.txt, font caching) — covered by open PRs #100–#108.

Suite baseline before change: 113 Python tests OK, 17 Node edge tests pass.

## Gap found

The edge sent exactly one security header (HSTS). Missing:
`X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, and
frame protection. The site is an ideal strict-CSP candidate: zero inline
styles/scripts/handlers (verified by scan over index.html/404.html/app.js),
no forms, no frames, every asset self-hosted, and the JSON-LD block is a
non-executable data block that `script-src` does not govern. The route
contract (`public-paths.json` → `functions/policy.js`) already has the exact
single-source-of-truth shape to carry header data — HSTS proves the pattern.

## Change

- `public-paths.json`: new `securityHeaders` route data — nosniff,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  `X-Frame-Options: DENY`.
- `functions/policy.js`: exports `securityHeaders` as ordered pairs derived
  from the contract.
- `worker.js` + `functions/_middleware.js`: apply every pair in
  `withSecurityHeaders`, on every response class (200 / branded 404 / legacy
  301 / canonical 301), keeping the test-mandated literal HSTS set line.
- Tests: behavioral Node tests read `public-paths.json` directly and assert
  all five response classes carry the full set; Python source-contract test
  mirrors the HSTS pattern (values declared once in the contract, derived in
  policy.js, never redeclared in edge sources).

## Verification

- `python3 -m unittest discover -s tests` → Ran 114 tests, OK.
- `node --test tests/test_worker_edge.test.mjs tests/test_middleware_deny.test.mjs`
  → 34 tests, 34 pass, 0 fail.
- Inline-scan of generated pages for `style=`/handlers/`<style`/`javascript:`:
  zero hits, so the deny-by-default CSP cannot break the rendered surface.
- Deploy path unaffected: `deploy_daily.sh` already ships
  `public-paths.json` + `functions/policy.js` + `worker.js` from the pristine
  snapshot; the fixture suite's stub policy.js does not import the contract.

## Outcome

PR opened against main. After merge + daily deploy, live responses will carry
the full header set; `scripts/verify_live.py` parity checks are content-based
and unaffected.
