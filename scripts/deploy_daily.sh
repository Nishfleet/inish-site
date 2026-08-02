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

HEAD_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"
if [[ "$HEAD_SHA" != "$REMOTE_SHA" ]]; then
  echo "Daily production deploy requires HEAD to equal origin/main." >&2
  exit 1
fi

EDITION_DATE="$(jq -er '.date' daily/latest.json)"
STORY_COUNT="$(jq -er '.stories | length' daily/latest.json)"
if [[ "$STORY_COUNT" -lt 5 || "$STORY_COUNT" -gt 15 ]]; then
  echo "Invalid daily story count: $STORY_COUNT" >&2
  exit 1
fi

wrangler pages deploy . \
  --project-name inish-site \
  --branch main \
  --commit-hash "$HEAD_SHA" \
  --commit-message "Publish Nish Daily $EDITION_DATE" \
  --commit-dirty=false

LIVE_JSON="$(mktemp /tmp/inish-daily-live.XXXXXX.json)"
# shellcheck disable=SC2329  # Invoked by trap.
cleanup() {
  rm -f "$LIVE_JSON"
}
trap cleanup EXIT INT TERM

for _ in {1..12}; do
  if curl -fsS --max-time 15 https://inish.in/daily/latest.json >"$LIVE_JSON" 2>/dev/null \
    && diff -q <(jq -S . daily/latest.json) <(jq -S . "$LIVE_JSON") >/dev/null; then
    hermes send --to telegram:1144372019 --quiet \
      "Nish Daily is live — $EDITION_DATE, $STORY_COUNT stories: https://inish.in/daily/"
    echo "verified_live date=$EDITION_DATE stories=$STORY_COUNT commit=$HEAD_SHA"
    exit 0
  fi
  sleep 5
done

echo "Cloudflare deployed, but the custom domain did not match daily/latest.json." >&2
exit 1
