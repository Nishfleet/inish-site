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

EDITION_DATE="$(jq -er '.date' daily/latest.json)"
STORY_COUNT="$(jq -er '.stories | length' daily/latest.json)"
TODAY="$(TZ=Asia/Kolkata date +%F)"
if [[ "$EDITION_DATE" != "$TODAY" ]]; then
  echo "Refusing to publish stale edition: expected $TODAY, found $EDITION_DATE" >&2
  exit 1
fi
if [[ "$STORY_COUNT" -lt 5 || "$STORY_COUNT" -gt 15 ]]; then
  echo "Invalid daily story count: $STORY_COUNT" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d /tmp/inish-daily-deploy.XXXXXX)"
PUBLIC_DIR="$WORK_DIR/public"
LIVE_JSON="$WORK_DIR/live.json"
# shellcheck disable=SC2329  # Invoked by trap.
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$PUBLIC_DIR"
cp index.html llms.txt robots.txt sitemap.xml "$PUBLIC_DIR/"
cp -R daily functions "$PUBLIC_DIR/"

(cd "$PUBLIC_DIR" && npx --yes wrangler pages deploy . \
  --project-name inish-site \
  --branch main \
  --commit-hash "$HEAD_SHA" \
  --commit-message "Publish Nish Daily $EDITION_DATE" \
  --commit-dirty=false)

SENSITIVE_PATHS=(
  "AGENTS.md"
  "MEMORY.md"
  "ERRORS.md"
  "automation/HERMES_DAILY.md"
  "scripts/build_daily.py"
  "tests/test_build_daily.py"
  "data/editions/$EDITION_DATE.json"
  "data/candidates/$EDITION_DATE.json"
)

private_paths_are_hidden() {
  local sensitive_path status
  for sensitive_path in "${SENSITIVE_PATHS[@]}"; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
      "https://inish.in/$sensitive_path?deploy=$HEAD_SHA")"
    if [[ "$status" != "404" ]]; then
      return 1
    fi
  done
}

for _ in {1..12}; do
  if curl -fsS --max-time 15 https://inish.in/daily/latest.json >"$LIVE_JSON" 2>/dev/null \
    && diff -q <(jq -S . daily/latest.json) <(jq -S . "$LIVE_JSON") >/dev/null \
    && private_paths_are_hidden; then
    hermes send --to telegram:1144372019 --quiet \
      "Nish Daily is live — $EDITION_DATE, $STORY_COUNT stories: https://inish.in/daily/"
    echo "verified_live date=$EDITION_DATE stories=$STORY_COUNT commit=$HEAD_SHA"
    exit 0
  fi
  sleep 5
done

echo "Cloudflare deployed, but the custom domain did not match daily/latest.json." >&2
exit 1
