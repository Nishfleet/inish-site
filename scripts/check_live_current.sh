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
# PAUSED MODE: when the accepted edition (origin/main) is newer than what the
# live hostname serves (Hermes dailies paused, no deploy happening), the check
# gracefully verifies live against the LAST deployed edition instead of failing
# on the unpublished edition. Full strictness resumes automatically when the
# daily pipeline catches up.
#
# Exit 0 with "verified_live_current" when live matches the expected edition;
# exit 1 with "LIVE_IS_STALE" and the failing stage(s) otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git fetch --quiet origin main
ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"

WORK_DIR="$(mktemp -d /tmp/inish-live-check.XXXXXX)"
SNAPSHOT_ROOT="$WORK_DIR/snapshot"
# shellcheck disable=SC2317  # Invoked by trap.
cleanup() {
  rm -rf "$WORK_DIR" "${LAST_DIR:-}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$SNAPSHOT_ROOT"
# The expected content is read from the fetched snapshot, never from the local
# checkout, so a workdir left on a topic branch cannot fake a green check.
git archive --format=tar FETCH_HEAD | tar -x -C "$SNAPSHOT_ROOT"

EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"

# Snapshot root and metadata for the edition we will actually verify against.
# Default: the accepted origin/main edition (normal mode). Paused mode may
# redirect to the last deployed edition.
VERIFY_SNAPSHOT="$SNAPSHOT_ROOT"
VERIFY_COMMIT="$ACCEPTED_SHA"
VERIFY_DATE="$EDITION_DATE"

# Read the live edition date. A failed fetch (network blip, live hostname down)
# is NOT paused mode — fail the check so a transient outage is visible.
LIVE_FETCH_OUTPUT="$(curl -fsS --max-time 15 https://inish.in/latest.json 2>&1 || true)"
LIVE_EDITION_DATE="$(echo "$LIVE_FETCH_OUTPUT" | jq -er '.date' 2>/dev/null || true)"

if [[ -z "$LIVE_EDITION_DATE" ]]; then
  # Live is unreachable or unreadable — same hard failure as before.
  :  # fall through to normal verification; verify_live.py will fail on fetch
elif [[ "$EDITION_DATE" > "$LIVE_EDITION_DATE" ]]; then
  # PAUSED MODE: the accepted edition (origin/main) is newer than what the
  # live hostname serves. This happens when Hermes dailies are paused — the
  # publisher isn't running. Instead of failing, verify live against the last
  # deployed edition.
  #
  # Resolve the commit that PUBLISHED the edition live is serving — the same
  # "daily: publish <date>" convention deploy_daily.sh uses to recover the
  # pre-deploy snapshot for a rollback. That commit's full tree is the exact
  # payload that went live for that edition, so verifying against it is the
  # honest check: real drift from the deployed state still fails, while an
  # unpublished-but-merged edition stays quiet.
  LAST_COMMIT="$(git log --format='%H' --max-count=1 FETCH_HEAD --grep="^daily: publish ${LIVE_EDITION_DATE}" || true)"

  if [[ -z "$LAST_COMMIT" ]]; then
    echo "PAUSED_MODE_NO_PREVIOUS: live serves $LIVE_EDITION_DATE but no 'daily: publish $LIVE_EDITION_DATE' commit is reachable on origin/main — cannot verify the last deployed edition" >&2
    echo "The accepted edition ($EDITION_DATE) is not live and the last deployed edition ($LIVE_EDITION_DATE) cannot be verified." >&2
    exit 1
  fi

  LAST_DIR="$(mktemp -d /tmp/inish-live-paused.XXXXXX)"
  git archive --format=tar "$LAST_COMMIT" | tar -x -C "$LAST_DIR"
  VERIFY_SNAPSHOT="$LAST_DIR"
  VERIFY_COMMIT="$LAST_COMMIT"
  VERIFY_DATE="$LIVE_EDITION_DATE"

  echo "PAUSED_MODE: accepted edition ($EDITION_DATE) is newer than live ($LIVE_EDITION_DATE); verifying live against last deployed edition ($LAST_COMMIT)" >&2
elif [[ "$EDITION_DATE" < "$LIVE_EDITION_DATE" ]]; then
  echo "LIVE_AHEAD: live serves $LIVE_EDITION_DATE which is newer than the accepted edition $EDITION_DATE" >&2
  echo "This should not happen — the deployment pipeline must keep live in sync with origin/main." >&2
  exit 1
fi

# verify_live.py byte-compares every public payload file, both canonical feeds
# whole, HEAD methods, redirects, removed routes, fonts, and metadata against
# the appropriate snapshot. A stale or drifted live hostname fails with named
# stages.
if ! VERIFY_OUTPUT="$(python3 scripts/verify_live.py \
    --root "$VERIFY_SNAPSHOT" --edition-date "$VERIFY_DATE" --commit "$VERIFY_COMMIT" 2>&1)"; then
  echo "LIVE_IS_STALE: the live hostname does not match $(if [[ "$VERIFY_SNAPSHOT" != "$SNAPSHOT_ROOT" ]]; then echo 'the last deployed edition'; else echo 'origin/main'; fi) ($VERIFY_COMMIT)" >&2
  printf '%s\n' "$VERIFY_OUTPUT" >&2
  echo "Deploy the accepted edition (scripts/deploy_daily.sh, or the daily publisher job) and re-run this check." >&2
  exit 1
fi

echo "$VERIFY_OUTPUT"
echo "verified_live_current commit=$VERIFY_COMMIT"
