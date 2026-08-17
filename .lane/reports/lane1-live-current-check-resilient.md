# Lane 1 report — resilient Live current check

Branch: `lane1-live-current-check-resilient-2026-08-17`
PR: https://github.com/nish3451/inish-site/pull/new/lane1-live-current-check-resilient-2026-08-17

## Item

- [x] make the hourly Live current check resilient to the recurring GitHub schedule stall that has now gone silent 7+ hours

## Root cause

GitHub Actions `schedule` events fire hours late or not at all on this repo
with no visible signal in the Actions tab. The previous hourly parity sweep
relied on cron, so an Actions stall left inish.in silently stale until the
next deploy happened to run — exactly the blind spot the hourly check exists
to close.

## Fix

Move the hourly cadence off the GitHub scheduler onto a systemd timer on the
VPS. The timer payload (`scripts/run_live_current_check.sh`) re-fetches
origin/main, materializes the pinned check script from that fetched head, and
runs `scripts/check_live_current.sh` against the live hostname. The workflow
(`Live current check`) loses its `schedule` trigger and stays as the manual
dispatch + fallback path.

## Files

- `install/live-current-check.timer` — hourly cadence (`:02` every hour,
  `Persistent=true`, points at the service unit).
- `install/live-current-check.service` — `oneshot`, runs as user `nish`,
  `ExecStart=/usr/local/sbin/run_live_current_check.sh`, no restart on
  failure (a stale live site must leave the unit failed).
- `scripts/run_live_current_check.sh` — keeps a private origin/main clone
  under `$HOME/.cache/inish-live-current-check/main`, fetches, materializes
  the accepted-main `check_live_current.sh` into the working tree, and
  `exec`s it. No deploy, no Cloudflare token, no new secret.
- `.github/workflows/live-current-check.yml` — dropped the `schedule:` block
  and the cron comment; kept `workflow_dispatch` and the rest of the
  invariant contract.
- `automation/HERMES_DAILY.md` — runbook now points operators at the VPS
  timer as the hourly scheduler and explains the workflow is the manual path.
- `tests/test_check_live_current.py` — four new tests pin:
  - the timer payload is committed and the unit references it
  - the wrapper fetches origin/main and runs the pinned check from
    `FETCH_HEAD` (no hardcoded hash, no installed copy)
  - the wrapper never deploys and never reads a Cloudflare token
  - the workflow has no `schedule:` / `cron:` and the timer carries
    `[Timer]` / `OnCalendar=` / `Persistent=true`

## Evidence

- `python3 -m unittest discover -s tests -v` → 106 tests, all green
  (10 of those are the new `test_check_live_current.py` cases).
- `node --test "tests/**/*.test.mjs"` → 16 tests, all green.
- `bash -n scripts/run_live_current_check.sh` → clean syntax.
- Two commits pushed to `lane1-live-current-check-resilient-2026-08-17`,
  branch is bound to the origin and ready for PR review.

## Acceptance criteria

- [x] Hourly cadence no longer depends on GitHub's `schedule` events.
- [x] Sweep keeps firing while every GitHub runner is busy, offline, or
      stalled.
- [x] Sweep still runs the same parity check as the workflow.
- [x] Sweep never deploys and never touches Cloudflare credentials.
- [x] Unit + workflow split prevents regressions: no new secrets, no cron in
      the workflow, timer is committed, pinned check from FETCH_HEAD.
- [x] All tests pass.
