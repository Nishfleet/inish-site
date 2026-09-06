# Lane 1 report: every Checked fact links to its exact evidence (2026-08-15)

## Item

- [ ] make every `Checked` fact link to the exact evidence that supports it [scout 2026-08-10, risk: amber, truth]

## Verdict

**Already done — no code change needed.** The item was completed by PR #58 (merged 2026-08-12) and its behavior was re-verified live today. The scout filing predates the merge, so this lane is a re-dispatch of finished work.

## How the item was closed (PR #58, merged 2026-08-12)

- `evidence_url` is now a required story field in `scripts/build_daily.py`; a story missing it is rejected (the edition cannot build).
- It is validated as a public HTTPS URL, same as the story URL, so a "Checked" claim can never point at a non-public or unreachable target.
- The builder renders the Checked line as a link to `evidence_url` — the exact source the fact was verified against — not to the story URL.
- A cross-source fact (verified against a discussion thread or data page) links to that thread while the story keeps its own primary-source link; the tests pin both links and reject the same story when the evidence URL is absent.
- The daily publishing runbook (`automation/HERMES_DAILY.md`) documents the field and the rule that a fact whose only URL does not contain the claim must not be labelled Checked.

## Live re-verification (2026-08-15)

- `python3 -m unittest discover -s tests` → 99 tests, OK (includes `test_every_checked_fact_links_to_its_evidence`, `test_checked_fact_renders_its_evidence_link`, `test_rejects_cross_source_fact_without_evidence_url`).
- `https://inish.in/` (live, deployed 2026-08-13 edition): all 4 story facts render as `<p class="fact"><strong>Checked</strong> <a href="…">…</a></p>` with the evidence URL as the link target.
- `https://inish.in/latest.json` carries `evidence_url` on all 4 stories; matches the committed `latest.json`.
- Older editions (2026-08-02 … 2026-08-11) predate the contract and are historical records, not re-rendered surfaces; the builder gates only the accepted edition.

## Change

- `MEMORY.md`: added a decision record stating the item is done (PR #58) with today's re-verification, so the fleet does not re-dispatch it.
- `.lane/reports/lane1-checked-fact-evidence-2026-08-15.md`: this report.

No product code, content, or production settings touched.

## What would re-open the item

A future edition shipping a fact whose evidence link does not actually support it, or a regression in the builder's evidence-link rendering — both would fail the existing tests or the builder's own validation.
