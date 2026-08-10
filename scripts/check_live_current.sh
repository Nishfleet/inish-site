#!/usr/bin/env bash
# Verify the live hostname currently serves the accepted origin/main edition,
# without deploying anything.
#
# deploy_daily.sh only verifies at deploy time, so a daily publisher run that
# never fires (a missed schedule, a stalled agent job) leaves the live site
# silently stale until the next deploy happens to run. This check closes that
# blind spot: it compares the live hostname byte-for-byte against a pristine
# snapshot of origin/main fetched fresh inside the script — the same snapshot
# machinery deploy_daily.sh uses — and fails loudly with the named stale files
# and routes. It never deploys, never touches Cloudflare credentials, and needs
# no token, so any scheduled job or loop can run it.
#
# Exit 0 with "verified_live_current" when live matches origin/main; exit 1
# with "LIVE_IS_STALE" and the failing stage(s) otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git fetch --quiet origin main
ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"

WORK_DIR="$(mktemp -d /tmp/inish-live-check.XXXXXX)"
SNAPSHOT_ROOT="$WORK_DIR/snapshot"
# shellcheck disable=SC2317  # Invoked by trap.
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$SNAPSHOT_ROOT"
# The expected content is read from the fetched snapshot, never from the local
# checkout, so a workdir left on a topic branch cannot fake a green check.
git archive --format=tar FETCH_HEAD | tar -x -C "$SNAPSHOT_ROOT"

EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"

# verify_live.py byte-compares every public payload file, both canonical feeds
# whole, HEAD methods, redirects, removed routes, fonts, and metadata against
# the snapshot. A stale or drifted live hostname fails with named stages.
if ! VERIFY_OUTPUT="$(python3 scripts/verify_live.py \
    --root "$SNAPSHOT_ROOT" --edition-date "$EDITION_DATE" --commit "$ACCEPTED_SHA" 2>&1)"; then
  echo "LIVE_IS_STALE: the live hostname does not match origin/main ($ACCEPTED_SHA)" >&2
  printf '%s\n' "$VERIFY_OUTPUT" >&2
  echo "Deploy the accepted edition (scripts/deploy_daily.sh, or the daily publisher job) and re-run this check." >&2
  exit 1
fi

echo "$VERIFY_OUTPUT"
echo "verified_live_current commit=$ACCEPTED_SHA"
