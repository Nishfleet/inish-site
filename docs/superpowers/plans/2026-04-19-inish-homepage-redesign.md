# inish.in Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `inish.in` from a minimal holding page into a founder surface that shows Nish as actively building, with products and current bets first and founder context second.

**Architecture:** Keep the implementation as a single static HTML file with inline CSS. Replace the centered holding-page card with a fuller one-page layout that introduces current products, current bets, founder context, and clear paths to Tiny Studio and `0509` without introducing a framework.

**Tech Stack:** Static HTML, inline CSS, local browser/server verification where available

---

### Task 1: Replace the holding-page story

**Files:**
- Modify: `index.html`

- [ ] Rewrite metadata and hero copy so the page no longer reads as a parked personal homepage.
- [ ] Make products and current bets appear in the first screenful.
- [ ] Add clear exits to Tiny Studio, `0509`, and direct contact.

### Task 2: Add founder-surface sections

**Files:**
- Modify: `index.html`

- [ ] Add a short “current work” or “current bets” layer that makes Nish feel in motion.
- [ ] Add a compact founder-context section explaining the type of products/problems Nish keeps building.
- [ ] Add a smaller selected-thinking layer that supports credibility without taking over the page.

### Task 3: Rebuild the visual system

**Files:**
- Modify: `index.html`

- [ ] Keep the page fully light: no dark mode, no dark hero, no black-heavy surfaces.
- [ ] Shift from one centered glass card to a warmer editorial/product layout with more hierarchy and better spacing.
- [ ] Keep the styling lightweight and tasteful rather than turning the page into a product-marketing clone of Tiny Studio.

### Task 4: Verify and finish

**Files:**
- Modify if needed: `index.html`

- [ ] Verify the page renders as valid HTML and still works as a single static file.
- [ ] Verify the updated page includes direct paths to Tiny Studio and `0509`.
- [ ] Do a final copy pass to remove generic founder-language and placeholder phrases.

## Notes

- Keep the site lighter and more personal than `tinystudio.in`.
- Do not turn this into a full blog, CMS, or multi-page personal brand site.
- The strongest proof should be real products and current bets, not abstract self-description.
