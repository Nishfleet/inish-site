# CANDIDATES — 2026-08-21 — inish-site

> **Input note (audit reconstruction).** The deterministic candidates file the
> fleet scout wrote for this run (`/home/nish/fleet2/var/scout/CANDIDATES-2026-08-21-inish-site.md`)
> carries only the workspace stamp (HEAD `5ee0da5`, repo `nishfleet/inish-site`) and
> **no open TODOs/FIXMEs** — the deterministic grep captured nothing, so there is no
> code-derived candidate corpus to audit. Following the 2026-08-20 precedent, this file
> reconstructs the candidate set directly from the product workspace at HEAD `5ee0da5`
> (verified current at `origin/main` `af8b3ca`), with every item carrying a cited
> evidence source (file path + line number, commit, or PR). The audit
> (`AUDIT-2026-08-21-inish-site.md`) ranks this set.

## Product context (revenue framing)

- inish.in is Nish Daily: a daily AI / product-idea / demand-signal feed for founders.
  It is an audience/content product with **no paywall, sponsorship, or email surface
  today**. Revenue impact is therefore scored by how much an item grows or protects
  readership, distribution, engagement, and owned-audience value.
- Key change vs. the 2026-08-20 scout: **the feed is publishing daily again.** Latest
  edition on `origin/main` is `2026-08-21` (the 7-day gap that ranked #1 yesterday is
  resolved; latest.json date=2026-08-21). The top candidates now shift from "restore
  publication" to "grow distribution of a product that is finally live."
- Distribution surfaces today: root page, RSS (`/feed.xml`), JSON (`/latest.json`),
  sitemap, static OG card. No email, no social share buttons, no per-story links.

## Candidates (reconstructed, cited)

### C1 — No per-story share buttons (social distribution)
Each story renders only a `Read at <domain> ↗` source link. A reader who wants to post
a story to X/LinkedIn or copy its link has no in-page affordance. Social sharing is the
primary organic growth vector for a daily feed.
Evidence: `scripts/build_daily.py:324-338` (story_card emits only a source-link),
`index.html:72-122` (rendered story bodies, no share UI), `app.js` (37 lines, filter
logic only), `styles.css` (no share styles).

### C2 — `rss-single-item-no-recent-history`
`rss()` emits exactly one `<item>` (the latest edition). RSS subscribers see a one-item
feed; search engines get no re-discovery. The repo holds 12 editions but RSS shows 1.
- Evidence: `scripts/build_daily.py:499-507` (rss builds a single item), `feed.xml`
  (grep `<item>` = 1), `data/editions/` (12 edition files).

### C3 — `og-metadata-incomplete`
The generated head carries `og:title`, `og:description`, `og:image` (+alt/type/width/
height) and twitter tags, but is missing the standard article tags `og:url`, `og:type`,
`og:site_name`, and `article:published_time`. JSON-LD already carries `datePublished`.
Incomplete OG tags reduce preview quality and CTR on shared links.
- Evidence: `scripts/build_daily.py:438-455` (head template), `index.html:9-15` (OG tags),
  `index.html:43-53` (JSON-LD has `datePublished` but OG omits the article tags).

### C4 — `og-image-static-not-per-edition`
Every edition advertises the same committed static `og-image.png` (1200×630). A
per-edition card (date + lead headline) would make each day's shares visually distinct,
raising CTR. The build already generates the head per-edition; the card is the same
pattern applied to the image.
- Evidence: `index.html:11-19` (og:image → `/og-image.png`), `scripts/build_daily.py:445-449`
  (static path in head), `public-paths.json` (`/og-image.png`).

### C5 — `no-story-anchor-permalinks`
Stories render as `<article>` elements with no `id` anchor, so there is no stable way to
deep-link to one story. Even with share buttons, a reader can only share the whole page.
Adding an `id` per story (e.g. `#story-03`) is a one-line template change that makes
per-story sharing and linking possible, compounding C1.
- Evidence: `scripts/build_daily.py:324-338` (story_card emits `<article>` without id),
  `index.html:72-122` (no story anchors).

### C6 — no email capture surface (routes to NEEDS-NISH)
The footer exposes only RSS + JSON. No email subscription capture exists. Email is the
highest-converting owned-audience channel for a daily content product, but adding it
requires a provider decision first.
- Evidence: `index.html:177-181` (footer has RSS + JSON only), `app.js` (no subscribe
  logic), `public-paths.json` (no subscribe endpoint).

### C7 — no analytics/measurement (routes to NEEDS-NISH)
No analytics or measurement surface. Without it, distribution improvements are
unmeasurable; choosing a privacy posture is a Nish decision.
- Evidence: `index.html` (no analytics script), `app.js` (no tracking), `worker.js`
  (no analytics headers).

### C8 — no monetization surface (routes to NEEDS-NISH)
The feed has an audience but no revenue surface — no sponsorship, affiliate, or paid
placement. Adding one is a deliberate brand/pricing decision (MEMORY.md:12 documents the
deliberate minimalism).
- Evidence: `index.html:177-181` (footer has no sponsor slot/CTA), `styles.css` (no
  sponsor styles), `MEMORY.md:12` (deliberate minimalism).

### C9 — no cross-sell CTA (routes to NEEDS-NISH)
The footer's Tiny Studio link is passive; there is no active CTA driving readers to
Nish's products. Promotional posture is a brand-integrity decision.
- Evidence: `index.html:178-179` (passive Tiny Studio link, no CTA), `MEMORY.md:15`
  (products link to inish.in, but inish.in does not actively cross-sell back).
