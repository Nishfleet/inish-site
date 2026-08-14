# Lane 1 report — deliver merged edge head to live + scheduled caller

Run: 2026-08-14 ~17:50Z (fleet-dispatch lane worker, fresh 2h lease)

## Outcome: already delivered — re-verified this run

This lane was dispatched again (item c20049f653). Both halves of the item
were completed on origin/main in earlier runs today (delivery run: deployed
`3e57af1` to live, verified `verified_live`; the scheduled caller merged as
PR #51 `97d2597`). Nothing merged after that delivery, so this run
re-verified the operational state is still true; no code change was needed or
made.

### 1. Merged edge head is live

- origin/main head is still `3e57af1` ("fix: make the public-path allowlist
  one source of truth", #72) — no newer merge since the delivery run.
- Ran `bash scripts/check_live_current.sh` (fresh origin/main fetch,
  byte-compare of the live hostname against a pristine snapshot, no deploy,
  no token):
  ```
  verified_feed_only date=2026-08-13 commit=3e57af1b8fe7ff3110a57907d1cf0e7580539219
  verified_live_current commit=3e57af1b8fe7ff3110a57907d1cf0e7580539219
  ```
  Exit 0 — no `LIVE_IS_STALE`. The merged edge head is what the live site
  serves.

### 2. Scheduled caller is active and firing

- `.github/workflows/live-current-check.yml` (merged, PR #51) runs
  `bash scripts/check_live_current.sh` on `cron: '0 * * * *'` (hourly UTC)
  plus `workflow_dispatch`; the job carries no secrets.
- Workflow state: `active`. `gh run list` (workflow live-current-check.yml)
  shows hourly schedule runs landing consistently through
  2026-08-14T16:52:35Z (run 31821372428), all `success` — hourly cadence
  held since 2026-08-13. Next run due 17:00Z was not yet visible at check
  time (17:50Z check preceded the next scheduled fire); the pattern is
  continuous, with no gaps since the workflow was merged.

## Verification detail

- `git fetch origin` — origin/main head unchanged at `3e57af1`.
- Live probes (from the check run): full verify_live.py suite, both canonical
  feeds whole, HEAD methods, redirects, removed routes, fonts, metadata —
  all matched the snapshot.
- Open sibling PRs (#60, #59, #55, #54) touch none of this lane's claims
  files; no overlap.
- Runbook `automation/HERMES_DAILY.md` documents the workflow dispatch and
  the `LIVE_IS_STALE` failure mode; consistent with merged state.

## Why no PR from this run

The packet requires pushing a branch and opening a PR *or* reporting plainly
why not. The item is operational and already complete on origin/main; the
claims files (`.github/workflows/live-current-check.yml`,
`scripts/check_live_current.sh`) are already merged. The branch
`lane1/deliver-edge-head-verified` was pushed clean from origin/main in the
earlier verification run of this lane. A docs-only or zero-diff PR would
churn a shared repo across 4 open sibling PRs without changing the
deliverable, so none was opened.

## Lane record

Claims in `/home/nish/workspaces/agent-state/lanes/inish-site/lane-1.json`
were already published by the lane's earlier runs and left untouched
(`.github/workflows/live-current-check.yml`, `scripts/check_live_current.sh`).

## Re-verification run (2026-08-14 ~18:25Z, fleet-dispatch lane worker, fresh 2h lease)

Lane dispatched again; origin/main unchanged since the delivery run, so the
operational state was re-verified end to end and is still complete:

- `origin/main` head still `3e57af1` (#72); worktree branch clean from
  origin/main (`git log origin/main..HEAD` empty).
- `bash scripts/check_live_current.sh` (fresh origin/main fetch, live
  byte-compare, no deploy), exit 0:
  `verified_feed_only date=2026-08-13 commit=3e57af1...`,
  `verified_live_current commit=3e57af1...` — merged edge head is live.
- Scheduled caller: `Live current check` workflow `active`; hourly schedule
  runs all `success`, newest 2026-08-14T17:52:49Z (run 31826036528) — no
  gaps since merge. Runner `netcup-rs2000-inish-verify1` online, `vps-verify`
  label; systemd `github-runner-inish@verify1.service` active.

No code change, no push needed (branch already pushed clean), no PR opened:
item operational and complete on origin/main.

## Re-verification run (2026-08-14 ~18:50Z, fleet-dispatch lane worker, fresh 2h lease)

Lane dispatched again (item c20049f653). origin/main unchanged since the
delivery run; re-verified both halves end to end; operational state still
complete:

- `origin/main` head still `3e57af1` (#72, merged 2026-08-14 15:52Z) — no
  newer merge; worktree branch `lane1/deliver-edge-head-verified` clean from
  origin/main (`git log origin/main..HEAD` empty, already pushed).
- Ran `bash scripts/check_live_current.sh` fresh (origin/main fetch, live
  hostname byte-compare, no deploy, exit 0):
  `verified_feed_only date=2026-08-13 commit=3e57af1...`,
  `verified_live_current commit=3e57af1...` — no `LIVE_IS_STALE`; the merged
  edge head is what the live hostname serves.
- Scheduled caller re-confirmed: `Live current check` workflow `active`
  (workflow id 331780861); hourly `schedule` runs all `success` with no gaps,
  newest 2026-08-14T17:52:49Z (run 31826036528) on head `3e57af1`; next
  hourly fire due 18:00Z (schedule queue runs ~52 min after cron). Runner
  label `vps-verify` registered.
- Open sibling PRs (#60, #59, #55, #54) touch none of this lane's claims
  files (`.github/workflows/live-current-check.yml`,
  `scripts/check_live_current.sh`); no overlap.

No code change, no new push needed, no PR opened: item operational and
already complete on origin/main.

## Re-verification run (2026-08-14 ~19:25Z, fleet-dispatch lane worker, fresh 2h lease)

Lane dispatched again (item c20049f653). origin/main unchanged since the
delivery run; re-verified both halves end to end; operational state still
complete:

- `origin/main` head still `3e57af1` (#72) — no newer merge; worktree branch
  `lane1/deliver-edge-head-verified` clean from origin/main.
- Ran `bash scripts/check_live_current.sh` fresh (origin/main fetch, live
  hostname byte-compare, no deploy, exit 0):
  `verified_feed_only date=2026-08-13 commit=3e57af1b8fe7ff3110a57907d1cf0e7580539219`,
  `verified_live_current commit=3e57af1b8fe7ff3110a57907d1cf0e7580539219` —
  no `LIVE_IS_STALE`; the merged edge head is what the live hostname serves.
- Scheduled caller re-confirmed: `Live current check` workflow (`schedule`
  cron `0 * * * *` UTC, `workflow_dispatch`, no secrets) active; hourly
  schedule runs all `success` with no gaps, newest at check time
  2026-08-14T18:53:46Z (run 31830793049) on head `3e57af1`.

No code change, no new push needed, no PR opened: item operational and
already complete on origin/main.
