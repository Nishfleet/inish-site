# Lane report — rel="me" on GitHub, X, and Tiny Studio footer links

Branch: `lane1/rel-me-identity-links` · Date: 2026-08-23 · Item: `1c169817c4`

## Item

Add `rel="me"` to outbound identity links (GitHub, X, Tiny Studio) so profile-to-site identity verification works.

## Change

The footer `.identity` paragraph now has three visible anchors, each with `rel="me noopener noreferrer"`:

- GitHub ↗ → `https://github.com/nish3451`
- X ↗ → `https://x.com/NishantRArora`
- Tiny Studio ↗ → `https://tinystudio.in/`

Files:

- `scripts/build_daily.py` — footer template in `page()`.
- `tests/test_build_daily.py` — `test_footer_links_the_owned_studio` pin (method name kept).
- `index.html` — regenerated with `python3 scripts/build_daily.py`. Diff is only the `.identity` paragraph.

JSON-LD `sameAs` at `scripts/build_daily.py:408-412` was left alone. `styles.css`, `app.js`, and edition data were not touched.

## Verification

Pinned test:

```
test_footer_links_the_owned_studio (tests.test_build_daily.BuildDailyTests.test_footer_links_the_owned_studio) ... ok
Ran 1 test in 0.004s
OK
```

Full suite:

```
Ran 120 tests in 1.945s
OK
```

Rebuild after tests: `built latest=2026-08-22 stories=6 scanned=247`. `git status` stayed clean. `latest.json`, `feed.xml`, and `sitemap.xml` did not change.

Committed `index.html` contains exactly these three anchors:

```
<a href="https://github.com/nish3451" rel="me noopener noreferrer">GitHub ↗</a>
<a href="https://x.com/NishantRArora" rel="me noopener noreferrer">X ↗</a>
<a href="https://tinystudio.in/" rel="me noopener noreferrer">Tiny Studio ↗</a>
```

`grep -E '<a href="https://(github\.com/nish3451|x\.com/NishantRArora|tinystudio\.in/)" rel="me ' index.html` matches the identity paragraph (all three anchors live on one line, so grep prints that line once).

## Out of scope

Reciprocal links on the GitHub and X profiles still need a manual write. The GitHub website field cannot be set by this repo's token (MEMORY.md). This PR only guarantees the markup on inish.in.
