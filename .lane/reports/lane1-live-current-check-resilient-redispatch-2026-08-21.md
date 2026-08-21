# Lane 1 report — make the hourly Live current check resilient to the GitHub schedule stall (re-dispatch 2026-08-21)

Branch: `lane1/live-current-check-resilient-redispatch-2026-08-21`
Date: 2026-08-21

## Item

> make the hourly Live current check resilient to the recurring GitHub schedule stall that has now gone silent 7+ hours

## Verdict

**Already delivered — PR #81 (merged 2026-08-18, commit `1d082f5`) moved the hourly cadence off GitHub `schedule` onto the VPS systemd timer, and the timer has fired green every hour since 2026-08-15. This run is a re-verification receipt plus the durable close record MEMORY.md was missing, which is why the scout kept re-filing the item.**

## Evidence — the resilience is live

The VPS timer (`netcup-rs2000`) is armed and firing hourly, independent of GitHub scheduling:

```
$ systemctl status live-current-check.timer
● live-current-check.timer - Run the inish.in live-current parity check every hour
     Loaded: loaded (/etc/systemd/system/live-current-check.timer; enabled; preset: enabled)
     Active: active (waiting) since Sat 2026-08-15 08:43:25 IST; 5 days ago
    Trigger: Fri 2026-08-21 01:02:00 IST
   Triggers: ● live-current-check.service
```

```
$ systemctl status live-current-check.service
     Active: inactive (dead) since Fri 2026-08-21 00:02:23 IST; 18min ago
    Process: 2490895 ExecStart=/usr/local/sbin/run_live_current_check.sh (code=exited, status=0/SUCCESS)
```

Journal, every hour on `*:02`, no gap since install:

```
Aug 21 00:02:00 netcup-rs2000 run_live_current_check.sh[2490895]: live-current-check: fetching origin/main
Aug 21 00:02:01 netcup-rs2000 run_live_current_check.sh[2490895]: live-current-check: accepted main is 5b270e4353754ed98eeceef905f28bd3002bdc1b
Aug 21 00:02:23 netcup-rs2000 run_live_current_check.sh[2490895]: verified_feed_only date=2026-08-20 commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
Aug 21 00:02:23 netcup-rs2000 run_live_current_check.sh[2490895]: verified_live_current commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
```

The timer runs the committed wrapper from `origin/main`, never a hash-pinned or installed copy: the wrapper fetches into a private cache clone (`~/.cache/inish-live-current-check/main`), derives the accepted SHA from `FETCH_HEAD` (currently `5b270e4` = origin/main HEAD), materializes that commit's `scripts/check_live_current.sh`, and executes it. The installed host units are byte-identical to the repo copies (`diff` clean on all three: timer, service, wrapper).

The GitHub side is deliberately quiet — that is the fix, not a stall:

```
$ gh api repos/nish3451/inish-site/actions/workflows/live-current-check.yml/runs?per_page=5
148 completed schedule success 2026-08-18T20:23:33Z   <- last scheduled run
147...141 completed schedule cancelled
```

Run 148 (20:23Z) is the last scheduled run; PR #81 merged at 20:38Z on 2026-08-18, deleting the `schedule` trigger. The workflow is now manual-dispatch only (the runbook's pre-trust manual path). The last ~80 hourly runs all "cancelled" because the trigger was removed — no scheduled runs exist by design.

Fresh manual verification from this worktree (the same close-condition proof the close record names):

```
$ bash scripts/check_live_current.sh
verified_feed_only date=2026-08-20 commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
verified_live_current commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
check exit: 0
```

Full suite green (112 tests, including the four that pin the timer contract — `test_hourly_caller_*`, `test_hourly_schedule_lives_on_the_vps_timer_not_the_workflow`):

```
$ python3 -m unittest discover -s tests -v
Ran 112 tests in 0.673s
OK
```

## Why this lane was dispatched again, and what closes it

- The dispatch ledger shows this same item (`lane-worker-inish-site-1`) ran four times on 2026-08-20, all `rc=0` "already done" receipts — a stale-item re-dispatch loop.
- The root cause: PR #81's delivery was never recorded in `MEMORY.md`, which still said (verbatim, until this run) "the check gets its scheduled caller from the `Live current check` workflow". The scout reads MEMORY.md, so it kept re-filing "no scheduled caller" and the controller kept re-dispatching.
- This run records the delivery durably: a new MEMORY.md bullet pins PR #81's removal of the `schedule` trigger, the timer chain, the install paths, the FETCH_HEAD-not-hash contract, and the explicit re-dispatch rule (only a failed/missed timer unit).

## Files touched in this run

- `MEMORY.md` — records PR #81's delivery of the VPS-timer hourly cadence and the close condition, so the scout stops re-filing this item.
- `.lane/reports/lane1-live-current-check-resilient-redispatch-2026-08-21.md` — this lane-unique evidence receipt.

No host units were re-installed (installed copies already byte-identical), no deploy was run, and no check script behavior was changed.

## Recommendation

Close the item as done. Do not re-dispatch unless `live-current-check.service` fails or a fire is missed (`systemctl --failed`, `journalctl -u live-current-check.service`); a stale live site is the check's job to surface, not a reason to re-open this item. (PR #91, an open enhancement for paused-mode while dailies are paused, is a separate item.)
