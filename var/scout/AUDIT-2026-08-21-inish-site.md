# AUDIT / REVIEW — 2026-08-21 — inish-site

## Headline

The deterministic candidates file (`var/scout/CANDIDATES-2026-08-21-inish-site.md`,
HEAD `5ee0da5`) carried **no open TODOs/FIXMEs** — the fleet scout's grep captured
nothing — so the candidate set was reconstructed directly from the product repo (see
`CANDIDATES-2026-08-21-inish-site.md`). Every survivor below carries a cited evidence
source (file path + line number, commit, or PR), and every claim was re-verified against
`origin/main` (`af8b3ca`, latest edition `2026-08-21`).

**Revenue reality:** inish.in is a daily AI/product/demand-signal feed for founders — an
audience/content product with no paywall, sponsorship, or email surface today. Revenue
impact is scored as how much the item grows or protects readership, distribution,
engagement, and owned-audience value. The most important change since yesterday: **the
feed is publishing daily again** (latest `origin/main` edition is `2026-08-21`; the 7-day
gap that ranked #1 in the 2026-08-20 audit is resolved). The top candidates therefore
shift from "restore publication" to "grow the distribution of a product that is finally
live."

## Ranked survivors (max 5, priority=revenue)

1. **`no-share-buttons-on-stories`** (HIGHEST revenue impact; code change, buildable now).
   Social sharing is the primary organic growth vector for a daily feed, and each story
   currently renders only a `Read at <domain> ↗` source link — a reader has no in-page
   way to post a story to X/LinkedIn or copy its link. Adding per-story share actions
   (X, LinkedIn, copy-link) is client-side only (URL construction + clipboard), no
   backend.
   Evidence: `scripts/build_daily.py:324-338` (story_card emits source-link only),
   `index.html:72-122` (story bodies, no share UI), `app.js` (37 lines, filter logic
   only), `styles.css` (no share styles).

2. **`rss-single-item-no-recent-history`** (MEDIUM-HIGH; code change, buildable now).
   `rss()` emits exactly one `<item>` — the latest edition. RSS subscribers see a
   one-item feed and search engines get no re-discovery. The repo holds 12 editions but
   RSS shows only 1. Emitting the last N editions as separate items increases retention
   and redistribution.
   Evidence: `scripts/build_daily.py:499-507` (rss builds a single item),
   `feed.xml` (one `<item>`), `data/editions/` (12 files).

3. **`og-metadata-incomplete`** (MEDIUM; code change, buildable now).
   The generated head carries `og:title/description/image` + twitter tags but omits the
   standard article tags `og:url`, `og:type`, `og:site_name`, `article:published_time`.
   JSON-LD already has `datePublished`; all four missing values are static or
   edition-derived and already available to the builder. Incomplete OG tags reduce
   preview quality and CTR on shared links.
   Evidence: `scripts/build_daily.py:438-455` (head template omits the 4 tags),
   `index.html:9-15` (OG present, missing 4), `index.html:43-53` (JSON-LD has
   `datePublished`).

4. **`og-image-static-not-per-edition`** (MEDIUM; code change, buildable now).
   Every edition advertises the same committed static `og-image.png` (1200×630). A
   per-edition card (date + lead headline) makes each day's shares visually distinct,
   raising CTR. The build already generates the head per-edition; the card is the same
   pattern applied to the image. Keep 1200×630 PNG (X/Twitter requirement).
   Evidence: `index.html:11-19` (og:image → `/og-image.png`),
   `scripts/build_daily.py:445-449` (static path in head), `public-paths.json`
   (`/og-image.png`).

5. **`no-story-anchor-permalinks`** (MEDIUM; code change, buildable now).
   Stories render as `<article>` elements with no `id` anchor, so there is no stable way
   to deep-link to one story — even with share buttons a reader can only share the whole
   page. Adding a per-story `id` (e.g. `#story-03`) in the story template is a one-line
   change that makes per-story sharing and linking possible, compounding survivor #1.
   Evidence: `scripts/build_daily.py:324-338` (story_card emits `<article>` without id),
   `index.html:72-122` (no story anchors).

## INBOX lines to append (each its own line, priority=revenue, original slug tag)

```
[inish-site] priority=revenue no-share-buttons-on-stories: Story articles (scripts/build_daily.py:324-338 story_card, rendered index.html:72-122) have only a "Read at" source link, no share button. Add per-story share actions (X, LinkedIn, copy-link) to the story template and app.js — client-side only, no backend. Evidence: scripts/build_daily.py:324-338, index.html:72-122, app.js (37 lines), styles.css (no share styles).
[inish-site] priority=revenue rss-single-item-no-recent-history: scripts/build_daily.py:499-507 rss() emits exactly 1 <item> (latest edition); RSS subscribers and search engines see a one-item feed despite 12 editions. Extend rss() to emit the last N editions as separate items. Evidence: scripts/build_daily.py:499-507, feed.xml (1 item), data/editions/ (12 files).
[inish-site] priority=revenue og-metadata-incomplete: Generated head (scripts/build_daily.py:438-455, index.html:9-15) is missing og:url, og:type, og:site_name, article:published_time. Add the 4 standard article OG tags to the head template in build_daily.py — all values static or edition-derived; JSON-LD already has datePublished. Evidence: scripts/build_daily.py:438-455, index.html:9-15,43-53.
[inish-site] priority=revenue og-image-static-not-per-edition: Every edition advertises the same static og-image.png (index.html:11-19). Generate a per-edition 1200x630 PNG (date + lead headline) in build_daily.py so social shares are visually distinct day-to-day. Evidence: index.html:11-19, scripts/build_daily.py:445-449, public-paths.json.
[inish-site] priority=revenue no-story-anchor-permalinks: Stories render as <article> with no id anchor (scripts/build_daily.py:324-338), so there is no stable deep-link to one story. Add a per-story id (e.g. #story-03) in the story template so per-story sharing and linking work. Evidence: scripts/build_daily.py:324-338, index.html:72-122.
```

## Market-signal role

**No new competitor move or pricing shift is visible in the candidates file** — the
deterministic input was sparse (HEAD + zero TODOs), so it carried no competitor or
pricing corpus. inish.in's competitive set is other AI newsletters (TLDR, The Rundown,
Ben's Bites, etc.); no competitor pricing or feature shifts are visible in the product
workspace.

The product's own editorial content (2026-08-20/21 editions) tracks market moves — Stripe
buying OpenRouter for $7.5B, OpenAI's zero-data-retention counter to Anthropic, Cursor's
GitHub rival Origin, Etched's $21B valuation — but those are editorial content, not
product candidates for inish.in itself.

**The strongest market signal is again a consistency one, now positive:** the daily feed
resumed publishing (2026-08-20 and 2026-08-21 editions are live on `origin/main`), which
reverses the abandonment signal that ranked #1 yesterday. Protecting that consistency
remains the base condition for every distribution gain above.

## Rejected / dedup

- Candidate C6 (`no-email-subscription-surface`) — routed to NEEDS-NISH (brand/pricing:
  email provider choice). Revenue impact HIGH but blocked on a Nish decision.
- Candidate C7 (`no-analytics-measurement`) — routed to NEEDS-NISH (brand/privacy:
  analytics tool choice).
- Candidate C8 (`no-sponsorship-monetization-surface`) — routed to NEEDS-NISH
  (pricing/brand: monetization model).
- Candidate C9 (`no-cta-cross-sell-to-products`) — routed to NEEDS-NISH (brand:
  promotional posture).
- All four NEEDS-NISH items carry cited evidence but the core work requires a Nish
  decision before implementation can proceed. C6-C9 match the 2026-08-20 NEEDS-NISH set;
  they remain open because the decisions are still unmade (re-filed, not new).

## Files

- Input candidates: `var/scout/CANDIDATES-2026-08-21-inish-site.md`
- Needs-Nish items: `var/scout/NEEDS-NISH.md`
