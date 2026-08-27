# Live parity — `scripts/verify_live.py` + `scripts/check_live_current.sh`

The byte-level proof the workergate + asset binding + feeds match the
accepted edition. This is the check the VPS hourly
`live-current-check.timer` runs every hour on its own scheduler
(PR #81 moved the cadence off GitHub's `schedule` events because
they were delivered late or not at all for hours at a time,
recurring since 2026-08-10).

## How users reach it

`scripts/check_live_current.sh` is the deploy-free, token-free parity
check. It fetches `origin/main` into a private cache clone
(`~/.cache/inish-live-current-check/main`), derives the accepted SHA
from `FETCH_HEAD`, archives the snapshot, and runs
`scripts/verify_live.py` against `https://inish.in/`. The verify
byte-compares every public path against the snapshot and additionally
compares `latest.json` and `feed.xml` whole against the accepted
edition. A stale live site fails the run loudly with the observed
date and story mismatch — never a generic byte difference.

The systemd unit is `install/live-current-check.service` and the
timer is `install/live-current-check.timer`. The wrapper is
`scripts/run_live_current_check.sh`. The unit type is `oneshot` and
the timer is hourly at `*:02`; an install path is `/etc/systemd/system/`.

## How to drive it

### Hourly VPS sweep (always running)

```bash
systemctl --user status live-current-check.timer
journalctl -u live-current-check.service --since -1h | tail -20
# Expect: status=0/SUCCESS with verified_live_current commit=<main HEAD>
```

### Ad-hoc live probe

```bash
ACCEPTED_SHA="$(git -C /home/nish/workspaces/products/inish-site rev-parse origin/main)"
SNAPSHOT_ROOT="$(mktemp -d)"
git -C /home/nish/workspaces/products/inish-site archive --format=tar origin/main \
    | tar -x -C "$SNAPSHOT_ROOT"
EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"
python3 scripts/verify_live.py \
    --root "$SNAPSHOT_ROOT" --edition-date "$EDITION_DATE" --commit "$ACCEPTED_SHA"
rm -rf "$SNAPSHOT_ROOT"
```

The verify refuses anything that is not a public HTTPS origin
(`--base` defaults to `https://inish.in/`). Any non-zero exit
indicates one or more of the public paths has drifted from the
accepted edition; the failure line names the specific path and the
observed-vs-expected diff.

## What proves success

- Every public path in `public-paths.json`'s `publicPaths` byte-matches
  the snapshot.
- Every font file in `fonts/*.woff2` byte-matches the snapshot
  (a missing font fails silently in the browser, so this is the
  only way to catch the regression).
- `latest.json` and `feed.xml` exactly match the accepted edition
  (date, story count, and content); a feed-only difference between
  expected and observed URLs is named in the failure line.
- The Cloudflare beacon script the live edge injects is stripped
  before comparison; the verifier never reports a phantom diff for
  the beacon's randomized integrity hash.

## Local honesty note

`verify_live.py` is live-only. The local launch's `/about.html`,
`/feed.xml`, and `/latest.json` 200s are real worker-driven 200s,
but the byte-level feed parity is only provable against the live
edge — the local binding's snapshot is staged from the same
`origin/main` the verify script archives, so a `diff` between them
would catch a contract drift the local launch would not. The VPS
timer is the always-on watch; the ad-hoc probe is the on-demand
override.
