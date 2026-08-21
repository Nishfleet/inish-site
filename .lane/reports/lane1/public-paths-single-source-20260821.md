# Lane 1 evidence: public-path allowlist as one source of truth

Item: c4ca645289 — "make the public-path allowlist one source of truth so
path additions stop failing the branded-404 contract test"
Branch: `lane1/public-paths-single-source-20260821`
PR: #114 (base main @ 432a506)

## Diagnosis

public-paths.json has been the route contract since PR #59, but adding a
path still broke three tests that kept mirrored copies of the allowlist.
Reproduced on 432a506 by adding `/probe-asset.txt` + one contract line:

- `tests/test_middleware_deny.test.mjs` — `ALLOW_SAMPLES`, `REDIRECT_SAMPLES`,
  and two literal-array equality tests ("allowlist is exactly the published
  surface", redirect-map equivalent) duplicated the JSON.
- `tests/test_verify_live.py::write_fixtures` — hand-enumerated root files,
  so a new contract path had no fixture bytes; the mock server answered the
  branded 404 and two `LiveVerifierTests` parity runs failed.

Result on main: 114 Python tests → 2 failures, 37 Node tests → 1 failure.

## Fix

- `test_middleware_deny.test.mjs`: loads public-paths.json directly;
  ALLOW_SAMPLES / REDIRECT_SAMPLES / both equality assertions derive from it.
  Only DENY_SAMPLES stays handwritten — negative space must never enter the
  contract. Commit 430dcbe.
- `test_verify_live.py`: `write_fixtures` now derives every non-special
  fixture from the contract — real repo bytes when the file exists, minimal
  synthesized content by suffix otherwise. index.html, latest.json, feed.xml,
  404.html keep their dedicated payload builders (parity/branded-404 checks
  depend on them). Unused `SITEMAP` constant removed. Commit 49ca7cd.

A path addition is now: create the file + one line in public-paths.json.

## Verification

- Full suite green on this branch with no probe: 114 Python (unittest
  discover) OK + 37 Node (`node --test test_middleware_deny.test.mjs
  test_worker_edge.test.mjs`) pass/fail 0.
- End-to-end probe repeated on this branch: `probe-asset.txt` created +
  `/probe-asset.txt` appended to publicPaths → all 151 tests pass with no
  other edit; probe reverted afterwards.
- Same probe on main fails 3 tests (the regression this item names).

## Notes

- scripts/verify_live.py already reads the snapshot's public-paths.json; no
  production code needed changes — the drift lived only in the two test
  files' mirrored copies.
