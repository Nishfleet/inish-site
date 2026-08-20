# AUDIT / REVIEW — 2026-08-20 — inish-site

## Headline

The referenced input (`var/scout/CANDIDATES-2026-08-20-inish-site.md`) did **not exist**
when this run started (verified by filesystem-wide search; no `var/scout/` directory
was present and no prior scout produced candidates for `inish-site`). The candidate set
was therefore reconstructed directly from the product repo
(see `CANDIDATES-2026-08-20-inish-site.md`). Every survivor below carries a cited
evidence source (file path + line number, commit, or PR).

**Revenue reality:** inish.in is a daily AI/product/demand-signal feed for founders —
an audience/content product with no paywall or sponsorship surface today. Revenue
impact is scored as how much the item grows or protects readership, distribution,
engagement, and owned-audience value. The single most important revenue fact is that
the **daily feed has not published in 7 days** (latest edition 2026-08-13, today
2026-08-20) — a daily product that stops being daily has no product.

## Ranked survivors (max 5, priority=revenue)

1. **`feed-stale-7-days`** (HIGHEST revenue impact; operational, buildable now via
   existing runbook).
   The latest edition is 2026-08-13; today is 2026-08-20. A 7-day gap in a daily
   feed loses RSS subscribers, SEO freshness, and social distribution. The publishing
   runbook (`automation/HERMES_DAILY.md`), fetch script, and deploy script all exist —
   this is an operational act, not a code change.
   Evidence: `data/editions/` (last file `2026-08-13.json`), `latest.json:2`,
   `index.html:6`, `feed.xml` (pubDate 13 Aug 2026), `automation/HERMES_DAILY.md`.

2. **`rss-single-item-no-recent-history`** (MEDIUM-HIGH; code change, buildable now).
   `build_daily.py:500-507` `rss()` emits exactly one `<item>` (the latest edition).
   RSS subscribers see a one-item feed. The repo has 10 editions but only 1 appears
   in RSS. Including the last N editions as separate items would increase reader
   retention and re-discovery.
   Evidence: `scripts/build_daily.py:500-507` (rss function, single item),
   `scripts/build_daily.py:539` (passes only `latest`), `feed.xml` (one `<item>`),
   `data/editions/` (10 files).

3. **`no-share-buttons-on-stories`** (MEDIUM; code change, buildable now).
   Each story article has a source link but no share button (X, LinkedIn, copy-link).
   Social sharing is the primary organic growth vector for a daily feed. Adding
   per-story share buttons is client-side only (URL construction + clipboard).
   Evidence: `index.html:72-122` (source-link but no share UI), `app.js` (37 lines,
   filter logic only), `styles.css` (no share styles), `scripts/build_daily.py`
   (story template emits source-link only).

4. **`og-metadata-incomplete`** (MEDIUM; code change, buildable now).
   OG metadata is missing `og:url`, `og:type`, `og:site_name`, and
   `article:published_time`. Social platforms use these for link previews; incomplete
   OG tags reduce preview quality and CTR. All values are static or edition-derived
   and already available to the builder.
   Evidence: `index.html:9-15` (OG tags present but missing 4 standard tags),
   `index.html:43-53` (JSON-LD has `datePublished` but OG does not),
   `scripts/build_daily.py` (head template omits the 4 tags).

5. **`og-image-static-not-per-edition`** (MEDIUM; code change, buildable now).
   Every edition shares the same static committed `og-image.png`. A per-edition card
   (date + lead headline) would make social shares visually distinct, increasing CTR.
   The build already generates the head per-edition; the card is the same pattern
   applied to the image. Keep 1200×630 PNG format (X/Twitter requirement).
   Evidence: `index.html:11-19` (og:image → static /og-image.png),
   `public-paths.json:9` (static path), `MEMORY.md:18` (PR #63, static PNG),
   `scripts/build_daily.py:539` (no per-edition card generation).

## INBOX lines to append (each its own line, priority=revenue, original slug tag)

```
[inish-site] priority=revenue feed-stale-7-days: Daily feed latest edition is 2026-08-13; today is 2026-08-20 — a 7-day gap in a daily product. Run the publishing runbook (automation/HERMES_DAILY.md) to produce and deploy today's edition. Evidence: data/editions/ (last 2026-08-13.json), latest.json:2, index.html:6, feed.xml.
[inish-site] priority=revenue rss-single-item-no-recent-history: build_daily.py:500-507 rss() emits only 1 item (latest edition); RSS subscribers see a one-item feed. Extend rss() to emit the last N editions as separate items so the feed shows history. Evidence: scripts/build_daily.py:500-507,539, feed.xml, data/editions/ (10 files).
[inish-site] priority=revenue no-share-buttons-on-stories: Story articles (index.html:72-122) have a source link but no share button. Add per-story share buttons (X, LinkedIn, copy-link) to the story template and app.js — client-side only, no backend. Evidence: index.html:72-122, app.js (37 lines), styles.css (no share styles).
[inish-site] priority=revenue og-metadata-incomplete: OG tags (index.html:9-15) missing og:url, og:type, og:site_name, article:published_time. Add the 4 standard OG article tags to the head template in build_daily.py — all values are static or edition-derived. Evidence: index.html:9-15,43-53, scripts/build_daily.py head template.
[inish-site] priority=revenue og-image-static-not-per-edition: Every edition shares the same static og-image.png (index.html:11-19). Generate a per-edition 1200x630 PNG (date + lead headline) in build_daily.py so social shares are visually distinct day-to-day. Evidence: index.html:11-19, public-paths.json:9, MEMORY.md:18 (PR #63), scripts/build_daily.py:539.
```

## Market-signal role

**No new competitor moves or pricing shifts detected from a candidates file** — the
referenced input file was absent. inish.in's competitors are other AI newsletters
(TLDR, The Rundown, Ben's Bites, etc.); no competitor pricing or feature shifts are
visible in the product workspace.

**The strongest market signal is the product's own consistency risk:** a daily feed
that has not published in 7 days signals to subscribers and search engines that the
product may be abandoned. This is the highest-impact finding and is captured in
survivor #1 (`feed-stale-7-days`).

The feed's own editorial content (2026-08-13 edition) covers AI market moves (Grok 4.6
pricing, DeepSeek V4 Pro pricing, Lovable $400M raise), but those are editorial content,
not product candidates for inish.in itself.

## Rejected / dedup

- Candidate 6 (`no-email-subscription-surface`) — routed to NEEDS-NISH (brand/pricing:
  email provider choice).
- Candidate 7 (`no-analytics-measurement`) — routed to NEEDS-NISH (brand/privacy:
  analytics tool choice).
- Candidate 8 (`no-sponsorship-monetization-surface`) — routed to NEEDS-NISH
  (pricing/brand: monetization model).
- Candidate 9 (`no-cta-cross-sell-to-products`) — routed to NEEDS-NISH (brand:
  promotional posture).
- All four NEEDS-NISH items have cited evidence but the core work requires a Nish
  decision before implementation can proceed.

## Files

- Input candidates: `var/scout/CANDIDATES-2026-08-20-inish-site.md`
- Needs-Nish items: `var/scout/NEEDS-NISH.md`
