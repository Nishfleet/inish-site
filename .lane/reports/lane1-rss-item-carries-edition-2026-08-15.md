# Lane 1 report: make each RSS item carry the edition it describes

## Item

- [ ] make each RSS item carry the edition it describes, so the feed stays true after the root page rolls over [scout 20

## Verdict

**Done.** Each RSS item's `<description>` now carries the full edition it
describes — the editor's note and every story (title with its source link,
summary, Checked fact linked to its evidence, take, and caveat) — rendered as
HTML escaped into the XML character data. After the root page rolls over to a
newer day, a subscriber's reader still shows the exact edition the item is
about.

## Why this change

Before this change the RSS item description held only the editor's note, and
the item's `<link>` points at the root page (`https://inish.in/`), which the
next daily build overwrites. The item title and guid already carried the
edition date, but the body carried none of the edition's stories, so a
subscriber could not tell what the item actually described once the link
target rolled over. The description now embeds the whole edition.

## What changed

- `scripts/build_daily.py`: new `rss_item_description(edition)` builds the
  editor's note plus every story as one HTML string and escapes it once into
  the XML character data (so one story's ampersand or angle bracket cannot
  corrupt another's markup, and the feed stays well-formed). `rss()` uses it.
- `feed.xml`: regenerated for the accepted 2026-08-13 edition (4 stories now
  carried in the item).
- `tests/test_build_daily.py`: two new tests — `test_rss_item_carries_every_story_of_its_edition`
  (description round-trips to exactly the intended markup) and
  `test_rss_item_description_is_well_formed_when_copy_has_special_characters`
  (escaped character data parses as XML and unescapes to the intended HTML).
- `tests/test_verify_live.py`: the RSS parity fixture now uses the new
  description shape, plus `test_rss_parity_rejects_an_item_that_omits_its_stories`
  so a live feed missing the stories fails parity.

## Verification

- `python3 -m unittest discover -s tests` → **102 tests, OK** (was 99; +3 new).
- `python3 -m py_compile scripts/build_daily.py scripts/verify_live.py` → OK.
- `python3 scripts/build_daily.py` → `built latest=2026-08-13 stories=4 scanned=247`.
- Committed-surface test (`test_committed_surface_matches_the_newest_accepted_edition`)
  passes: the committed feed.xml is exactly what the builder renders.

## Out of scope (pre-existing, unrelated)

While rebuilding I noticed `copy_assets()` in `build_daily.py` copies
`daily/styles.css` over the root `styles.css`, which has clobbered the branded
404 styles (`.error-code`, `.error-main`, `.back-link`, added in PR #44)
since PR #41 — root `styles.css` on `origin/main` no longer contains them.
This predates this change and is a separate bug; it is reported here rather
than fixed in this lane.
