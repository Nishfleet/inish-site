# Lane 1 report — enrich the Person schema with `knowsAbout`

Branch: `lane1/enrich-person-knows-about-2026-08-21`
Date: 2026-08-21

## Item

> enrich the Person schema with `knowsAbout` so AI answer engines can match Nish to topic queries, not just resolve

## Verdict

**Done — branch pushed, PR opened.** The head JSON-LD Person node now carries
`knowsAbout`, and the values are derived from the page's own `SECTIONS`
constant so the schema can never claim a topic the page does not show.

## What changed

`scripts/build_daily.py` — `json_ld()` renders `knowsAbout` on the Person
node. The values come from `sorted(SECTIONS - {"Wildcard"})`, i.e. exactly
the four topic labels the filter nav shows (`AI`, `Demand signals`,
`Product ideas`, `Tools`); the catch-all `Wildcard` bucket is not a topic
and stays out. The truth-rule docstring documents this pin.

`tests/test_build_daily.py` — the head contract now asserts
`person["knowsAbout"] == sorted(builder.SECTIONS - {"Wildcard"})`, so a
future drift between the page's section labels and the schema fails the
build instead of silently breaking the live entity record.

`index.html` — the committed surface was regenerated with
`python3 scripts/build_daily.py` (newest accepted edition 2026-08-20,
8 stories, 247 scanned) so
`test_committed_surface_matches_the_newest_accepted_edition` still passes
against the new renderer. The diff is limited to the `knowsAbout` values.

## Why the values are the nav labels, not expanded phrases

The first commit of this item shipped expanded labels ("Artificial
Intelligence", "Product Development", "Demand Signals", "Software Tools")
that appear nowhere on the page, while its own message and docstring
claimed they mirror the filter nav. That is a truth-rule violation by this
repo's own standard (and by the test's own comment): the nav literally
shows `AI`, `Demand signals`, `Product ideas`, `Tools` — the same values in
the builder's `SECTIONS` constant. The corrected commit derives the values
from `SECTIONS` so the schema and the page cannot drift.

## Verification

- `python3 -m unittest discover -s tests -v` — 112 tests, OK (the same
  suite CI runs via `.github/workflows/tests.yml`).
- Regenerated surface matches the builder's render exactly (the
  committed-surface test enforces this and passes).

## Files

- `scripts/build_daily.py`
- `tests/test_build_daily.py`
- `index.html`
- `.lane/reports/lane1/enrich-person-knows-about-2026-08-21.md`

## Completion marker

COMPLETE
