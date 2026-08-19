# AI Converter Conversion Brief Plan

Date: 2026-06-18

## Goal

Make AI Converter more self-serve and agentic by giving each authorized conversion a structured brief that explains job state, validation/readiness, safe next actions, retention, and support handoff data without exposing uploaded source files, private object keys, credentials, or provider internals.

## Scope

- Add an authenticated `/api/conversion-brief` endpoint using the existing job ID plus token/cookie authorization.
- Build the brief from existing job metadata, payment status, validation availability, redo eligibility, retention windows, converter/output type, and support category.
- Keep the brief deterministic and non-agentic for this slice: no model call, no autonomous support reply, no external provider mutation.
- Show a compact conversion brief in the result panel so customers know whether to preview, unlock, wait, redo, download validation, delete, or contact support with a job ID.
- Add tests that lock the API contract, UI wiring, and non-exposure rules.

## Non-Goals

- No D1 schema changes.
- No Cloudflare Pages deploy.
- No Dodo, R2 lifecycle, provider, or accounting-export behavior changes.
- No claim that AI Converter provides accounting advice, official accounting-platform support, or human review of source files.

## Implementation Steps

1. Create a small `functions/lib/conversion-brief.js` builder that maps job state to:
   - `mode`: `self_serve_preview`, `self_serve_unlock`, `self_serve_download`, `wait_for_provider`, `safe_failure`, or `expired_or_deleted`.
   - `summary`: customer-readable state.
   - `nextActions`: concise self-serve steps.
   - `support`: category, support URL, safe message guidance, and job ID reference.
   - `retention`: source/result expiry and deletion state.
   - `accountingReadiness`: review/import cautions for bank/accounting outputs.
2. Add `/api/conversion-brief` with the same authorization pattern as `/api/job`.
3. Fetch the brief when a server result exists and render a compact panel near the preview/result actions.
4. Add focused API and static UI tests.
5. Run `node --test tests/*.test.mjs`, `npm run build`, `git diff --check`, and the installed autoreview helper before committing.

## Risks And Controls

- Sensitive-file exposure: never include source keys, preview keys, result keys, validation keys, token hashes, IP/user-agent hashes, or raw file content.
- Overclaiming: frame accounting outputs as review/import prep, not accounting advice or guaranteed import support.
- Support privacy: guide customers to share the job ID and short issue description, not bank/receipt/source-file data.
- Provider drift: do not infer live provider status beyond stored job state.

## Completion Criteria

- Authorized customers can retrieve and see a conversion brief for their current job.
- Failed, preview-ready, converting, complete, deleted, and expired-ish states have clear next actions.
- Tests cover the API contract and UI wiring.
- Required local verification and review gate pass, with deploy dry-runs avoided unless explicitly approved.
