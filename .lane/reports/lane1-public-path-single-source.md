# Lane 1 report — inish-site

## Item
make the public-path allowlist one source of truth so path additions stop failing the branded-404 contract test

## Root cause
worker.js (the live edge, deployed via Workers + assets) carried an inline copy of the publicPaths allowlist, the font pattern, and the redirects, while functions/policy.js was canonical only for the Pages middleware. Adding a path in policy.js but not worker.js made the live worker deny the new public path — serving the branded 404 for it — which the deploy-time verifier (verify_live.py) and the branded-404 contract tests then flagged.

## Change
- worker.js: import { decide, redirects } from "./functions/policy.js"; delete the inline publicPaths/fontPath/redirects literals; delegate the route decision to decide(url.pathname). Response plumbing (HSTS, notFoundResponse, ASSETS) stays inline.
- scripts/deploy_daily.sh: ship functions/policy.js beside worker.js in the deploy root (the worker imports it at runtime).
- tests/test_middleware.py: assert the worker imports from ./functions/policy.js and never re-declares const publicPaths/redirects/fontPath.
- tests/test_deploy_daily.py: same import assertions; fixture payload gains functions/policy.js.
- tests/test_worker_edge.test.mjs: comment updates only — the behavioral suite already drives the worker's default export and passes unchanged.

## Evidence
- Full suite before change: 99 Python OK, 16 Node pass.
- Full suite after change: 99 Python OK, 16 Node pass.
- Mutation simulation (path added to policy.js only, worker.js untouched):
  - With worker inlining (pre-change state): branded-404 contract suite fails on the allowlist literal mismatch.
  - After change: worker behavioral suite and branded-404 behavior tests pass; only the exact-surface guard literal in tests/test_middleware.py needs the path added (intended — it is the known-surface pin).
  - policy.js + guard literal updated (worker/middleware/verifier untouched): full suite OK.

## Files touched
- worker.js — import the route contract from functions/policy.js instead of inlining it
- scripts/deploy_daily.sh — copy functions/policy.js into the deploy payload
- tests/test_middleware.py — pin the worker import; keep exact-surface guard
- tests/test_deploy_daily.py — pin the worker import and fixture policy module
- tests/test_worker_edge.test.mjs — comments only

## Notes
Two prior unmerged attempts at this exact item exist on origin (improvement/public-path-single-source with route-contract.js, fix/route-contract-single-source with public-paths.json); both predate the behavioral-test refactors (#69, #71) and were not merged. This change implements the item fresh on current main with the smallest coherent diff: policy.js is already the canonical module, so worker.js now consumes it directly (no new file, no JSON import).
