# Lane 1 report: give the homepage Article JSON-LD the standard Schema.org fields

Branch: `lane1/article-schema-image-and-description-2026-08-21`
Date: 2026-08-21

## Item

Self-directed cycle: walk the live product for public-promise gaps and UX
breakage (tiers 1-2, no backlog item needed). Check open PRs first and never
restart what one already covers.

## What the live walk found

Walked `https://inish.in/` against the JSON-LD the head publishes. Three open
PRs (`lane1/person-sameas-tinystudio-2026-08-21`, `lane1/enrich-person-knows-about-2026-08-21`,
`lane1/sitemap-lastmod-freshness-2026-08-21`) already cover the Person
identity edges and the sitemap freshness stamp, so those are out of scope
here. The Article schema, however, was still bare:

```json
{
  "@type": "Article",
  "headline": "Nish's Daily Reads — 2026-08-20",
  "datePublished": "2026-08-20",
  "mainEntityOfPage": "https://inish.in/",
  "author": {"@type": "Person", "name": "Nish", "url": "https://inish.in/"}
}
```

Schema.org recommends `image`, `description`, and `dateModified` on Article
nodes. AI answer engines and search crawlers that read JSON-LD without
parsing the OG meta were getting a thinner view of the edition than the
human-visible page declares: the head already publishes
`og:image`, `og:description`, and the edition date, but the JSON-LD
Article node missed all three.

The gap was a public-promise mismatch, not a missing feature — the page
was promising OG meta and not promising the same thing in the structured
data.

## What changed

- `scripts/build_daily.py` — `json_ld()` now adds `image`,
  `description`, and `dateModified` to the Article node. The values
  mirror what the head already publishes, so the JSON-LD cannot drift
  from the OG meta:
  - `image`: `https://inish.in/og-image.png` (the committed 1200×630
    raster card, the same value `og:image` and `twitter:image` declare).
  - `description`: the same `"A daily read for a founder: AI news,
    product ideas, and early signals of demand — in plain words."`
    string that `og:description` and `meta[name="description"]`
    publish.
  - `dateModified`: the edition's own date, identical to
    `datePublished`, because the edition is published once.
  The docstring documents the OG-mirror contract: a JSON-LD field that
  disagreed with its OG meta counterpart would break truth-rule parity
  between the machine-readable surface and the human-visible page.
- `tests/test_build_daily.py` — the head contract pins the three new
  fields:
  - `article["image"]` equals `https://inish.in/og-image.png`.
  - `article["dateModified"]` equals `article["datePublished"]`.
  - `article["description"]` equals the same `rendered_description`
    string the OG meta assertions already use, so a future drift
    between OG description and JSON-LD description fails the build.
  - `test_head_carries_social_share_metadata` now asserts the
    `https://inish.in/og-image.png` count is **3** (og:image,
    twitter:image, Article JSON-LD image) — a JSON-LD image URL that
    diverged from the OG meta would either break this count or fail
    the field equality, both caught.
- `index.html` — regenerated from `python3 scripts/build_daily.py`
  against the newest accepted edition (2026-08-20, 8 stories, 247
  scanned) so the committed-surface test still passes. The diff is
  limited to the three Article fields.

No other files moved. The Article node still claims no `publisher`,
no `articleBody`, no `keywords` — only fields whose values are
derivable from what the page already shows.

## Verification

- `python3 -m unittest discover -s tests` → 112 tests OK
  (the suite CI runs via `.github/workflows/tests.yml`).
- `node --test tests/test_middleware_deny.test.mjs` → 17 tests OK.
- `node --test tests/test_worker_edge.test.mjs` → 11 tests OK.
- Live walk of `https://inish.in/` after the rebuild (preview):
  the JSON-LD now carries `image`, `description`, and `dateModified`
  on the Article node; `og-image.png` appears in three places; the
  edition date appears in both `datePublished` and `dateModified`.

## Why this is tier 1-2, not tier 4-7

The change closes a public-promise gap: the page declares itself an
Article and the head promises an OG card and description, but the
JSON-LD was silently offering less. That is the user-visible kind of
gap (machines answer differently) — the same ladder rung that open
PRs `lane1/enrich-person-knows-about-2026-08-21` and
`lane1/person-sameas-tinystudio-2026-08-21` are closing for the
Person node, but for the Article node.

## Branch / push

- Branch: `lane1/article-schema-image-and-description-2026-08-21`,
  cut from `origin/main` at `5b270e4`.
- Head commit: `46264ed` (single commit on top of origin/main).
- Push: `origin/lane1/article-schema-image-and-description-2026-08-21`
  published immediately after the local suite went green.

## Files touched

- `scripts/build_daily.py` — `json_ld()` Article node + docstring.
- `tests/test_build_daily.py` — three new Article field assertions,
  updated `og-image.png` count assertion.
- `index.html` — regenerated from build_daily against the 2026-08-20
  edition.

## Notes

- This run does not duplicate the three open SEO/identity PRs; the
  Article schema is a different node from Person and from the
  sitemap, and none of the open PRs touch it.
- `dateModified` equals `datePublished` because the edition is
  published once and never re-edited; a future "edit in place"
  workflow would need to update both. There is no such workflow today
  and the docstring flags it.
- `publisher` was deliberately omitted: the site is a personal feed,
  the Person node is the author, and a separate `publisher` block
  would either duplicate Person or claim a non-existent entity. The
  Schema.org recommendation is conditional on a separate publisher
  existing; it does not here.

## Completion marker

COMPLETE
