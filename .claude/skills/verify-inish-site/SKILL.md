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

### Primary — deterministic local Worker (use this)

```bash
scripts/launch_local.sh            # default port 4891
# or
scripts/launch_local.sh 4920       # custom port
```

What it does, in order:

1. Lints `public-paths.json` (loud exit 1 on malformed JSON).
2. Stages a temp working dir under `/tmp/verify-inish-site.XXXXXX/` with the
   production `worker.js` byte-identical, the production
   `functions/policy.js` byte-identical, and `public-paths.json` with
   `canonicalOrigin` rewritten to `http://127.0.0.1:<port>/` via `jq`
   (preserves field order and formatting).
3. Copies `.local-e2e-template/worker-local.js` (a 30-line URL-rewrite shim
   that imports the production worker and re-emits each loopback request
   with a `https://inish.in/` URL so the worker's `canonicalize()` check
   accepts it) and a stripped `wrangler.local.jsonc` (no apex routes, no
   `workers_dev` preview flag).
4. Mirrors the public payload into the temp `public/` directory
   (root HTML, CSS, JS, fonts, the raster social share card, RSS/JSON/sitemap
   feeds, the branded `/404.html`, `_redirects`).
5. Runs `npx wrangler dev --local` in the temp dir. The runtime listens on
   `127.0.0.1:<port>` and serves from the staged asset directory.
6. Probes `http://127.0.0.1:<port>/about.html` every 500ms for up to 90s.
   The probe is the asset-served 200 path, NOT the root, because the local
   binding has the same `html_handling: "none"` as production but does not
   serve the `index.html` content for `/` the way the live binding does (see
   EVIDENCE / Known local divergences).

Output is one machine-readable line:

```
PID=<pid> BASE_URL=http://127.0.0.1:<port>/ TEMPDIR=<path>
```

- Readiness: `curl -fsS http://127.0.0.1:<port>/about.html` returns 200. The
  feed surfaces (`/feed.xml`, `/latest.json`, `/sitemap.xml`,
  `/llms.txt`, `/about.html`, the fonts, the raster social card) all
  serve 200 the moment the worker is listening.
- Loopback only — never expose this to a non-loopback interface.
- Always launched in the background with stdout+stderr captured to
  `TEMPDIR/wrangler.log`; record the PID and the BASE_URL.

### Secondary — real production edge (live E2E)

The VPS hourly `live-current-check.timer` runs `scripts/check_live_current.sh`
against `https://inish.in/` on its own scheduler. For an ad-hoc live probe
the harness uses `scripts/verify_live.py` directly:

```bash
ACCEPTED_SHA="$(git -C /home/nish/workspaces/products/inish-site rev-parse origin/main)"
SNAPSHOT_ROOT="$(mktemp -d)"
git -C /home/nish/workspaces/products/inish-site archive --format=tar origin/main \
    | tar -x -C "$SNAPSHOT_ROOT"
EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"
python3 scripts/verify_live.py \
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
- **Live verifier drive** — `python3 scripts/verify_live.py` against a
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

**Worker log.** Captured launch log is at `TEMPDIR/wrangler.log`
(machine-readable path on the launch line). The log is one line per
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

**Known local divergences.** The local wrangler binding differs from
the live binding on `/`:

- Local `wrangler dev --local` with `html_handling: "none"` serves only
  literal asset paths; `GET /` returns 404 from the asset binding, then
  the worker would 301 to `/index.html` (the policy redirects map
  points `/index.html` to `/`), so `/` is unreachable in the local
  launch even with the URL-rewrite shim. The live edge serves `/` with
  200 (the live binding has the same `html_handling` flag but resolves
  `/` to the deployed `index.html` content). The harness's
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
ss -tlnp | grep -F ":$(cat /tmp/verify-inish-site.port) "  # must print nothing
rm -rf "$(cat /tmp/verify-inish-site.tmpdir)"
```

- `.wrangler/e2e-state` is not used by this harness; `launch_local.sh`
  stages state under `/tmp/verify-inish-site.XXXXXX/` and the trap
  removes it on EXIT (or via the cleanup block above).
- Leave `.wrangler/state` (the developer's own local DB), `node_modules`,
  `*.tsbuildinfo`, and `worker-configuration.d.ts` untouched. This
  harness never runs `npm install`, `npm run typecheck`, or any other
  build step.
- Cleanup preserves evidence. Teardown never deletes the captured
  HTML, JSON, RSS, headers, or the wrangler log.
