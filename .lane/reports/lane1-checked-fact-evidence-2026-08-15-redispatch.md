# Lane 1 report: every Checked fact links to its exact evidence (re-dispatch, 2026-08-15)

## Item

- [ ] make every `Checked` fact link to the exact evidence that supports it [scout 2026-08-10, risk: amber, truth]

## Verdict

**Already done — no code change needed.** This lane is a re-dispatch of
completed work. The item was implemented by PR #58 (merged 2026-08-12), and
the completion was recorded and re-verified live by this same item's prior
lane, merged today as PR #75 (`915467b`). Nothing is left to change.

## How the item was closed

- PR #58 (`b86cf31`, merged 2026-08-12): `evidence_url` is a required,
  validated HTTPS story field in `scripts/build_daily.py`; the builder
  renders the Checked line as a link to it; cross-source facts link to their
  discussion thread while the story keeps its own primary link.
- PR #75 (`915467b`, merged 2026-08-15): records the completion in
  `MEMORY.md` and adds `.lane/reports/lane1-checked-fact-evidence-2026-08-15.md`,
  including today's live re-verification.

## Re-verification performed this run (2026-08-15)

- `python3 -m unittest discover -s tests` → **99 tests, OK** (includes
  `test_every_checked_fact_links_to_its_evidence`,
  `test_checked_fact_renders_its_evidence_link`,
  `test_rejects_cross_source_fact_without_evidence_url`).
- `scripts/build_daily.py` still enforces `evidence_url` as required and
  validates it as a public HTTPS URL (rejection path intact).
- `data/editions/2026-08-13.json` and committed `latest.json`: all 4 stories
  carry a valid `https://` `evidence_url`.
- Live `https://inish.in/latest.json` (HTTP 200): all 4 stories carry
  `evidence_url`; matches the committed feed.

## Change

- `.lane/reports/lane1-checked-fact-evidence-2026-08-15-redispatch.md`: this report.

No product code, content, or production settings touched.

## What would re-open the item

A future edition shipping a fact whose evidence link does not actually support
it, or a regression in the builder's evidence-link rendering — both would fail
the existing tests or the builder's own validation. Per `MEMORY.md`, do not
re-dispatch unless that happens.
