# Customer Trial Notes

Durable record for the scout item: **run five observed intent-matched customer
trials (bookkeepers / SMB operators) with a free full export** (scout 2026).
Live-production claims only: everything below is verified against the live
product and repo code on 2026-08-11.

## Verdict (2026-08-11)

- The five **observed sessions themselves are Nish-held**: recruiting real
  bookkeepers / SMB operators and observing their sessions requires Nish's
  human network and a human observer with participant consent. The lane
  deliverable is the trial kit below, the verified free-export grant
  mechanics, and the grant decision record.
- The **free full export capability is verified in code and live state**:
  - Live `/api/health` (2026-08-11): `freeDownloads: false` — free full
    export is NOT currently enabled in production.
  - Gate code: `functions/api/download.js:25-28` and
    `functions/api/batch-download.js:53-57` — a complete job downloads only
    with `paid_at` set, or when `FREE_DOWNLOADS_ENABLED === "true"`.
  - A new test (`tests/download-gate.test.mjs`) locks these exact semantics
    so a future trial run cannot silently break the gate.
- **Grant decision (dated 2026-08-11): per-job `paid_at` grant for the five
  trial jobs, not the global flag.** Rationale: the global
  `FREE_DOWNLOADS_ENABLED=true` flip makes *every* export free (revenue
  impact for all users) and additionally requires a production deploy — which
  is still blocked from lanes (no Pages:Edit credential; see `.lane/report.md`
  2026-08-11). A per-job grant touches exactly five jobs, leaves a clean
  accounting trail, and needs no deploy.

## Operational definition of the item

- **Intent-matched**: the participant has a *real, current* conversion task —
  real bank statement PDFs they actually need as CSV / Excel / QuickBooks /
  Xero rows — not a hypothetical demo file. Intent match is confirmed by the
  screener, not assumed from job title.
- **Observed**: a session where the participant shares their screen (or the
  session is watched live) from landing page to export download, with the
  observer recording friction, confusion, trust signals, and the moment of
  value.
- **Five**: five separate participants — target mix 2–3 bookkeepers and 2–3
  SMB operators (someone who runs their own books).
- **Free full export**: the trial participant receives the full extracted
  file for their own real file at no charge.

## How to grant the free full export (verified 2026-08-11)

Option A — **per-job grant (RECOMMENDED, Nish-held)**: after the trial job
completes (status `complete`, preview reviewed), mark the job paid directly in
D1. Needs wrangler/admin D1 access, which no VPS lane currently has:

```sql
UPDATE jobs
SET paid_at = '<trial date ISO>', payment_id = 'trial:<participant-id>'
WHERE id = '<job id>' AND token_hash IS NOT NULL;
```

- `payment_id = 'trial:…'` keeps trials distinguishable from real Dodo
  payments in admin overview and refund drills.
- Zero revenue impact beyond the five jobs; no deploy needed.
- The trial participant's job token still works for `/api/download` after the
  grant; the export is delivered through the normal, tested download path.

Option B — **global flag (NOT recommended, Nish decision if chosen)**:
`FREE_DOWNLOADS_ENABLED=true` makes every export free for everyone and
requires a Pages deploy (currently blocked from lanes). If ever used, it must
be flipped back after the trial window and its exact on/off window recorded
here.

## Recruitment (copy-paste, Nish-held)

LinkedIn (bookkeepers / accountants):

> Hi [name] — I run aiconverter.app, a bank-statement PDF → CSV/Excel/QuickBooks
> converter. We're doing five observed test sessions with bookkeepers and
> SMB operators who actually convert statements. You'd bring one real file,
> we watch you use the tool (about 20–30 min), and you keep the full export
> free. Worth a look? I can send a one-line walkthrough first.

WhatsApp / email (SMB operators):

> Hi [name] — I'm testing our bank-statement PDF → CSV converter with a few
> small-business owners before launch. Got a real statement to convert? I'll
> watch you use it for ~25 min and you get the full CSV/Excel export free —
> no card, no account. In?

Screener (must confirm all three for intent match):

1. Do you convert bank statement PDFs for yourself or clients?
2. How often — weekly, monthly, occasionally?
3. Do you need CSV / Excel / QuickBooks / Xero output? (Bring one real file.)

## Session protocol (per participant)

1. **Consent + privacy**: restate the live privacy claims (`/trust`):
   preview-first, source files auto-deleted ~1 day (R2 1-day lifecycle),
   no human review of files. Ask to record screen/notes.
2. **Observe, don't steer**: landing → upload the real file → free preview
   sample → unlock/export → download the full export. Note where the
   participant hesitates, re-reads copy, or asks "is this safe / how much".
3. **Post-session questions**:
   - What was the fastest win?
   - What blocked or confused you?
   - Would you pay for a 25/100-page pack (₹399 / ₹799) for this?

## Evidence template (one row per participant)

| # | Date | Role | Intent match (screener) | File type / pages | Observed steps | Friction notes | Value moment | Export granted (job id) | Quote |
|---|------|------|--------------------------|-------------------|----------------|----------------|--------------|--------------------------|-------|

## Why the sessions cannot be run from a lane

Recruiting real bookkeepers / SMB operators requires Nish's network and
outreach accounts; an observed session requires a human observer present with
participant consent (screen sharing / interview). The fleet has no participant
pool, no session presence, and no consent mechanism, and per fleet policy
human interactions and account actions stay with Nish — the same class of
blocker as the launch-venue submissions recorded in `ops/launch-venues.md`.

## Closing the item

- Record all five rows in the ledger above (this file); when 5/5 are
  complete, flip the scout item closed.
- Each session's export must be granted via Option A (or the Option B window
  recorded with exact dates).
- Findings that point at product changes (e.g., participants cannot find the
  export, preview not useful) become follow-up packets with evidence.
