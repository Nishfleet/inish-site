# Lane 1 report — publish llms.txt (2026-08-21)

## Item

- [x] publish an `llms.txt` file so AI answer engines and MCP servers can ingest the site's canonical summary in one fetch

## What shipped

Branch `lane1/llms-txt-2026-08-21` → PR https://github.com/nish3451/inish-site/pull/107 (open).

- `llms.txt` (new, committed at repo root): canonical summary in llms.txt format — what the site is, how to read the daily feed (rolls daily, no archives, fact/take/caveat per story, Checked facts linked to evidence), machine-readable endpoints (/latest.json, /feed.xml, /sitemap.xml, robots.txt `ai-train=no`), and essential links.
- `public-paths.json`: `/llms.txt` added to `publicPaths` — the single source of truth for the public surface. The deploy payload copy loop, the edge worker allowlist, and the live verifier all derive from it, so no other edge/deploy file needed an edit.
- `scripts/verify_live.py`: `/llms.txt` moved from the denied-routes list (it previously asserted a 404) to the byte-checked public-path set (GET exact-body + HEAD empty-200), like robots.txt/sitemap.xml.
- Tests updated to the new surface: `tests/test_middleware_deny.test.mjs` (exact allowlist pin + ALLOW_SAMPLES), `tests/test_worker_edge.test.mjs` (ALLOW_SAMPLES), `tests/test_verify_live.py` (fixture root now carries llms.txt).

## Verification

- `python3 -m unittest discover -s tests`: 112 tests, OK.
- `node --test "tests/**/*.test.mjs"`: 28 tests, OK.
- The file reaches live with the next daily deploy: `scripts/deploy_daily.sh` ships every allowlisted root file from a pristine origin/main snapshot (the PR itself does not deploy — that is the daily publisher's operational act, per project memory).

## Notes

- `scripts/build_daily.py` needed no change: llms.txt is a committed root asset, not generated (the build's ASSETS tuple is the head-referenced set only; the deploy payload comes from public-paths.json).
- robots.txt already allows AI input (`ai-input=yes`) and opts out of training (`ai-train=no`); the new file is consistent with that.
