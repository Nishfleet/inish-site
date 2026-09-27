---
name: verify-inish-site
description: Launch, health-check, drive, and prove the inish.in edge (Nish's Daily Reads feed) locally. Use before claiming any inish.in change works end-to-end.
---

inish.in (repo `inish-site`) is a static HTML/CSS/JS feed served by a single
Cloudflare Worker (`worker.js`) on `workers.dev` + the `inish.in` apex, with
asset binding `ASSETS` rooted at the deployed `public/` directory. The
public route contract — `publicPaths`, `fontPath`, `redirects`, `hstsHeader`,
`securityHeaders` — has one source of truth: `public-paths.json`. `worker.js`
and the kept-in-sync Pages mirror `functions/_middleware.js` both import
`functions/policy.js`, which reads the contract and exposes the deny/allow/
redirect decision as a pure function.

Agents doing E2E verification MUST use this harness instead of improvising
a launch, and whoever ships a feature updates the matching file in
`features/` in the same PR.

## LAUNCH

### Primary — local Worker via `npm run dev` (use this)

```bash
npm run dev > /tmp/verify-inish-site.log 2>&1 &
echo $! > /tmp/verify-inish-site.pid
```

`npm run dev` runs `npx --yes wrangler dev --config .local-e2e-template/wrangler.local.jsonc --ip 127.0.0.1 --port 4891 --persist-to /tmp/verify-inish-site-state`. That config's `main` is `.local-e2e-template/worker-local.js`, a URL-rewrite shim that imports the production `worker.js` and re-emits each loopback request with a `https://inish.in/` URL so `canonicalize()` accepts it. Its asset directory is the repo root, filtered by `.assetsignore` to exactly the deployed payload. It has no apex routes and stages nothing. `--persist-to` keeps wrangler's local state outside the repo: the asset watcher ignores nothing, so state writes inside the watched directory would reload-loop the server forever.

- BASE_URL is `http://127.0.0.1:4891/`.
- Readiness: poll `curl -fsS http://127.0.0.1:4891/about.html` every 500ms for up to 90s until it returns 200. Probe `/about.html`, not `/` (see EVIDENCE / Known local divergences). The feed surfaces (`/feed.xml`, `/latest.json`, `/sitemap.xml`, `/llms.txt`, `/about.html`, the fonts, the raster social card) all serve 200 once the worker is listening.
- Redirects answer with the canonical `https://inish.in/` origin in `Location` (see `features/legacy-redirects.md`).
- Loopback only — never expose this to a non-loopback interface.

### Secondary — real production edge (live E2E)

For a live probe the harness uses `inish_daily/verify_live.py` directly:

```bash
ACCEPTED_SHA="$(git -C /home/nish/workspaces/products/inish-site rev-parse origin/main)"
SNAPSHOT_ROOT="$(mktemp -d)"
git -C /home/nish/workspaces/products/inish-site archive --format=tar origin/main \
    | tar -x -C "$SNAPSHOT_ROOT"
EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"
python3 -m inish_daily.verify_live \
    --root "$SNAPSHOT_ROOT" --edition-date "$EDITION_DATE" --commit "$ACCEPTED_SHA"
rm -rf "$SNAPSHOT_ROOT"
```

`verify_live.py` refuses anything that is not a public HTTPS origin (`--base`
must be `https://` with a real netloc). The live E2E is the byte-level
proof the workergate + asset binding + feeds match the accepted edition;
the local E2E above is the fast inner loop for deny/allow/redirect.

### Deterministic in-process proof (no wrangler)

`tests/test_worker_edge.test.mjs` imports the production `worker.js`
default export and drives it directly with a recording `ASSETS` stub.
This is the same test the repo's required `test` workflow runs
(`.github/workflows/tests.yml`); it proves the deny branch, the redirect
branch, the security headers, and the font cache behavior with no
network at all. For a 30-second "is the worker broken?" loop:

```bash
node --test tests/test_worker_edge.test.mjs
```

### Never

- `npx wrangler dev` against the production `wrangler.jsonc` (without
  `worker-local.js`) — the canonicalize redirect bounces every loopback
  request to the live site.
- `npm run preview` — there is no Vite; the `test` script is a
  `node --test` wrapper, not a static-file server.
- `python3 -m http.server` — it serves the public dir but bypasses the
  worker's deny/redirect/security logic, so a passing probe says nothing
  about the live edge.

## DOCTOR

The full local launch is healthy when every check below passes. The
live edge has the same checks with the live divergence on `/` resolved.

```bash
BASE=http://127.0.0.1:4891
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/about.html"   # 200
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/feed.xml"     # 200
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/latest.json"  # 200
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/sitemap.xml"  # 200
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/llms.txt"     # 200
curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/fonts/archivo-700.woff2"   # 200
curl -s  -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/admin"         # 404 (deny)
curl -sI "$BASE/about"                                                          # 301 to /about.html
curl -sI "$BASE/fonts/archivo-700.woff2" | grep -i '^cache-control:'            # immutable, 1y
curl -sI "$BASE/" | grep -i '^strict-transport-security:'                        # max-age 1y
curl -sI "$BASE/" | grep -i '^content-security-policy:'                          # full contract
curl -sI "$BASE/" | grep -i '^x-content-type-options:'                           # nosniff
```

Page-level proof — a real body that proves the asset binding served the
file:

```bash
curl -fsS "$BASE/about.html" | grep -c 'Nish'                                    # at least 1
curl -fsS "$BASE/feed.xml"  | grep -c '<rss version="2.0">'                      # exactly 1
curl -fsS "$BASE/latest.json" | python3 -c "import json,sys; d=json.load(sys.stdin); print('date:', d['date'])"
```

## DRIVE

Per-feature steps live in `features/`:

| Feature | File |
| --- | --- |
| Daily feed `/` (live only — local 404s, see EVIDENCE) | `features/daily-feed.md` |
| About page `/about.html` | `features/about-page.md` |
| RSS feed `/feed.xml` | `features/rss-feed.md` |
| JSON feed `/latest.json` | `features/json-feed.md` |
| Branded 404 on deny paths | `features/deny-paths.md` |
| Legacy `/daily/*` redirects | `features/legacy-redirects.md` |
| Canonicalize apex redirect (live only) | `features/canonicalize.md` |
| Live parity (production only) | `features/live-parity.md` |

Two drive styles:

- **HTTP drive** — curl against the loopback server (local) or
  `https://inish.in/` (live). Local exposes every allow + redirect +
  deny path; live exposes the `/` body and the apex canonicalize
  redirect that local loopback bypasses.
- **Live verifier drive** — `python3 -m inish_daily.verify_live` against a
  pristine origin/main snapshot. The byte-level proof the workergate
  + asset binding + feeds match the accepted edition; this is the
  same check the VPS timer runs every hour.

### Test-only surfaces — never drive these

They exist for the in-process worker test suite. A manual drive of any
of them proves nothing about a real user, and the deny paths are how
the worker's own tests prove the deny branch is wired correctly:

- `tests/test_worker_edge.test.mjs`'s recording ASSETS stub URLs
- `tests/test_middleware_deny.test.mjs`'s allow/deny/redirect fixtures

## EVIDENCE

**Worker log.** Captured launch log is at `/tmp/verify-inish-site.log`.
The log is one line per
request with status and latency, secrets redacted by the wrangler
default; no log is shipped to stdout otherwise.

**HTML proof.** Save the curl output for every feature drive. The
local harness uses `/tmp/verify-<feature>.html`; the live harness uses
`/tmp/verify-inish-live-<feature>.html`. The repo tree is never used
as an evidence dir.

**JSON / RSS body proof.** Same as HTML, but pipe through `python3 -c`
to assert the structural contract — e.g. the RSS single-item
expectation, the JSON `date` and `stories` fields.

**Security-header proof.** `curl -sI` followed by `grep -i` per
header. The full set is `Strict-Transport-Security`,
`Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`,
`X-Frame-Options`. Every response class carries all five.

**What counts as proof:** readiness 200 + doctor pass + the feature's
observable state from its `features/` file, captured to files. A claim
in a transcript is not proof.

**Known local divergences.** `GET /` returns 200 locally exactly as
live — the worker rewrites `/` to `/index.html` before the asset
fetch, so `html_handling: "none"` (which only stops the binding's own
`/` -> `index.html` resolution) strands nothing. What differs:

- Readiness probes use `/about.html`, a literal asset path: it proves
  the ASSETS binding serves the deployed payload without also
  exercising the worker's `/` rewrite. The harness's
  `features/daily-feed.md` documents how to drive the feed locally via
  `git show origin/main:index.html` and how to drive it live via
  `curl https://inish.in/`.
- The local 301 to `https://inish.in/about.html` is the worker telling
  loopback clients to follow the apex. The local shim accepts
  loopback (so the worker proceeds) but the production worker still
  emits the 301 when the test reaches it without the shim. The
  harness never relies on the 301 going to the live site.

Store evidence OUTSIDE the repo tree. Cleanup never deletes the
captured HTML, JSON, RSS, headers, or the wrangler log.

## CLEANUP

Kill the local worker by its recorded PID, and kill the process group:
workerd children survive a bare SIGINT. Never `pkill` by matching
command text — the fleet runs many `wrangler dev` instances under
other worktrees (fleet-ops#533).

```bash
kill -- -"$(ps -o pgid= -p "$(cat /tmp/verify-inish-site.pid)" | tr -d ' ')" 2>/dev/null
ss -tlnp | grep -F ":4891 "  # must print nothing
```

- `npm run dev` stages no temp dir; `--persist-to /tmp/verify-inish-site-state` keeps wrangler's local state outside the repo (bundle tmp dirs still land under the git-ignored `.local-e2e-template/.wrangler/`).
- Leave `.wrangler/state` (the developer's own local DB), `node_modules`,
  `*.tsbuildinfo`, and `worker-configuration.d.ts` untouched. This
  harness never runs `npm install` or any build step.
- Cleanup preserves evidence. Teardown never deletes the captured
  HTML, JSON, RSS, headers, or the wrangler log.
