#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Daily production deploy must run from main." >&2
  exit 1
fi
if [[ -n "$(git status --short)" ]]; then
  echo "Daily production deploy requires a clean worktree." >&2
  exit 1
fi

git fetch --quiet origin main
HEAD_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse FETCH_HEAD)"
if [[ "$HEAD_SHA" != "$REMOTE_SHA" ]]; then
  echo "Daily production deploy requires HEAD to equal origin/main." >&2
  exit 1
fi

EDITION_DATE="$(jq -er '.date' latest.json)"
STORY_COUNT="$(jq -er '.stories | length' latest.json)"
TODAY="$(TZ=Asia/Kolkata date +%F)"
if [[ "$EDITION_DATE" != "$TODAY" ]]; then
  echo "Refusing to publish stale edition: expected $TODAY, found $EDITION_DATE" >&2
  exit 1
fi
# A quiet day is a valid edition; the floor is deliberately zero.
if [[ "$STORY_COUNT" -lt 0 || "$STORY_COUNT" -gt 8 ]]; then
  echo "Invalid daily story count: $STORY_COUNT" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d /tmp/inish-daily-deploy.XXXXXX)"
PUBLIC_DIR="$WORK_DIR/public"
# shellcheck disable=SC2329  # Invoked by trap.
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$PUBLIC_DIR"
cp index.html 404.html app.js styles.css latest.json feed.xml robots.txt sitemap.xml _redirects "$PUBLIC_DIR/"
cp -R functions "$PUBLIC_DIR/"

(cd "$PUBLIC_DIR" && npx --yes wrangler pages deploy . \
  --project-name inish-site \
  --branch main \
  --commit-hash "$HEAD_SHA" \
  --commit-message "Publish Nish Daily $EDITION_DATE" \
  --commit-dirty=false)

for _ in {1..12}; do
  if python3 scripts/verify_live.py --root "$ROOT" --edition-date "$EDITION_DATE" --commit "$HEAD_SHA"; then
    hermes send --to telegram:1144372019 --quiet \
      "Nish Daily is live — $EDITION_DATE, $STORY_COUNT stories: https://inish.in/"
    echo "verified_live date=$EDITION_DATE stories=$STORY_COUNT commit=$HEAD_SHA"
    exit 0
  fi
  sleep 5
done

echo "Cloudflare deployed, but the custom domain failed the feed-only route checks." >&2
exit 1
