#!/usr/bin/env bash
# Hourly caller for check_live_current.sh that does not depend on GitHub
# Actions scheduling. GitHub's `schedule` events are delivered late or not
# at all for hours at a time (recurring on this repo since 2026-08-10, with
# 7+ hour silent gaps), so the hourly parity sweep cannot live there alone.
# This script is the payload for a systemd timer (install/live-current-check
# on the VPS) and runs the same parity check as the workflow.
#
# Everything is strict and loud: a failed fetch, a missing install (the
# check script is not installed on this host), or a stale live site all
# exit non-zero, so the unit fails and an operator can see it.
set -euo pipefail

# The unit runs as user nish (see install/live-current-check.service), whose
# git credential for github.com is the gh CLI helper — the same credential
# every fleet checkout uses. No new secret is created for this sweep.
CLONE_DIR="${CLONE_DIR:-$HOME/.cache/inish-live-current-check/main}"

echo "live-current-check: fetching origin/main"
# Create or repair the private origin/main clone. The repo is private, so
# the clone uses the invoking user's git credential (the gh helper). Clone
# into a temp dir and move into place so an interrupted clone can never
# leave a half-initialized repository that passes the guard below.
if ! git -C "$CLONE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  rm -rf "$CLONE_DIR" "$CLONE_DIR.tmp"
  mkdir -p "$CLONE_DIR.tmp"
  git clone --quiet --branch main --single-branch \
    https://github.com/nish3451/inish-site.git "$CLONE_DIR.tmp"
  mv "$CLONE_DIR.tmp" "$CLONE_DIR"
fi
git -C "$CLONE_DIR" fetch --quiet origin main
ACCEPTED_SHA="$(git -C "$CLONE_DIR" rev-parse FETCH_HEAD)"
echo "live-current-check: accepted main is $ACCEPTED_SHA"

# The whole point of the sweep is that origin/main is the truth, so the
# wrapper's own source must come from the accepted main, never from an
# installed copy that might be stale, local, or tampered. Materialize the
# check script into the clone's own scripts/ dir (the working tree stays
# pristine): the script resolves its repo root from its own path, so it
# must live inside the clone for `git fetch` and the verifier to resolve.
CHECK_PATH="$CLONE_DIR/scripts/check_live_current.sh"
if ! git -C "$CLONE_DIR" cat-file -e "$ACCEPTED_SHA:scripts/check_live_current.sh" 2>/dev/null; then
  echo "live-current-check: accepted main $ACCEPTED_SHA does not carry scripts/check_live_current.sh" >&2
  exit 1
fi
git -C "$CLONE_DIR" show "$ACCEPTED_SHA:scripts/check_live_current.sh" > "$CHECK_PATH"

# The check script resolves its repo root as its own parent, so it must run
# with the clone as the working directory.
cd "$CLONE_DIR"

exec bash "$CHECK_PATH"
