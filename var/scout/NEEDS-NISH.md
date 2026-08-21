# NEEDS-NISH — 2026-08-21 — inish-site

Items that need a Nish decision before a revenue-impact candidate can proceed.
Categorized as pricing / brand / legal / delete per the scout rule. Each item carries
cited evidence; the blocker is the decision, not the code.

## 1. Choose an email provider and subscription UX (brand / pricing)

- The site has RSS and JSON feeds but no email subscription capture. Email is the
  highest-converting owned-audience channel for a daily content product.
- **Decision needed:** which email provider (Substack, Buttondown, ConvertKit,
  self-hosted) and what subscription UX (inline form, dedicated page, popup).
  The provider choice determines cost, deliverability, and audience ownership.
- Cited evidence: `index.html:177-181` (footer has only RSS + JSON, no email),
  `app.js` (no subscription logic), `public-paths.json` (no subscribe endpoint),
  `styles.css` (no subscription form styles).
- Revenue impact: HIGH — email subscribers are the monetizable audience asset for a
  content product (sponsorship, launches, direct distribution).

## 2. Choose an analytics tool and privacy posture (brand / privacy)

- The site has no analytics or measurement surface. Without measurement, every
  distribution improvement is unmeasurable.
- **Decision needed:** which analytics tool (Plausible, Umami, Fathom, GA4, self-hosted)
  and what privacy posture (privacy-respecting/cookieless vs full-tracking, self-hosted
  vs SaaS).
- Cited evidence: `index.html` (no analytics script in head or body), `app.js` (no
  tracking logic), `worker.js` (no analytics headers), `functions/policy.js:64`
  (comment references analytics but none implemented).
- Revenue impact: MEDIUM — cannot grow what cannot be measured.

## 3. Choose a monetization model (pricing / brand)

- The feed has an audience but no revenue surface — no sponsorship slots, affiliate
  links, or paid placement.
- **Decision needed:** which monetization model (sponsorship, affiliate, paid placement,
  native ads) and how promotional the feed should be. MEMORY.md:12 documents the
  deliberate minimalism ("Keep only the current feed plus its RSS, JSON, robots, sitemap,
  CSS, and JavaScript endpoints"), so monetization must be a conscious addition.
- Cited evidence: `index.html:177-181` (footer has no sponsor slot or CTA), `styles.css`
  (no sponsor/ad styles), `public-paths.json` (no sponsor routes), `MEMORY.md:12`.
- Revenue impact: HIGH — the audience asset has no revenue surface today.

## 4. Decide the promotional posture for cross-selling products (brand)

- The feed builds an audience but the footer's Tiny Studio link is passive. There is no
  active CTA driving readers to Nish's products (0509, TinyStudio.io, etc.).
- **Decision needed:** how promotional the feed should be — passive attribution
  (current), active CTA, or product mentions in stories. This is a brand-integrity
  decision for a content product that promises "nothing here unless there is a fact
  under it."
- Cited evidence: `index.html:178-179` (passive Tiny Studio link, no active CTA),
  `MEMORY.md:15` (cross-repo backlinks exist from products TO inish.in, but inish.in does
  not actively cross-sell back).
- Revenue impact: MEDIUM — the feed's audience isn't being converted to product traffic.

## Not applicable

- **legal / delete:** no legal or delete items exist in the current repo evidence. The
  `robots.txt` Content-Signal header (`search=yes, ai-input=yes, ai-train=no`) is an
  existing legal-adjacent decision already implemented and not a candidate for change.
