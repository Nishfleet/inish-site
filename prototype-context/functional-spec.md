# AI Converter 11/10 Functional Spec

## Primary Audience

People with real files to convert: operators, founders, bookkeepers, accountants, creators, and small teams.

## Required Surfaces

- `/formats`: generated list of actual conversion options, with provider-gated routes shown honestly.
- Homepage ticker: same source of truth as `/formats`, not separate hand-written claims.
- Upload workflow: per-selected-conversion confidence details for output, preview, privacy, and limits.
- Admin overview: concise action queues for failures, stuck provider jobs, payment handoff, refunds, support, and webhooks.
- Tests: top conversion QA pack for the popular requests we publicly highlight.

## Required States

- Provider route configured: provider-backed pairs count as available.
- Provider route not configured: provider-backed pairs are visible as gated, not counted as available.
- Local image route: copy must say no upload.
- Server route: copy must say preview first and private short retention.
- Mobile layout: no horizontal overflow.

## Constraints

- Do not claim exact provider success for every file.
- Do not list upcoming email intake as live.
- Do not weaken Turnstile or payment guards for testing.
- Do not hand-maintain a format claim in one place when it can drift from app metadata.
