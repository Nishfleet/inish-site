# Lane report — add X/Twitter profile to Person sameAs

Branch: `lane1/add-x-twitter-sameas-2026-08-21` · PR: https://github.com/nish3451/inish-site/pull/108 · Date: 2026-08-21

## Item

Add Nish's X/Twitter profile (`@NishantRArora`) to the Person `sameAs` list so AI engines can cross-reference the identity.

## Change

The Person node in the JSON-LD structured data now lists two verified surfaces instead of one:

- `scripts/build_daily.py` — `json_ld()` Person node: `"sameAs": ["https://github.com/nish3451", "https://x.com/NishantRArora"]` (source of truth; docstring updated to "two surfaces verified").
- `tests/test_build_daily.py` — pinned assertion updated to expect both URLs.
- `index.html` — regenerated from the builder via `python3 scripts/build_daily.py`; diff is exactly the `sameAs` addition.

## Verification

- Profile verified live: `https://x.com/NishantRArora` returns 200; belongs to Nish (New Delhi, India; also references inish.in).
- `python3 -m unittest discover -s tests -v`: 112 tests OK.
- `node --test "tests/**/*.test.mjs"`: 28 tests OK.
- Build deterministic: only `index.html` changed among generated artifacts; latest.json/feed.xml/sitemap.xml untouched.

## Out of scope

- The GitHub profile website field item (MEMORY.md line 16) remains untouched — this change only edits the site's own structured data.
