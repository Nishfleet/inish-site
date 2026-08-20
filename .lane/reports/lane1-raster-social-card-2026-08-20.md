# Lane 1 report: deliver the raster social card X can render (re-dispatch, 2026-08-20)

## Item

- [ ] deliver the raster social card X can render: PR #40 is stale and live still advertises the SVG-only card [scout 20]

## Verdict

**Already done — no code change needed.** This is a re-dispatch of completed
work (same verdict as the 2026-08-15 lane on this item). The raster card was
implemented and merged as PR #63 (`4278ebe`, merged 2026-08-12), which closed
stale PR #40 (closed unmerged 2026-08-14). The live site serves and advertises
the PNG. Nothing is left to change.

## Fresh re-verification performed this run (2026-08-20)

- Repo: worktree is on origin/main HEAD `5b270e4` (clean tree); the raster
  work and its pinned tests are all on main.
- Live `https://inish.in/` head advertises the raster card:
  `og:image` and `twitter:image` = `https://inish.in/og-image.png`,
  `og:image:type image/png`, `og:image:width 1200`, `og:image:height 630`.
  No `svg` reference anywhere in the live page.
- Live `https://inish.in/og-image.png` → HTTP 200, `image/png`; bytes are
  sha256-identical to the committed `og-image.png`
  (`9487b3331c944bda42326b2cc42720bd1a7c36747d851f476182cc3efdae5786`).
- Live `https://inish.in/og-image.svg` → HTTP 200, `image/svg+xml` (legacy
  route still reachable for compatibility; not advertised).
- `python3 -m unittest tests.test_build_daily.BuildDailyTests.test_head_uses_raster_social_card tests.test_build_daily.BuildDailyTests.test_head_carries_social_share_metadata -v`
  → both pass on the current tree (head points at the PNG, never the SVG;
  committed card is a real 1200×630 PNG).
- `bash scripts/check_live_current.sh` → `verified_live_current commit=5b270e4…`
  (live matches origin/main HEAD byte-for-byte).
- `python3 scripts/verify_live.py --base https://inish.in --root . --edition-date 2026-08-20 --commit 5b270e4…`
  → `verified_feed_only date=2026-08-20 commit=5b270e4…`; the full byte-parity
  check covers `/og-image.png` as a public path, so the live card is
  byte-identical to the committed snapshot.

## Change

- `.lane/reports/lane1-raster-social-card-2026-08-20.md`: this report.

No product code, content, or production settings touched.

## What would re-open the item

A future build pointing the generated head back at `og-image.svg`, or the live
site serving an SVG at `/og-image.png` or advertising the SVG card — both
would fail the existing tests or the live-parity check. Per `MEMORY.md`,
do not re-dispatch unless that happens.
