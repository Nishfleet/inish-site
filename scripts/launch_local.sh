#!/usr/bin/env bash
# Launch a deterministic, no-credentials local instance of the inish.in edge
# (Worker + static assets) on 127.0.0.1, suitable for the verify harness
# DOCTOR / DRIVE / EVIDENCE steps.
#
# Why this exists:
#   - worker.js (the live edge) imports functions/policy.js, which imports
#     ../public-paths.json. The shipped JSON points canonicalOrigin at
#     https://inish.in/, so a bare wrangler dev URL would 301 to the live
#     site instead of serving a local body.
#   - The local launch needs both a different canonicalOrigin and a small
#     URL-rewrite shim (worker-local.js) that maps "/" to "/index.html" and
#     forwards the loopback request to the production worker with a URL the
#     worker's canonicalize() check accepts.
#   - This script never edits the repo, never touches Cloudflare, never
#     reads the fleet token, and never leaves state under the repo tree.
#     The temp dir is removed on EXIT (or by the caller via the CLEANUP
#     section of the harness).
#
# Usage:
#   scripts/launch_local.sh                  # default port 4891
#   scripts/launch_local.sh 4910             # custom port
#
# Output (stdout, machine-readable):
#   PID=<pid> BASE_URL=http://127.0.0.1:<port>/ TEMPDIR=<path>
#
# Stop the server with:
#   kill -- -$(ps -o pgid= -p <pid> | tr -d ' ')
set -Eeuo pipefail

PORT="${1:-4891}"
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
    echo "launch_local: PORT must be an integer 1024..65535 (got '$PORT')" >&2
    exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Lint the contract the worker is about to import. A malformed JSON would
# crash the worker on the first request and the harness would then read
# 301s as a launch failure instead of a route contract bug.
python3 -c "import json, sys; json.load(open('public-paths.json'))" \
    || { echo "launch_local: public-paths.json is not valid JSON" >&2; exit 1; }

WORK_DIR="$(mktemp -d /tmp/verify-inish-site.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$WORK_DIR/public" "$WORK_DIR/functions"

# Static payload. _redirects lives under public/ so the Workers ASSETS
# binding treats it as a static asset the same way the live site does.
for f in 404.html about.html app.js apple-touch-icon.png feed.xml \
         index.html latest.json llms.txt og-image.png og-image.svg \
         robots.txt sitemap.xml styles.css _redirects; do
    cp "$f" "$WORK_DIR/public/$f"
done
cp -r fonts "$WORK_DIR/public/fonts"

# Edge entrypoint and policy module. Both are byte-identical to the
# shipped files; the contract is the only thing that changes, and only
# the canonicalOrigin value (https://inish.in/ -> http://127.0.0.1:PORT/).
cp worker.js "$WORK_DIR/worker.js"
cp functions/policy.js "$WORK_DIR/functions/policy.js"
cp .local-e2e-template/worker-local.js "$WORK_DIR/worker-local.js"

# Rewritten contract: same publicPaths/fontPath/redirects/securityHeaders,
# different canonicalOrigin. jq is the only way to keep the field order
# and formatting identical to the shipped JSON; sed and python -c both
# misformat it.
jq --arg origin "http://127.0.0.1:${PORT}/" \
   '.canonicalOrigin = $origin' public-paths.json > "$WORK_DIR/public-paths.json"

# wrangler config. main=worker-local.js (the shim), assets.directory=./public
# — same shape as wrangler.jsonc minus the routes (no apex pattern to forward
# locally) and without the Workers.dev preview flag.
cat > "$WORK_DIR/wrangler.local.jsonc" <<EOF
{
  "name": "inish-site-local",
  "main": "worker-local.js",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "run_worker_first": ["/*"],
    "html_handling": "none"
  }
}
EOF

# Workerd is a multi-process server; the parent shell PID is the only one
# `kill -- -PID` propagates SIGINT to. Capture it before backgrounding.
cd "$WORK_DIR"
npx --yes wrangler dev \
    --port "$PORT" --ip 127.0.0.1 --local \
    --config wrangler.local.jsonc --log-level error \
    > "$WORK_DIR/wrangler.log" 2>&1 &
WRPID=$!

# Wait up to 90s for the local worker to be listening. The first request
# can be slow because wrangler downloads workerd on cold start; 90s is
# well above the cold-start median but still bounded. Readiness is
# probed via /about.html (200) because the local binding serves literal
# asset paths only — see SKILL.md for the documented divergence on "/".
READY=0
for _ in $(seq 1 180); do
    sleep 0.5
    if curl -fsS -o /dev/null -w "%{http_code}" \
            "http://127.0.0.1:${PORT}/about.html" 2>/dev/null \
            | grep -q '^200$'; then
        READY=1
        break
    fi
    if ! kill -0 "$WRPID" 2>/dev/null; then
        echo "launch_local: wrangler exited before readiness" >&2
        cp -f "$WORK_DIR/wrangler.log" /tmp/launch_local_last.log 2>/dev/null || true
        sed 's/^/wrangler: /' /tmp/launch_local_last.log >&2 || true
        exit 1
    fi
done

if (( READY != 1 )); then
    echo "launch_local: server did not become ready on http://127.0.0.1:${PORT}/about.html within 90s" >&2
    cp -f "$WORK_DIR/wrangler.log" /tmp/launch_local_last.log 2>/dev/null || true
    sed 's/^/wrangler: /' /tmp/launch_local_last.log >&2 || true
    kill -- -"$(ps -o pgid= -p "$WRPID" | tr -d ' ')" 2>/dev/null || true
    exit 1
fi

echo "PID=$WRPID BASE_URL=http://127.0.0.1:${PORT}/ TEMPDIR=$WORK_DIR"
# Keep the trap from removing the temp dir while the caller is using it.
trap - EXIT
