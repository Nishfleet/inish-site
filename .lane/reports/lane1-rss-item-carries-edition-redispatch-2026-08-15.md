# Lane 1 re-dispatch report: make each RSS item carry the edition it describes

## Item

- [ ] make each RSS item carry the edition it describes, so the feed stays true after the root page rolls over [scout 20

## Verdict

**Already done — no code change needed.** This dispatch is a duplicate of
PR #77 (`a4cbaff`, merged 2026-08-15 06:25:15 +0530), whose commit message is
verbatim this item. The worktree was checked out at `origin/main` tip, which
*is* that merge commit.

## Evidence (re-verified live at dispatch time)

- `git rev-parse origin/main HEAD` → both `a4cbaff15acd844b51b5a73707af4b00680c7846`;
  `git merge-base --is-ancestor HEAD origin/main` → HEAD is on origin/main.
- `git log --oneline` shows `a4cbaff feat: carry the full edition inside each RSS item (#77)`
  as the tip, with the fix chain `04c47b3` → `5dd8571` → `dc52ff9` behind it.
- `git show a4cbaff` confirms the delivered shape:
  - `scripts/build_daily.py` gains `rss_item_description(edition)` — editor's note
    plus every story (title linked to source, summary, Checked fact linked to
    evidence, take, caveat) rendered as one HTML string escaped once into the XML
    character data, so one story's ampersand or angle bracket cannot corrupt
    another's markup.
  - `feed.xml` regenerated so the accepted 2026-08-13 edition (4 stories) is
    carried inside the item.
  - `tests/test_build_daily.py` pins the round-trip shape and the
    special-characters well-formedness (XML parse + exact unescaped HTML).
  - `tests/test_verify_live.py` updates the RSS parity fixture to the new shape
    and rejects a live item that omits its stories.
- `python3 -m unittest discover -s tests` → **102 tests, OK**.
- Prior lane report `.lane/reports/lane1-rss-item-carries-edition-2026-08-15.md`
  already documents the same verdict with the same verification.

## What was done in this run

- No code changes (nothing to change; would be a duplicate PR).
- This report written to the lane-unique path as required by the packet.

## Recommendation

Do not re-dispatch this item unless a future accepted edition's RSS item stops
carrying its stories (the committed-surface and live-parity tests will red if
that happens).
