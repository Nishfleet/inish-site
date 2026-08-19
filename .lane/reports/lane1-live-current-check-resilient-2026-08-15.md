# Lane 1 report — make the hourly Live current check resilient to the GitHub schedule stall

Branch: `lane1-live-current-check-resilient` · PR: https://github.com/nish3451/inish-site/pull/81 · Date: 2026-08-15

## What was done

The hourly Live current check no longer depends on GitHub's `schedule` events, which are
delivered late or not at all for hours at a time (recurring on this repo since 2026-08-10,
with 7+ hour silent gaps). The hourly cadence now runs on the VPS's own systemd timer:

- `scripts/run_live_current_check.sh` — timer payload. Fetches `origin/main` fresh into a
  private cache clone, derives the accepted SHA from `FETCH_HEAD`, and runs that commit's
  `check_live_current.sh` (never a hardcoded hash, never an installed copy). Fails loudly
  on fetch failure, missing install, or `LIVE_IS_STALE`.
- `install/live-current-check.timer` — hourly, `OnCalendar=*:2`, `Persistent=true`
  (the `:02` offset keeps history comparable with the old `:00` GitHub cron while never
  racing it).
- `install/live-current-check.service` — oneshot, `User=nish` (the repo is private, so the
  clone uses the same gh CLI credential every fleet checkout uses; no new secret), fails
  loudly without restart loops.
- `.github/workflows/live-current-check.yml` — now manual-dispatch only; the `schedule`
  trigger is removed so the Actions scheduler can never silently stall the sweep again.
- `automation/HERMES_DAILY.md` — runbook updated with the timer as the scheduler and the
  recovery path for a failed sweep.
- `tests/test_check_live_current.py` — four new tests pin the contracts: committed payload
  referenced by the unit, accepted-main (not hash-pinned) check execution, no deploy/token,
  and no `schedule:` in the workflow.

## Verification

- `sudo systemctl start live-current-check.service` runs the full parity verifier; it
  correctly failed with `LIVE_IS_STALE` (the live hostname is currently behind
  `origin/main` at `887eeb7` — a deploy is pending, which is exactly what the check exists
  to surface loudly).
- `systemctl list-timers live-current-check.timer` shows the hourly sweep armed; first
  scheduled fire 09:02 IST.
- The timer/service are installed and enabled on the VPS (`netcup-rs2000`) as
  `/etc/systemd/system/live-current-check.{service,timer}` and `/usr/local/sbin/
  run_live_current_check.sh`.
- Full test suite: 106 tests pass (`python3 -m unittest discover -s tests -v`).

## Design decisions worth recording

- **Hash pin rejected in favor of FETCH_HEAD**: an initial version pinned a commit hash, but
  a stale pin makes the sweep fail permanently until a human bumps it — reintroducing the
  silent-gap risk this item exists to close. The accepted-main fetch (`git fetch origin main`
  → `rev-parse FETCH_HEAD`) is the same truth contract `check_live_current.sh` and
  `deploy_daily.sh` already use, so the wrapper stays honest with both.
- **`User=nish` instead of DynamicUser**: the repo is private; a DynamicUser had no
  credential and the anonymous clone prompted for a username. The fleet runner units and the
  0509-liveness precedent both show sandboxes need an explicit credential path; using the
  host operator user reuses the existing gh credential with no new secret.
- **VPS read-only-FS episodes**: `/opt` and `/srv` are persistently read-only on this host
  (part of the recurring read-only-FS condition MEMORY.md documents). The clone lives under
  `~/.cache` (writable); an RO episode fails the unit loudly rather than silently skipping.

## Out of scope

Deploying the currently-accepted edition (`887eeb7`) to make the check go green is an
operational deploy (`scripts/deploy_daily.sh` / daily publisher), not this lane's change.
The hourly timer is deliberately independent of CI and the deploy path.
