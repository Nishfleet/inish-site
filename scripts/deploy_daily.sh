#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load the VPS fleet Cloudflare token when the environment has none.
# Preference order:
#   1. CLOUDFLARE_API_TOKEN already exported
#   2. fleet-console/cf.env (Workers-capable token used by fleet-release)
#   3. ~/.inish-cf-token (Pages:Edit drop-file; optional, kept for recovery)
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if [[ -r /home/nish/.config/fleet-console/cf.env ]]; then
    # shellcheck disable=SC1091
    set -a
    source /home/nish/.config/fleet-console/cf.env
    set +a
  fi
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -r "${INISH_CF_TOKEN_FILE:-/home/nish/.inish-cf-token}" ]]; then
  CLOUDFLARE_API_TOKEN="$(tr -d '[:space:]' < "${INISH_CF_TOKEN_FILE:-/home/nish/.inish-cf-token}")"
  export CLOUDFLARE_API_TOKEN
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "No Cloudflare API token: set CLOUDFLARE_API_TOKEN, provide fleet-console/cf.env, or write ~/.inish-cf-token" >&2
  exit 1
fi

# The deploy payload and the accepted edition are taken from a pristine snapshot
# of origin/main, never from the local checkout: the publisher workdir can
# legitimately sit on a topic branch, and the old hard "must run from main +
# HEAD equals origin/main" gate turned exactly that into a multi-day live
# staleness stall. Fetching the accepted tree keeps the payload exact by
# construction and makes the deploy path independent of which branch the
# workdir happens to be on. The workdir still has to be a checkout of this
# repository so git can reach origin.
git fetch --quiet origin main
ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"

WORK_DIR="$(mktemp -d /tmp/inish-daily-deploy.XXXXXX)"
SNAPSHOT_ROOT="$WORK_DIR/snapshot"
DEPLOY_ROOT="$WORK_DIR/deploy"
PUBLIC_DIR="$DEPLOY_ROOT/public"
# shellcheck disable=SC2329  # Invoked by trap.
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$SNAPSHOT_ROOT" "$PUBLIC_DIR"
# Extract the accepted origin/main tree. The verifier reads the expected content
# from the same snapshot, so uncommitted or topic-branch files cannot leak into
# what gets deployed or verified.
git archive --format=tar FETCH_HEAD | tar -x -C "$SNAPSHOT_ROOT"

# Root static assets referenced by the generated head, plus the daily feed
# surface. Copied ONLY from the snapshot — never from the workdir CWD.
# data/editions and the rest of the tree stay out of the payload: archives are
# intentionally unpublished. functions/ is not shipped as static assets; the
# edge logic lives in worker.js.
cp "$SNAPSHOT_ROOT/index.html" "$SNAPSHOT_ROOT/404.html" \
   "$SNAPSHOT_ROOT/app.js" "$SNAPSHOT_ROOT/styles.css" \
   "$SNAPSHOT_ROOT/og-image.svg" "$SNAPSHOT_ROOT/og-image.png" "$SNAPSHOT_ROOT/apple-touch-icon.png" \
   "$SNAPSHOT_ROOT/latest.json" "$SNAPSHOT_ROOT/feed.xml" \
   "$SNAPSHOT_ROOT/robots.txt" "$SNAPSHOT_ROOT/sitemap.xml" \
   "$SNAPSHOT_ROOT/_redirects" \
   "$PUBLIC_DIR/"
cp -R "$SNAPSHOT_ROOT/fonts" "$PUBLIC_DIR/"
# Worker + wrangler config are the live edge path (Workers assets + routes).
cp "$SNAPSHOT_ROOT/worker.js" "$SNAPSHOT_ROOT/wrangler.jsonc" "$DEPLOY_ROOT/"

EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"
STORY_COUNT="$(jq -er '.stories | length' "$SNAPSHOT_ROOT/latest.json")"
# A quiet day is a valid edition; the floor is deliberately zero.
if [[ "$STORY_COUNT" -lt 0 || "$STORY_COUNT" -gt 8 ]]; then
  echo "Invalid daily story count: $STORY_COUNT" >&2
  exit 1
fi

# Freshness gate: never roll the live site back to an older edition. The accepted
# edition may legitimately be older than today when the daily content owner is
# closed and this deploy is catching the site up to the last accepted edition;
# what must never happen is publishing content older than what is live. Whole
# live parity (date and story set) is still enforced loudly afterwards by
# verify_live.py, which is also what stops a same-date content drift.
if ! LIVE_EDITION_DATE="$(curl -fsS --max-time 15 https://inish.in/latest.json | jq -er '.date')"; then
  echo "live_read: cannot read the current live edition from https://inish.in/latest.json" >&2
  exit 1
fi
if [[ "$EDITION_DATE" < "$LIVE_EDITION_DATE" ]]; then
  echo "Refusing to roll the live site back: live serves $LIVE_EDITION_DATE, accepted edition is $EDITION_DATE" >&2
  exit 1
fi

# npx and Wrangler write their cache and debug logs to home-directory defaults
# (~/.npm, ~/.wrangler/logs) unless told otherwise. This VPS has recurring
# read-only-FS episodes where exactly those paths return EROFS; a deploy that
# cannot write its own caches strands the accepted edition until the next run
# (observed 2026-08-09: the edition merged but the deploy preflight tripped).
# Keep the defaults when they are writable so the warm npx cache is reused;
# otherwise relocate both into the per-run temp directory, which is rebuilt
# under /tmp on every deploy and never carries state between runs.
if [[ ! -w "${npm_config_cache:-$HOME/.npm}" ]]; then
  export npm_config_cache="$WORK_DIR/npm-cache"
  mkdir -p "$npm_config_cache"
fi
if [[ ! -w "${WRANGLER_LOG_PATH:-$HOME/.wrangler/logs}" ]]; then
  export WRANGLER_LOG_PATH="$WORK_DIR/wrangler-logs"
  mkdir -p "$WRANGLER_LOG_PATH"
fi

# Workers deploy (not Pages). The fleet token has Workers + DNS write but not
# Pages:Edit; Pages OAuth on this host expired 2026-08-04 and is non-refreshable
# without an interactive login.
#
# A failed deploy is otherwise not retried until the next daily run, so the
# accepted edition would sit un-deployed for a day on a transient failure (a
# read-only window, a network blip). Retry the same payload a bounded number of
# times and fail loudly only after the last attempt.
DEPLOY_ATTEMPTS=3
DEPLOY_FAILURE=""
for attempt in $(seq 1 "$DEPLOY_ATTEMPTS"); do
  if (cd "$DEPLOY_ROOT" && npx --yes wrangler deploy \
      --message "Publish Nish Daily $EDITION_DATE ($ACCEPTED_SHA)"); then
    DEPLOY_FAILURE=""
    break
  fi
  DEPLOY_FAILURE="wrangler deploy failed (attempt $attempt/$DEPLOY_ATTEMPTS)"
  if [[ "$attempt" -lt "$DEPLOY_ATTEMPTS" ]]; then
    echo "$DEPLOY_FAILURE; retrying in 20 seconds" >&2
    sleep 20
  fi
done
if [[ -n "$DEPLOY_FAILURE" ]]; then
  echo "$DEPLOY_FAILURE" >&2
  exit 1
fi

VERIFY_STAGE=""
for _ in {1..12}; do
  if VERIFY_STAGE="$(python3 scripts/verify_live.py --root "$SNAPSHOT_ROOT" --edition-date "$EDITION_DATE" --commit "$ACCEPTED_SHA" 2>&1)"; then
    hermes send --to telegram:1144372019 --quiet \
      "Nish Daily is live — $EDITION_DATE, $STORY_COUNT stories: https://inish.in/"
    echo "verified_live date=$EDITION_DATE stories=$STORY_COUNT commit=$ACCEPTED_SHA"
    exit 0
  fi
  sleep 5
done

echo "Cloudflare deployed, but the accepted edition failed live verification. Failing stage:" >&2
printf '%s\n' "$VERIFY_STAGE" >&2
echo "The accepted edition in the repository was left untouched; it is NOT confirmed live." >&2
exit 1
