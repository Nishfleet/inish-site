#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The deploy payload and the accepted edition are taken from a pristine snapshot
# of origin/main, never from the local checkout: the publisher workdir can
# legitimately sit on a topic branch (auto-ship refreshes PR branches there), and
# the old hard "must run from main + HEAD equals origin/main" gate turned exactly
# that into a multi-day live staleness stall. Fetching the accepted tree keeps
# the payload exact by construction and makes the deploy path independent of
# which branch the workdir happens to be on. The workdir still has to be a
# checkout of this repository so git can reach origin.
git fetch --quiet origin main
ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"

WORK_DIR="$(mktemp -d /tmp/inish-daily-deploy.XXXXXX)"
SNAPSHOT_ROOT="$WORK_DIR/snapshot"
PUBLIC_DIR="$WORK_DIR/public"
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
# The generated head points at the root share card (og:image/twitter:image) and
# the home-screen icon, so both must ride in the payload with the daily assets.
# data/editions and the rest of the tree stay out of the payload: archives are
# intentionally unpublished.
cp index.html 404.html app.js styles.css og-image.svg apple-touch-icon.png \
   latest.json feed.xml robots.txt sitemap.xml _redirects "$PUBLIC_DIR/"
cp -R "$SNAPSHOT_ROOT/functions" "$SNAPSHOT_ROOT/fonts" "$PUBLIC_DIR/"

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

(cd "$PUBLIC_DIR" && npx --yes wrangler pages deploy . \
  --project-name inish-site \
  --branch main \
  --commit-hash "$ACCEPTED_SHA" \
  --commit-message "Publish Nish Daily $EDITION_DATE" \
  --commit-dirty=false)

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
