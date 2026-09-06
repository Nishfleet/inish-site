# Lane 1 report: deliver the raster social card X can render (re-dispatch, 2026-08-15)

## Item

- [ ] deliver the raster social card X can render: PR #40 is stale and live still advertises the SVG-only card [scout 20]

## Verdict

**Already done — no code change needed.** This lane is a re-dispatch of
completed work. The raster card was implemented and merged as PR #63
(`4278ebe`, merged 2026-08-12), the same code that closed stale PR #40
(closed unmerged 2026-08-14). The live site already serves and advertises
the PNG. Nothing is left to change.

## How the item was closed

- PR #63 (`4278ebe`, merged 2026-08-12): added the committed 1200×630
  `og-image.png` (30,765 bytes, RGB), pointed the generated head's
  `og:image` and `twitter:image` at it with `og:image:type image/png`,
  and carried it through the build (`scripts/build_daily.py`), the edge
  public-path allowlist (`functions/policy.js`, `worker.js`), the deploy
  (`scripts/deploy_daily.sh`), and live parity (`scripts/verify_live.py`).
  The old `og-image.svg` stays reachable for compatibility.
- PR #40 (the branch this scout item cites) was a parallel attempt that
  was closed unmerged on 2026-08-14 after #63 landed — it is stale by
  design, not evidence of missing work.
- The merged head was delivered to live on 2026-08-12 (recorded in
  `MEMORY.md`; `verified_live_current commit=d5d2b22`).

## Re-verification performed this run (2026-08-15)

- Live `https://inish.in/` head advertises the raster card:
  `og:image` and `twitter:image` = `https://inish.in/og-image.png`,
  `og:image:type image/png`, `og:image:width 1200`, `og:image:height 630`.
  No `og-image.svg` reference anywhere in the live head.
- Live `https://inish.in/og-image.png` → HTTP 200, `image/png`; its bytes
  are sha256-identical to the committed `og-image.png`
  (`9487b3331c944bda42326b2cc42720bd1a7c36747d851f476182cc3efdae5786`).
- Live `https://inish.in/og-image.svg` → HTTP 200, `image/svg+xml`
  (legacy route still reachable for compatibility).
- `python3 -m unittest discover -s tests` → full suite OK, including
  `test_head_uses_raster_social_card` (head points at the PNG, never the
  SVG; committed card is a real 1200×630 PNG) and
  `test_head_carries_social_share_metadata`.
- `scripts/build_daily.py` still emits the PNG card in every generated
  head and `functions/policy.js`/`worker.js` still allow `/og-image.png`.

## Change

- `.lane/reports/lane1-raster-social-card-2026-08-15.md`: this report.
- `MEMORY.md`: records the close condition so the lane does not re-dispatch
  the item.

No product code, content, or production settings touched.

## What would re-open the item

A future build pointing the generated head back at `og-image.svg`, or the
live site serving an SVG at `/og-image.png` or advertising the SVG card —
both would fail the existing tests or the live-parity check. Per
`MEMORY.md`, do not re-dispatch unless that happens.
