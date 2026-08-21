# Lane 1 report — inish-site (root-asset drift guards, 2026-08-20)

## Item
stop the daily builder from overwriting canonical root assets with stale `daily/` copies

## Outcome
Shipped a PR. The item was **not** fully done: the production fix (PR #73) is
live and correct, but the regression tests holding it in place covered only
part of the canonical asset list, so most of the invariant was unenforced.
Two of the five root assets could be silently overwritten by a stale mirror
with the entire CI gate green.

## What was already correct (re-verified live this run)

- Worktree branched from fresh `origin/main` `d3b5082`; PR #73 is an ancestor.
- `scripts/build_daily.py`: `DAILY = ROOT`, no `copy_assets`, no `LEGACY_DAILY`.
  `check_root_assets()` is presence-only and never writes over the root.
- The `daily/` mirror directory is absent from the working tree and `git ls-files`.
- `scripts/deploy_daily.sh` builds its payload only from a pristine
  `git archive` of `origin/main` — never from a mirror or the workdir.
- Remaining `daily/` strings are URL redirects (`_redirects`, `public-paths.json`,
  `worker.js`), which are intended behaviour per MEMORY.md.
- Real build on the committed tree: `built latest=2026-08-20 stories=8 scanned=247`,
  and all five `ASSETS` byte-identical before/after (sha256 diff empty).

## The gap this PR closes (proven by mutation, not by reading)

The CI gate is exactly the two commands in `.github/workflows/tests.yml`.
Baseline on `d3b5082`: **112 Python + 28 Node, all green.**

| Mutation applied to `scripts/build_daily.py` | Before | After |
|---|---|---|
| A — build overwrites `og-image.png` + `apple-touch-icon.png` with valid-but-stale PNGs | **GREEN (112 OK)** — hole | FAILED (2), naming `asset='og-image.png'`, `asset='apple-touch-icon.png'` |
| B — presence gate narrowed to `ASSETS[:2]`, silently dropping `og-image.svg` + both PNGs | **GREEN (112 OK)** — hole | FAILED (3), naming each dropped asset |
| C — `ASSETS = ()`, making both guards vacuous | n/a (guards were hand-spelled) | FAILED (1) `test_canonical_root_asset_list_is_pinned` |

Mutation A is the exact drift class the item exists to stop. A stale mirror
copies *real* files, not corrupt ones, so the head's PNG-magic-bytes assertion
in `test_head_carries_apple_touch_icon` does not catch it — that test only
fires on a non-PNG. Mutation B means a missing share card or touch icon would
have shipped live instead of failing the build loudly.

## Change

`tests/test_build_daily.py` only — no production behaviour change.

- `test_keeps_committed_root_assets_untouched` — was hand-spelled for `app.js`,
  `styles.css`, `og-image.svg`; now snapshots and byte-compares **every** name
  in `builder.ASSETS` with a `subTest` per asset.
- `test_build_fails_loudly_when_a_root_asset_is_missing` — deleted only
  `styles.css`; now asserts the loud failure for **every** asset, restoring
  each one in a `finally` so the subtests stay independent.
- `test_canonical_root_asset_list_is_pinned` — new. Both guards iterate
  `builder.ASSETS`, so a trimmed or emptied tuple would make them pass
  vacuously; this pins the canonical set.
- Added `import re` for `re.escape` on the asset name in the raises-regex.

Coverage is now complete by construction: any asset added to `ASSETS` is
guarded automatically, with no second place to remember to update.

## Verification

- Full Python suite on the branch: `Ran 113 tests — OK` (112 + the pinned-list test).
- Node suite: `node --test "tests/**/*.test.mjs"` → 28 pass, 0 fail.
- Real builder run: assets byte-identical; no tracked file left modified.
- All three mutations fail on the branch and are individually named.

## Files touched
- `tests/test_build_daily.py` — complete the two root-asset guards; pin `ASSETS`.
- `.lane/reports/lane1-root-asset-guards-20260820-165536.md` — this report.
- `/home/nish/workspaces/agent-state/lanes/inish-site/lane-1.json` — `claims` only,
  written atomically (temp + rename); no other field touched.
