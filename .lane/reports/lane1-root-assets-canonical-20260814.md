# Lane 1 report — inish-site

## Item
stop the daily builder from overwriting canonical root assets with stale `daily/` copies

## Root cause
`scripts/build_daily.py` `copy_assets()` copied `daily/{app.js,styles.css,og-image.svg}` over the
committed root files on every build. Any merged root fix not also hand-synced into `daily/` was
silently reverted by the next daily publish. This drift class already bit three times (#27,
#33/#45, #41), each fixed by manually re-syncing the mirror; it recurred again after #44 (branded
404 CSS) — `daily/styles.css` is missing the entire 404-page block the canonical root has.

## Change
- `scripts/build_daily.py`: delete `LEGACY_DAILY`/`copy_assets()`; replace with `check_root_assets()`
  which only fails loudly when a referenced root asset is missing and never copies over the root.
  Keeps the `og-image.png` presence check (raster card is root-pinned, no mirror source).
- `daily/app.js`, `daily/og-image.svg`, `daily/styles.css`: deleted. The mirror is never deployed
  (deploy_daily.sh ships root files only) and its URL paths are literal redirect strings in
  worker.js/functions/policy.js and _redirects, so nothing reads the directory.
- `tests/test_build_daily.py`: fixtures now place the canonical assets at the public root;
  added `test_keeps_committed_root_assets_untouched` (regression for the drift class) and
  `test_build_fails_loudly_when_a_root_asset_is_missing`.

## Prior attempts
PR #60 (open, DIRTY/conflicting against current main) and PR #52 (closed unmerged) carried this
exact fix from commit 90c8f42. This lane rebased that fix onto current origin/main, resolved the
conflicts (raster-card #63, parity #66), and opens a fresh, mergeable PR.

## Evidence
- Full suite before change: 101 Python OK, 16 Node pass.
- Full suite after change: 101 Python OK, 16 Node pass.
- Real builder run against the committed repo: `built latest=2026-08-13 stories=4 scanned=247`,
  exit 0, working tree clean afterward (root assets untouched).

## Files touched
- scripts/build_daily.py — canonical root assets: check presence, never copy over
- daily/app.js — deleted stale mirror
- daily/og-image.svg — deleted stale mirror
- daily/styles.css — deleted stale mirror
- tests/test_build_daily.py — root-canonical fixtures + regression tests
