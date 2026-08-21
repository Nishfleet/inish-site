# Lane 1 report: @id-based entity linking for the Article author (2026-08-21)

## Item

- [x] add `@id`-based entity linking to the JSON-LD graph so the Article author references the canonical Person node

## Change

Branch `lane1/jsonld-author-id-2026-08-21` (cut from `origin/main` at `af8b3ca`):

- `scripts/build_daily.py` — the `Person` node in `json_ld()` now carries
  `"@id": "https://inish.in/#nish"`, and the `Article` node's `author` is a
  pure node reference (`{"@id": "https://inish.in/#nish"}`) instead of an
  inline `{@type, name, url}` duplicate. One `Person` entity per graph;
  the comment above `author` documents the linking contract.
- `tests/test_build_daily.py` — pins `person["@id"]` and asserts
  `article["author"] == {"@id": person["@id"]}`, so a regression back to
  the inline duplicate fails the suite.
- `index.html` — regenerated via `scripts/build_daily.py` from the current
  committed edition (2026-08-21, 7 stories). The only diff is the JSON-LD
  block above; no drift in `latest.json`, `feed.xml`, or `sitemap.xml`.

## Why this shape

- The fragment `#nish` distinguishes the person entity from the site URL
  (`https://inish.in/`, already the WebSite/Person `url`), so the node
  reference resolves unambiguously inside the same `@graph`.
- Total truth claims unchanged: no new entity, field, or assertion was
  introduced — the duplicate author object simply became a reference to
  the node that already existed.

## Verification

- `python3 -m unittest discover -s tests` → 112 tests OK.
- `node --test tests/test_middleware_deny.test.mjs tests/test_worker_edge.test.mjs`
  → 28 tests OK.
- `git diff index.html` on the regenerated file shows exactly the JSON-LD
  change (one `@id` added, author collapsed to the reference).

## Completion marker

COMPLETE