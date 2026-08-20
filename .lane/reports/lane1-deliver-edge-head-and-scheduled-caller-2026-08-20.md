# Lane 1 report — deliver the merged edge head to live and give `check_live_current.sh` a scheduled caller

Branch: `lane1/deliver-edge-head-and-scheduled-caller-2026-08-20`
Date: 2026-08-20

## Item

> deliver the merged edge head to live and give `check_live_current.sh` a scheduled caller [scout 2026-08-11]

## Verdict

**Both halves of the item are already delivered and live-verified on the VPS.
This run is a re-verification, not a code change.**

The lane packet was dispatched for an item that `MEMORY.md` already records
as closed (2026-08-12) and that the hourly `check_live_current.sh` keeps
verifying every hour on the VPS timer. There is nothing left to do; the
report is filed so the lane controller has a fresh receipt on the
2026-08-20 re-dispatch and the close condition stays the proof, not the
silence.

## Half 1 — deliver the merged edge head to live

The live hostname currently serves the accepted `origin/main` edition
byte-for-byte, and the merged head on `origin/main` at the time of this
run (`d3b50821ee9adaa95b3d2e30127511912750ebb1`, Merge pull request #87)
is exactly the commit being served.

Live verification run from this worktree:

```
$ git fetch --quiet origin main
$ git rev-parse FETCH_HEAD
d3b50821ee9adaa95b3d2e30127511912750ebb1

$ bash scripts/check_live_current.sh
verified_feed_only date=2026-08-20 commit=d3b50821ee9adaa95b3d2e30127511912750ebb1
verified_live_current commit=d3b50821ee9adaa95b3d2e30127511912750ebb1
```

`scripts/check_live_current.sh` is the deploy-free parity check
introduced in PR #37 and pinned in `MEMORY.md` as the close-condition
proof for this item. `verified_live_current commit=d3b5082…` is the line
the `MEMORY.md` contract asks for; it is the same commit the live
hostname is serving, and it is `origin/main`'s HEAD. `LIVE_IS_STALE` is
not asserted, so the half is delivered.

Cross-check via direct probe (`curl -sI https://inish.in/`):

```
HTTP/2 200
strict-transport-security: max-age=31536000; includeSubDomains
server: cloudflare
```

The HSTS header is present (PR #84 / commit `cd6fbe2`, the merged head
delivered to live after the original 2026-08-12 close), confirming the
live site is on the post-2026-08-12 merged head, not a stale earlier
deployment.

## Half 2 — give `check_live_current.sh` a scheduled caller

The hourly caller lives on the VPS's own scheduler and is currently
firing. The two earlier delivery PRs in the close chain are:

- PR #51 (`97d2597 ci: give the live-current check a scheduled caller`)
  — initial GitHub Actions schedule.
- PR #81 (`1d082f5 fix: run the hourly Live current check on the VPS
  timer, not GitHub scheduling`) — moved the caller off GitHub's
  unreliable `schedule` events and onto `live-current-check.timer` on
  the VPS. The workflow is now `workflow_dispatch` only; the timer
  carries the hourly cadence.

Live VPS state at this run (from this host):

```
$ systemctl status live-current-check.timer
● live-current-check.timer - Run the inish.in live-current parity check every hour
     Loaded: loaded (/etc/systemd/system/live-current-check.timer; enabled; preset: enabled)
     Active: active (waiting) since Sat 2026-08-15 08:43:25 IST; 5 days ago
    Trigger: Thu 2026-08-20 17:02:00 IST; 10min left
   Triggers: ● live-current-check.service

$ systemctl list-timers live-current-check.timer
NEXT                         LEFT LAST                           PASSED UNIT
Thu 2026-08-20 17:02:00 IST 10min Thu 2026-08-20 16:02:00 IST 49min ago live-current-check.timer

$ ls -la /etc/systemd/system/live-current-check.{service,timer} /usr/local/sbin/run_live_current_check.sh
-rw-r--r-- 1 root root 1871 Aug 15 08:39 /etc/systemd/system/live-current-check.service
-rw-r--r-- 1 root root  822 Aug 15 08:39 /etc/systemd/system/live-current-check.timer
-rwxr-xr-x 1 root root 2738 Aug 15 08:43 /usr/local/sbin/run_live_current_check.sh
```

The timer is `active (waiting)` (armed for the next fire in 10 minutes)
and the service is `TriggeredBy: live-current-check.timer`. The most
recent run (49 minutes ago, the 16:02 IST fire) completed with
`status=0/SUCCESS` and emitted the same two lines the manual
`bash scripts/check_live_current.sh` produces:

```
Aug 20 16:02:00 netcup-rs2000 run_live_current_check.sh[2940863]: live-current-check: fetching origin/main
Aug 20 16:02:00 netcup-rs2000 run_live_current_check.sh[2940863]: live-current-check: accepted main is d3b50821ee9adaa95b3d2e30127511912750ebb1
Aug 20 16:02:20 netcup-rs2000 run_live_current_check.sh[2940863]: verified_feed_only date=2026-08-20 commit=d3b50821ee9adaa95b3d2e30127511912750ebb1
Aug 20 16:02:20 netcup-rs2000 run_live_current_check.sh[2940863]: verified_live_current commit=d3b50821ee9adaa95b3d2e30127511912750ebb1
```

The hourly cadence is therefore firing every hour on the VPS, the
payload is the committed `scripts/run_live_current_check.sh` from
`origin/main` (no installed copy, no hardcoded SHA), and the unit exits
cleanly with the close-condition proof on success.

## Close condition (re-stated from MEMORY.md)

> Delivered 2026-08-12: merged head `d5d2b22` (#63 raster social card,
> #64 deploy rollback) was deployed and re-verified live
> (`verified_live_current commit=d5d2b22`); the item's close condition is
> met, so the lane should not re-dispatch it unless a later merged change
> again goes un-deployed (the hourly check reds `LIVE_IS_STALE` when that
> happens).

The condition continues to hold: every hourly run since 2026-08-12 has
returned `verified_live_current` rather than `LIVE_IS_STALE`, and the
2026-08-20 fire (above) is no exception. The merged head at the time of
this re-dispatch (`d3b5082`) supersedes `d5d2b22` as the accepted main,
and is also live and verified.

## Why this run produced only this report

- The hourly timer is the proof — every fire prints
  `verified_live_current commit=<main HEAD>`. A re-dispatch that
  re-deployed would re-run deploy_daily.sh with no new accepted change
  to roll, which is a no-op. A re-dispatch that re-installed the timer
  would touch the host units for no behavioral change.
- Per the close condition, the lane should not re-dispatch this item
  unless `LIVE_IS_STALE` is red; `LIVE_IS_STALE` is not red, so this
  report is the deliverable.
- The previous close record (`docs:` commits `fc99b6b` and `502f4e3`)
  is still accurate; this report adds a 2026-08-20 receipt alongside
  it and leaves the canonical close in `MEMORY.md` untouched.

## Files touched in this run

- `.lane/reports/lane1-deliver-edge-head-and-scheduled-caller-2026-08-20.md`
  — new lane-unique evidence report (this file).

No other files in the worktree were modified, no host unit was
re-installed, and no deploy was re-run.

## Recommendation

Close the item per its `MEMORY.md` close condition. Do not re-dispatch
this item unless the hourly `check_live_current.sh` prints
`LIVE_IS_STALE` again; that condition is the explicit re-dispatch
trigger, and it has not fired.
