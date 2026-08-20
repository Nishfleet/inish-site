# Lane 1 report — inish-site (rerun of the public-path-allowlist source-of-truth item)

## Item
make the public-path allowlist one source of truth so path additions stop failing the branded-404 contract test

## Root cause (what was still wrong on the rerun)
After PR #59 (public-paths.json as the data source) and PR #72 (worker.js
importing the decide()/redirects decision from functions/policy.js), three
remaining values still sat as literals mirrored across both edge files:

1. `const hstsHeader = "max-age=31536000; includeSubDomains"` — duplicated
   in worker.js and functions/_middleware.js even though policy.js already
   re-exports the same string from public-paths.json. Changing the HSTS value
   required three edits.
2. `env.ASSETS.fetch("https://inish.in/404.html")` — duplicated in both
   edge files even though canonicalOrigin already lives in public-paths.json.
   A canonical-host change required two parallel edits.
3. A hand-maintained root-file cp list in scripts/deploy_daily.sh. Every
   path added to public-paths.json also had to be re-listed on the cp line,
   and forgetting it made _deployed_public_surface() drift from publicPaths
   so the branded-404 contract test (`test_unknown_paths_serve_branded_…`)
   went red until the human noticed and back-edited deploy_daily.sh.

## Change
- worker.js, functions/_middleware.js: import `hstsHeader` from
  functions/policy.js; remove the local const; use the imported binding in
  withSecurityHeaders. The deploy-internal header value is route data, not
  plumbing, and the single source is public-paths.json.
- functions/policy.js: add `notFoundAssetUrl`, derived from canonicalOrigin
  plus the literal `/404.html`. Both edge files import it and pass it to
  `env.ASSETS.fetch(notFoundAssetUrl)`. The previous `https://inish.in/404.html`
  literal is gone from the edge sources entirely.
- functions/_middleware.js: same HSTS + 404-URL imports as the worker.
- scripts/deploy_daily.sh: the root payload is now derived from
  public-paths.json via a jq loop over publicPaths (`/` maps to
  `index.html`, sub-directory paths like `/fonts/OFL.txt` still ship
  inside the `fonts/` directory copy, edge-internals 404.html and
  _redirects ride alongside). The hand-maintained cp line is gone.
- tests/test_middleware.py: `test_unknown_paths_serve_branded_status_preserving_404`
  now asserts the import relationship on both edge files (`hstsHeader`,
  `notFoundAssetUrl` named-imports, `env.ASSETS.fetch(notFoundAssetUrl)`)
  and forbids the inlined literals (`const hstsHeader =`,
  `max-age=31536000; includeSubDomains`, `https://inish.in/404.html`).
  `_payload_root_files()` reads public-paths.json directly and refuses to
  parse a manual cp line, so the contract test catches drift into the
  deploy script as a missing jq invocation.
- tests/test_deploy_daily.py: `payload_root_files()` mirrors the same
  derivation and forbids the manual list at the source. The
  `test_worker_and_pages_middleware_share_the_route_contract` and
  `test_payload_comes_from_an_origin_main_snapshot_not_the_workdir`
  checks update to assert the contract is read at deploy time.
- tests/test_verify_live.py: `test_hsts_value_is_explicit_without_preload`
  pins the HSTS source-of-truth relationship on both edges and on
  policy.js, so a regression that puts a const back in an edge file fails
  this suite instead of silently drifting.

## Mutation experiment (run locally, reverted before commit)
1. **Path added without updating the deploy copy line** (single-point
   addition to public-paths.json only):
   - Before this change: `test_allowlist_is_exactly_the_deployed_surface`
     and `test_unknown_paths_serve_branded_status_preserving_404` fail on
     the allowlist-vs-deployed-surface mismatch.
   - After this change: full suite green — the deploy derives the
     payload from the contract, so the surface automatically includes
     the new path. A separate /tmp mutation test added `/manifest.json`
     to public-paths.json's publicPaths and confirmed the deploy loop
     copied `manifest.json` into the payload with zero edits to
     deploy_daily.sh.

2. **HSTS literal reintroduced in worker.js** (`const hstsHeader =
   "max-age=31536000; includeSubDomains";`):
   - `test_unknown_paths_serve_branded_status_preserving_404` goes red on
     the explicit `assertNotIn("const hstsHeader =", worker_text)` guard.

3. **404 URL literal reintroduced** (`env.ASSETS.fetch("https://inish.in/404.html")`):
   - Same test goes red on the `assertNotIn('https://inish.in/404.html',
     worker_text)` guard and on the `assertIn('env.ASSETS.fetch(notFoundAssetUrl)', ...)` check.

## Evidence
- Full suite before this branch: 112 Python OK, 28 Node pass.
- Full suite after this branch: 112 Python OK, 28 Node pass (measured at
  every commit boundary, three commits).
- Bash simulation of deploy_daily.sh's new payload build: 12 root files
  copied from public-paths.json + 2 edge-internals, exact set matches
  test_middleware.py's `_deployed_public_surface()`.
- Mutation test run via `bash` against a /tmp fixture: added
  `/manifest.json` to public-paths.json's publicPaths, ran the new
  jq loop, payload contains `manifest.json` with no edit to
  deploy_daily.sh.

## Files touched
- worker.js — import hstsHeader and notFoundAssetUrl from
  functions/policy.js; remove the two route-data literals.
- functions/_middleware.js — same import + literal removal as worker.js.
- functions/policy.js — export `notFoundAssetUrl` derived from
  canonicalOrigin; document the route-data contract.
- scripts/deploy_daily.sh — replace the hand-maintained cp list with a
  `mapfile` + jq loop reading public-paths.json's publicPaths.
- tests/test_middleware.py — branded-404 contract now pins the imports,
  not the literals; `_payload_root_files()` reads public-paths.json
  directly and forbids a manual cp line.
- tests/test_deploy_daily.py — same parser derivation; pin against the
  manual-list regression; verify the deploy reads the contract.
- tests/test_verify_live.py — pin the HSTS source-of-truth across
  policy.js, _middleware.js and worker.js.

## Notes
- This branch is a follow-up to PR #72 (worker.js importing from
  policy.js) — the rerun of the same item that survived a regression in
  the route-data plumbing. The piece truly missing was the HSTS literal
  and the 404-URL literal in the edge sources, plus the hand-maintained
  deploy copy list.
- `.lane/reports/lane1-public-path-single-source.md` (the original
  run from PR #72) and this report sit alongside; the new report owns
  the rerun so the prior one stays accurate to what PR #72 actually
  shipped.
- Branch: `lane1/public-path-single-source-hsts-2026-08-20`,
  three commits on origin/main, full suite green at HEAD
  `47659c7`. PR will be opened next.
