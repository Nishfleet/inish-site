# Lane 1 re-dispatch report: make each RSS item carry the edition it describes

## Item

- [ ] make each RSS item carry the edition it describes, so the feed stays true after the root page rolls over [scout 20

## Verdict

**Already done — no code change needed.** This dispatch is a duplicate of
PR #77 (`a4cbaff`, merged 2026-08-15), which is an ancestor of the current
`origin/main` tip. The worktree was checked out at `origin/main` HEAD
(`d3b5082`), which already contains the fix and the subsequent daily
publishes that exercise it.

## Evidence (re-verified at dispatch time, 2026-08-20)

- `git fetch origin main` → `FETCH_HEAD = d3b50821ee9adaa95b3d2e30127511912750ebb1`.
- `git rev-parse HEAD origin/main` → both `d3b50821ee9adaa95b3d2e30127511912750ebb1`.
- `git merge-base --is-ancestor a4cbaff origin/main` → true.
- `git merge-base --is-ancestor HEAD origin/main` → true (worktree is on origin/main).
- `git log --oneline origin/main | grep -i rss` shows the fix chain on `main`:
  - `a4cbaff feat: carry the full edition inside each RSS item (#77)` — the change.
  - `ac513bd docs: record the RSS-carry-edition item as already done (re-verified 2026-08-15) (#78)` — the follow-up doc note.
  - `5dd8571 fix: keep RSS live parity with the story-carrying item description` — live parity wiring.
  - `dc52ff9 feat: carry every story in the RSS item description` — the prep commit.
- `git show a4cbaff -- scripts/build_daily.py` confirms the delivered shape:
  new `rss_item_description(edition)` that builds the editor's note plus every
  story (title linked to source, summary, Checked fact linked to evidence,
  take, caveat) rendered as one HTML string escaped once into the XML
  character data, so one story's ampersand or angle bracket cannot corrupt
  another's markup and the feed stays well-formed. `rss()` now uses it.
- `python3 -m unittest discover -s tests` → **112 tests, OK** (was 102 before
  this dispatch per the prior report; the +10 came from later unrelated lanes,
  all green).
- `python3 -m py_compile scripts/build_daily.py scripts/verify_live.py` → OK.
- `git show a4cbaff -- tests/test_build_daily.py` confirms the two pinning
  tests landed: `test_rss_item_carries_every_story_of_its_edition` (round-trips
  to exactly the intended markup) and
  `test_rss_item_description_is_well_formed_when_copy_has_special_characters`
  (XML parses + unescapes to the intended HTML).

## Re-verification on this dispatch (2026-08-20T22:50Z)

A second worker received the same packet and re-ran every proof command.
Live state is unchanged from the evidence above:

- `git rev-parse HEAD origin/main` → both `d3b50821ee9adaa95b3d2e30127511912750ebb1`.
- `git merge-base --is-ancestor a4cbaff HEAD` → exit 0 (PR #77 is an ancestor).
- `python3 -m unittest discover -s tests` → Ran 112 tests in 0.751s, OK.
- `python3 -m py_compile scripts/build_daily.py scripts/verify_live.py` → OK.
- `feed.xml` parses as XML; 1 item, title `Nish's Daily Reads — 2026-08-20`,
  GUID `inish-daily-2026-08-20`, pubDate `Thu, 20 Aug 2026 00:00:00 +0000`,
  description 11496 chars carrying 8 `<h3>`-bounded stories plus the editor's
  note. The description still names the 2026-08-20 edition after the root
  page rolls over — exactly the property the item was supposed to gain.

No edits performed; `lane-1.json` `claims` left empty (nothing to claim).

## Re-verification on this dispatch (2026-08-20T23:05Z, third worker)

Branched from `origin/main` after a fresh `git fetch`: `origin/main` advanced
from `d3b5082` to `b75fcb2` (PR #89, public-paths/HSTS single-source — unrelated
to this packet). HEAD on the new branch
`lane1/rss-item-carries-edition-redispatch-2026-08-20` is `b75fcb2`, which
still has PR #77 (`a4cbaff`) as an ancestor:

- `git rev-parse HEAD` → `b75fcb2a04fddddca7f6d89f6af992e1d51e55e3`.
- `git merge-base --is-ancestor a4cbaff HEAD` → exit 0.
- `python3 -m unittest discover -s tests` → Ran 112 tests in 0.846s, OK.
- `python3 -m py_compile scripts/build_daily.py scripts/verify_live.py` → OK.
- `bd.rss(edition)` against `latest.json` (date 2026-08-20, 8 stories) → 13164
  bytes; 1 `<item>`, title `Nish's Daily Reads — 2026-08-20`, GUID
  `inish-daily-2026-08-20`, pubDate `Thu, 20 Aug 2026 00:00:00 +0000`,
  description 12703 chars carrying 8 `<h3>`-bounded stories plus the editor's
  note. The dated edition is still fully embedded in the description — same
  property the item was supposed to gain.

Edited files (committed on this branch):
- `MEMORY.md` — added the "re-verified 2026-08-20" entry next to the
  existing "re-verified 2026-08-15" record, following the same docs-commit
  pattern as PR #78.

## Live feed (the actual deployed `feed.xml` on `origin/main`)

Inspected the committed `feed.xml` at the current `HEAD`:

- `item count: 1`
- `title: Nish's Daily Reads — 2026-08-20` (date in title — was already there)
- `link: https://inish.in/` (rolling root — unchanged by design, no archive pages)
- `guid: inish-daily-2026-08-20` (date-locked GUID — was already there)
- `stories in description: 8` (every story of the accepted edition is now embedded)
- `description length: 11496 chars` (carries the editor's note + every story)

A subscribed reader that opens tomorrow's feed (after the 2026-08-21 publish
overwrites the root page) still sees the 2026-08-20 edition rendered in full
inside that item's description — title, link, GUID, pubDate, and body all
named after the 2026-08-20 edition, with no claim that the body matches the
live root page.

## What was done in this run

- No code changes (nothing to change; would be a duplicate PR against
  origin/main, which already carries the fix and the green tests).
- This report written to the lane-unique path as required by the packet.

## What was done in the re-dispatch run

- No edits. Re-ran every proof command; all green. Refreshed this file with
  the second-pass verifications so a future lane controller reads a single
  up-to-date record of the live state and the historical run.

## Recommendation

Do not re-dispatch this item unless a future accepted edition's RSS item
stops carrying its stories (the
`test_rss_item_carries_every_story_of_its_edition` and
`test_committed_surface_matches_the_newest_accepted_edition` tests will red
if that happens).
