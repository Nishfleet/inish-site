# inish-site Product Scout Candidates — 2026-08-20

Scout timestamp: 2026-08-20T02:32:45.323Z
Product: inish.in — Nish's Daily Reads (daily AI/product/demand-signal feed for founders)
Repo: /home/nish/workspaces/products/inish-site @ c624119 (origin/main)
Revenue model: audience/content product. Revenue impact = readership, distribution, engagement, and owned-audience growth. No paywall, no sponsorship surface today; the feed is an audience asset that funnels attention to Nish's products (Tiny Studio link in footer).

> **Input note (audit blocker).** The candidates file referenced by this scout run
> (`var/scout/CANDIDATES-2026-08-20-inish-site.md`) did not exist anywhere on the
> filesystem when the audit started — no `var/scout/` directory was present and no
> prior scout produced candidates for `inish-site`. The candidate set below was
> reconstructed **directly from the product workspace**, with every item carrying a
> cited evidence source (file path, commit, or line number). It is the input the
> audit (`AUDIT-2026-08-20-inish-site.md`) ranked.

---

## Candidate 1 — feed-stale-7-days

**Title:** Daily feed has not published a new edition in 7 days (2026-08-13 → 2026-08-20)

**Revenue impact:** HIGHEST — inish.in is a *daily* feed. The latest edition is 2026-08-13; today is 2026-08-20. A 7-day gap in a daily product loses RSS subscribers (readers see a stale feed and unsubscribe), SEO freshness signals (search engines de-rank stale content), and social distribution (no new content to share). This is the product's core failure mode: a daily feed that stops being daily has no product.

**Evidence:**
- `data/editions/` — last edition file is `2026-08-13.json`; no `2026-08-14` through `2026-08-20` files exist
- `latest.json` line 2 — `"date": "2026-08-13"`
- `index.html` line 6 — `<title>Nish's Daily Reads — 2026-08-13</title>`
- `feed.xml` — single `<item>` with `<pubDate>Thu, 13 Aug 2026 00:00:00 +0000</pubDate>`
- `automation/HERMES_DAILY.md` — the daily publishing runbook (steps 1-9) exists and is the operational path to publish a new edition

**Proposed work:** Run the daily publishing runbook (`automation/HERMES_DAILY.md`) to produce and deploy a new edition for today (2026-08-20), closing the 7-day staleness gap. This is an operational act, not a code change — the runbook, fetch script, and deploy script all exist.

---

## Candidate 2 — rss-single-item-no-recent-history

**Title:** RSS feed emits only the latest edition as a single item, not recent history

**Revenue impact:** MEDIUM-HIGH — RSS subscribers see a one-item feed. A reader who subscribes today sees only today's edition and has no way to browse recent editions in their reader. Including the last 5-10 editions as separate RSS items would increase reader retention (subscribers see a richer feed), re-discovery (past editions resurface in readers), and perceived value (a feed with history looks active, not abandoned). The repo has 10 editions in `data/editions/` but only 1 appears in RSS.

**Evidence:**
- `scripts/build_daily.py` lines 500-507 — `rss()` function constructs exactly one `<item>` from the latest edition only: `item = f"<item>...{day.isoformat()}...</item>"` then returns `channel + item + close`
- `feed.xml` — contains exactly one `<item>` (2026-08-13)
- `data/editions/` — 10 edition files exist (2026-08-02 through 2026-08-13) but only the latest is rendered into RSS
- `scripts/build_daily.py` line 539 — `(DAILY / "feed.xml").write_text(rss(latest), ...)` passes only `latest`, not a list

**Proposed work:** Extend `rss()` in `scripts/build_daily.py` to emit the last N editions (e.g., 10) as separate `<item>` elements, each with its own `<pubDate>` and full-content description, so RSS subscribers see a feed with history. The editions are already in `data/editions/`; the change is to load and render the recent window, not just the latest.

---

## Candidate 3 — no-share-buttons-on-stories

**Title:** Story articles have a source link but no social share buttons

**Revenue impact:** MEDIUM — social sharing is the primary organic growth vector for a daily content feed. Each story article (`index.html` lines 72-122) has a "Read at X ↗" source link but no share button (X/Twitter, LinkedIn, copy-link). Adding frictionless per-story share buttons would let readers amplify stories they find valuable, increasing reach without any paid distribution.

**Evidence:**
- `index.html` lines 72-122 — each `<article class="story">` has a `<a class="source-link">` but no share button or share UI element
- `app.js` (37 lines) — contains only filter logic (`data-filter` buttons); no share, copy-link, or social-share logic
- `styles.css` — no `.share`, `.share-button`, or social-share class exists (grep for "share" returns zero matches)
- `scripts/build_daily.py` — the story render template (around line 460+) emits `source-link` but no share markup

**Proposed work:** Add per-story share buttons (X/Twitter, LinkedIn, copy-link) to the story template in `scripts/build_daily.py` and corresponding share logic in `app.js` (window.open share intents + clipboard copy for the copy-link button). Add share-button styles to `styles.css`. No backend needed — share intents are client-side URL construction.

---

## Candidate 4 — og-metadata-incomplete

**Title:** Open Graph metadata is missing og:url, og:type, og:site_name, and article:published_time

**Revenue impact:** MEDIUM — social platforms (X, LinkedIn, Facebook, Slack, Discord) use Open Graph tags to render link previews. The head has og:title, og:description, and og:image but is missing og:url (causes canonical-URL inference issues), og:type (defaults to "website" instead of "article", changing preview behavior), og:site_name (missing branding in previews), and article:published_time (no date in structured social metadata). Complete OG article metadata improves preview quality and CTR on every share.

**Evidence:**
- `index.html` lines 9-15 — OG tags present: `og:title`, `og:description`, `og:image`, `og:image:alt`, `og:image:type`, `og:image:width`, `og:image:height`; ABSENT: `og:url`, `og:type`, `og:site_name`, `article:published_time`
- `index.html` lines 43-53 — JSON-LD `Article` graph has `datePublished: "2026-08-13"` but the OG metadata does not carry the equivalent `article:published_time`
- `scripts/build_daily.py` — the head template (around line 455) emits the OG tags but omits og:url, og:type, og:site_name, and article:published_time

**Proposed work:** Add `og:url` (canonical `https://inish.in/`), `og:type` (`article`), `og:site_name` (`Nish's Daily Reads`), and `article:published_time` (the edition date) to the head template in `scripts/build_daily.py`. These are static or edition-derived values already available to the builder.

---

## Candidate 5 — og-image-static-not-per-edition

**Title:** Social card is a single static committed PNG, not generated per-edition

**Revenue impact:** MEDIUM — every edition shares the same `og-image.png` (a committed static file). A per-edition card (date-stamped or featuring the lead story headline) would make social shares visually distinct day-to-day, increasing CTR from followers who scroll past a familiar card. The build pipeline already generates the HTML head per-edition; generating the card per-edition is the same pattern applied to the image.

**Evidence:**
- `index.html` lines 11-19 — `og:image` and `twitter:image` both point to `https://inish.in/og-image.png`, a static committed file
- `public-paths.json` line 9 — `"/og-image.png"` is a static public path serving the committed file
- `MEMORY.md` line 18 — "PR #63 (merged 2026-08-12) added the committed 1200×630 `og-image.png`" — the static PNG was added because X/Twitter could not render SVG; a per-edition PNG would keep the same format
- `og-image.png` — committed static file (30765 bytes, unchanged across editions)
- `scripts/build_daily.py` line 539 — the build writes `feed.xml` and `sitemap.xml` per-edition but does not generate a per-edition `og-image.png`

**Proposed work:** Generate a per-edition `og-image.png` (or per-edition SVG rendered to PNG) in `scripts/build_daily.py` that includes the edition date and lead story headline, replacing the static committed card. Keep the 1200×630 PNG format (X/Twitter requirement per MEMORY.md). The build already has the edition data; the card generation is a new render step.

---

## Candidate 6 — no-email-subscription-surface [NEEDS-NISH: brand/pricing]

**Title:** No email subscription capture anywhere on the site

**Revenue impact:** HIGH (but blocked on Nish) — email is the highest-converting owned-audience channel for a daily content product. The site has RSS and JSON feeds but no email signup. An email list is the monetizable audience asset for a content product (sponsorship, launches, direct distribution).

**Evidence:**
- `index.html` lines 124-128 — footer has only `<a href="/feed.xml">RSS</a>` and `<a href="/latest.json">JSON</a>`; no email signup form or link
- `app.js` (37 lines) — no subscription form logic
- `public-paths.json` — no subscription or signup endpoint in publicPaths
- `styles.css` — no subscription form styles

**Why NEEDS-NISH:** Choosing an email provider (Substack, Buttondown, ConvertKit, self-hosted) and the subscription UX (inline form, dedicated page, popup) is a brand and pricing decision. The provider choice determines cost, deliverability, and audience ownership. Nish must choose before implementation.

---

## Candidate 7 — no-analytics-measurement [NEEDS-NISH: brand/privacy]

**Title:** No analytics or measurement surface — cannot track distribution growth

**Revenue impact:** MEDIUM (but blocked on Nish) — without measurement, there is no way to know if distribution changes (email, social, SEO) are growing readership. Every revenue-impact improvement above is unmeasurable without analytics.

**Evidence:**
- `index.html` — no analytics script in `<head>` or `<body>` (no gtag, Plausible, Umami, Fathom, or similar)
- `worker.js` — no analytics headers, logging, or event emission
- `app.js` — no tracking or event logic
- `functions/policy.js` line 64 — comment mentions "analytics and link previews care about it" (referring to search-string preservation) but no analytics is actually implemented

**Why NEEDS-NISH:** Choosing an analytics tool is a brand/privacy decision (privacy-respecting vs full-tracking, self-hosted vs SaaS, cookieless vs cookie-based). Nish must choose the tool and the privacy posture before implementation.

---

## Candidate 8 — no-sponsorship-monetization-surface [NEEDS-NISH: pricing/brand]

**Title:** No sponsorship, affiliate, or monetization surface on the feed

**Revenue impact:** HIGH (but blocked on Nish) — the feed has an audience but no revenue surface. No sponsorship slots, no affiliate links, no paid placement. The footer links to Tiny Studio (Nish's studio) but there is no "sponsor this feed" or revenue-generating surface.

**Evidence:**
- `index.html` lines 124-128 — footer has RSS, JSON, and a passive Tiny Studio link; no sponsor slot or "sponsor" CTA
- `styles.css` — no sponsor, ad, or promotion styles
- `public-paths.json` — no sponsor or monetization routes
- `MEMORY.md` line 12 — "Keep only the current feed plus its RSS, JSON, robots, sitemap, CSS, and JavaScript endpoints. Do not publish founder/product pages, LLM pages, or edition archives." — the site is deliberately minimal, so monetization must be a conscious addition

**Why NEEDS-NISH:** Monetization model (sponsorship, affiliate, paid placement, native ads) is a pricing and brand decision. How promotional the feed should be is a brand-integrity decision. Nish must choose the model before implementation.

---

## Candidate 9 — no-cta-cross-sell-to-products [NEEDS-NISH: brand]

**Title:** Feed audience is not converted to Nish's product traffic

**Revenue impact:** MEDIUM (but blocked on Nish) — the feed builds an audience but the footer's Tiny Studio link is passive. There is no active CTA driving readers to Nish's products (0509, TinyStudio.io, etc.). The feed is an audience asset that isn't converting to product traffic.

**Evidence:**
- `index.html` lines 124-128 — footer has a passive `<a href="https://tinystudio.in/">Tiny Studio ↗</a>` link but no active CTA, no product mentions, no "built by" story
- `MEMORY.md` line 15 — cross-repo backlinks exist FROM 0509 and tinystudio.io TO inish.in, but inish.in does not actively cross-sell back to specific products

**Why NEEDS-NISH:** How promotional the feed should be (passive attribution vs active CTA vs product mentions in stories) is a brand-integrity decision. Nish must decide the promotional posture before implementation.

---

## Market-signal notes (competitor moves / pricing shifts)

The referenced candidates file (which would have carried any market-signal content) was absent. No external competitor data is available from a candidates file. The following product-internal signals are noted for the market-signal role:

1. **The feed's own content covers AI market moves** — the 2026-08-13 edition covers Grok 4.6 pricing ($2/$6 per million tokens), DeepSeek V4 Pro pricing ($0.435/$0.87 per million tokens), and Lovable's $400M Series C. These are editorial content, not product candidates for inish.in itself.

2. **No competitor newsletter/feed pricing shifts are visible** — inish.in's competitors are other AI newsletters (TLDR, The Rundown, Ben's Bites, etc.). No competitor moves or pricing shifts are visible in the (absent) candidates file or the product workspace.

3. **The 7-day publication gap is the strongest market signal** — a daily feed that stops publishing for 7 days signals to subscribers and search engines that the product may be abandoned. This is the highest-impact market-signal finding: the product's own consistency is the competitive risk.

No new competitor moves or pricing shifts are visible in the candidates file or product workspace as of 2026-08-20.
