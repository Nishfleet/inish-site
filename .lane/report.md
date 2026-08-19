# Lane evidence — aiconverter-app lane 1

## 2026-08-12 — WeLikeTools listing + xix.ai paid/decline decision (fleet lane attempt, item c716f1de42)

**Verdict: NOT EXECUTED — both venues re-verified live 2026-08-12 and the
standing decisions in `ops/launch-venues.md` still bind. The free WeLikeTools
listing was not submitted and the xix.ai $9.90 was not paid, for the same
reasons as every prior venue lane: `agent-state/growth-loop/venue-policy.json`
(updated 2026-08-08) has no weliketools.com or xix.ai entry —
`automation_disposition: unknown`, allowlist empty — so `venue-claim claim`
exits 4 and the agent must not drive a browser submission; WeLikeTools
additionally requires a Google sign-in (human account action) and xix.ai
requires a $9.90 spend (Nish-only money boundary, no spend authorization in
`agent-state/authorizations/`). New evidence this run: WeLikeTools robots.txt
disallows `/api/` and `/auth/` (no public submission API), and WeLikeTools
Terms (https://weliketools.com/terms) prohibit "Using automated tools to
scrape or harvest data from our website" — flagged for the venue research
desk. The dated xix.ai decision line (PAID recommended / agent-executed
submission declined; flips to SUBMITTED or DECLINED on Nish's spend call)
stands as the paid/decline record the packet asked for.**

### Re-verification (all credential-free, live 2026-08-12)

WeLikeTools:

- Search `q=aiconverter` (https://weliketools.com/search?q=aiconverter, HTTP
  200): "Found 0 results" / "No tools found" — no duplicate, no aiconverter.app
  listing.
- Exact-category competitor still live and still free: Bank Statement Engine
  (https://weliketools.com/tool/bankstatementengine, `datePublished`
  2026-07-12, Category: Business & Finance, also APIs and Dev Tools, "Pricing:
  Free"; free tier: no account, no credit card, 10 pages/day anonymous; free
  registered account unlimited, no paid subscriptions).
- `/submit` (HTTP 200) still gates behind Google sign-in ("Log in to Submit" /
  "Log in with Google") — free, no fee or paid tier mentioned on the page.
- robots.txt (live 2026-08-12): `Disallow: /api/`, `Disallow: /auth/` — the
  submit/auth flows are not exposed for automated access; no public
  submission API.
- Terms (https://weliketools.com/terms, HTTP 200, read live 2026-08-12):
  prohibited conduct includes "Using automated tools to scrape or harvest
  data from our website" — scraping prohibition (same class of language as
  Product Hunt's ToS and Toolbit.ai's ToS §7, scoped to data scraping rather
  than listing submission); flag for the venue research desk (the guard stays
  exit-4 either way).

xix.ai:

- Site search `q=aiconverter` (https://xix.ai/search?q=aiconverter, HTTP 200):
  "No results found" — no duplicate; `/tool/ai-converter.html` → 404.
- Exact-term category page still live and still competitor-occupied: "PDF
  Bank Statements Converter" (https://xix.ai/tool/pdf-bank-statements-converter.html,
  HTTP 200, current tool aibankparser.com) — unchanged.
- `/submit` (HTTP 200) still payment-gated: "$9.90", "No queue, listed within
  48 hours", sign-in required, graphic captcha at the payment step —
  unchanged.

Product baseline (aiconverter.app, 2026-08-12): `/`, `/llms.txt`,
`/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all HTTP
200; `/pricing/` and `/receipt-to-csv/` still 404 — no kit claims those routes.

### Decisions recorded (dated 2026-08-10, re-verified 2026-08-11 and 2026-08-12)

- WeLikeTools: **SUBMIT — manual submission by Nish (free, no fee)**; kit
  copy-paste ready in `ops/launch-venues.md`. Lane attempt 2026-08-12: NOT
  EXECUTED (policy guard exit 4 + Google sign-in gate).
- xix.ai: **PAID listing at $9.90 recommended; declined for agent-executed
  submission** — the $9.90 spend and the submission are Nish's human actions;
  the dated decision line flips to SUBMITTED or DECLINED once Nish decides on
  the spend. Lane attempt 2026-08-12: NOT EXECUTED (policy guard exit 4 +
  spend decision, no authorization).

### Why the item cannot be closed from a lane (unchanged policy, re-verified 2026-08-12)

- `venue-policy.json` allowlist is EMPTY; weliketools.com and xix.ai are both
  `automation_disposition: unknown` (not in `reviewed_venues` either). Per the
  venue-claim contract, exit 4 blocks ALL browser work — no agent-driven
  submission on either venue, unchanged from 2026-08-10/11.
- WeLikeTools submission is a human account action (Google OAuth); xix.ai
  additionally requires a $9.90 payment — a spend decision only Nish can make
  (money boundary). `agent-state/authorizations/` holds only the
  sol-xhigh-worker-grant-20260811.json; no xix.ai or WeLikeTools entry exists
  in the dispatch ledger.
- The `venue-claim` binary is not installed in the lane environment, but the
  policy JSON is the authoritative guard and is unchanged; this record is the
  honest NOT-EXECUTED lane outcome the packet requires.

### Checks on this lane

- Live HTTP checks for both venues' search/submit/category/competitor pages
  and the aiconverter.app kit reference pages (2026-08-12) — all as recorded
  above.
- No code changed; docs only (`ops/launch-venues.md`, `.lane/report.md`).

## 2026-08-12 — dogfood 3af46f8a2040: Slow rendered load on home (re-verification #2)

**Verdict: the finding is STILL LIVE on production. The sendBeacon fix (PR
#22, `88e3d3c`) is merged on origin/main and verified working locally
(network idle ~0.8s), but production still serves the pre-fix bundle
(`assets/index-Dqg0j7kd.js`: `keepalive` present, zero `sendBeacon`). Deploy
remains impossible from a lane: the fleet Cloudflare token still lacks
Account > Cloudflare Pages > Edit (403 re-verified today), and no wrangler
OAuth session exists on this host. One change since 2026-08-11: the missing
release baseline is RESOLVED (`release-state-aiconverter-app.json` recorded
2026-08-12T00:33:54), so the fleet release machinery is armed and baselined —
only the Pages:Edit credential is missing. The item closes after one human
Pages:Edit deploy.**

### Re-verification 2026-08-12 (Chromium headless 1.62.1, same engine semantics: `page.goto` `networkidle` wait, 25s cap)

Live https://aiconverter.app/ — bundle still `assets/index-Dqg0j7kd.js`
(280,475 bytes: `keepalive` present, zero `sendBeacon`):

- 3/3 fresh runs: network idle **TIMED OUT at the 25s cap** (25,007 /
  25,103 / 25,100 ms); `POST /api/funnel-event` returns HTTP 200 but its
  `requestfinished` never fires — the same single in-flight request that
  blocks network idle (documented root cause, 2026-08-11).

Local build of origin/main at `175322d` (`assets/index-BVp--8SO.js`,
282,031 bytes: `sendBeacon` present, zero `keepalive`):

- 3/3 runs reach network idle at **793 / 848 / 772 ms** — the fixed bundle
  clears the audit well inside the cap.
- Repo gates green: `npm run check:pricing` consistent, `node --test
  tests/*.test.mjs` 120/120 pass (incl. `tests/funnel-telemetry.test.mjs`,
  which locks the sendBeacon / no-keepalive contract), `npm run build`
  green.

### Deploy path state (verified 2026-08-12)

1. `wrangler whoami` → "You are not authenticated. Please run `wrangler
   login`." — no OAuth session exists on this VPS and the environment is
   non-interactive.
2. Fleet `CLOUDFLARE_API_TOKEN` (loaded from `~/.config/fleet-console/
   cf.env`): token verify succeeds and the account resolves, but
   `GET /accounts/<acct>/pages/projects/aiconverter` still returns 403
   `Authentication error [code: 10000]` — the token remains Workers-only,
   no Pages:Edit. The fleet-release runner's own last wrangler deploy
   attempt (log 2026-08-11T19:08:53) died on the same code-10000 error at
   `/pages/projects/aiconverter`.
3. **RESOLVED since 2026-08-11**: the "no known-good release baseline"
   blocker is gone — `release-state-aiconverter-app.json` was recorded
   2026-08-12T00:33:54 (live sha `48b098e`, marker
   `assets/index-Dqg0j7kd.js`; evidence in
   `aiconverter-baseline-evidence.json`). `release-policy-aiconverter-app.
   txt` is still "on".
4. `fleet-release-last-run.json` (2026-08-12T01:37) shows
   `"action": "cannot-read-main"` for aiconverter-app — the release runner
   could not read main at that tick (transient runner/git issue); even when
   it reads main, any deploy reaching wrangler still 403s at the Pages API
   without Pages:Edit.

### Remaining step to close the item (Nish-held)

One Cloudflare Pages:Edit deploy of a clean `origin/main` build, then rerun
the dogfood batch:

```bash
# from a clean origin/main checkout, with a Pages:Edit credential
SAFE_DEPLOY_APPROVED='pages deploy dist --project-name aiconverter --branch main' \
  wrangler pages deploy dist --project-name aiconverter --branch main
```

Alternative: grant the fleet token Account > Cloudflare Pages > Edit. The
release machinery is armed AND baselined now, so the next fleet-release tick
that can read main would publish the merged fix (and all later merged fixes
deploy automatically). After deploy, the rendered-load audit should clear —
expect network idle <1s on the fixed bundle.

### Checks on this lane

- `npm run check:pricing` — Pricing is consistent.
- `node --test tests/*.test.mjs` — 120 pass, 0 fail.
- `npm run build` — green; fixed bundle `assets/index-BVp--8SO.js`.
- Live bundle re-fetched 2026-08-12 — unchanged
  `assets/index-Dqg0j7kd.js` (`keepalive`, zero `sendBeacon`).
- Live rendered-load: 3/3 timeouts at the 25s cap; local fixed build 3/3
  network idle ~0.8s.

## 2026-08-11 — Five observed intent-matched customer trials with free full export (scout item)

**Verdict: the trial kit, grant decision, and free-export gate verification are
delivered on this run's PR; the five observed sessions themselves are
Nish-held. Recruiting real bookkeepers / SMB operators requires Nish's human
network, and an observed session requires a human observer present with
participant consent — no lane capability or fleet asset exists for either. The
item closes when Nish runs the five sessions using the kit and records 5/5
rows in `ops/customer-trials.md`.**

### What was delivered (this PR, branch `lane1/customer-trials-20260811`)

- `ops/customer-trials.md` — the trial kit: operational definition of
  "intent-matched" and "observed" (real current files, watched session,
  five separate participants, 2–3 bookkeepers + 2–3 SMB operators), copy-paste
  recruitment messages (LinkedIn / WhatsApp / email), a 3-question screener,
  the per-session observation protocol (landing → upload → free preview →
  unlock → full export), post-session questions, and a per-participant
  evidence ledger template.
- Free full-export grant decision (dated 2026-08-11): **per-job `paid_at`
  grant with `payment_id = 'trial:<participant-id>'`** (D1 UPDATE, exact SQL
  in the doc), NOT the global flag. Rationale: `FREE_DOWNLOADS_ENABLED=true`
  makes every export free for every user (revenue impact) and needs a Pages
  deploy (still blocked from lanes — no Pages:Edit, see below); the per-job
  grant touches exactly five jobs and needs no deploy.
- `tests/download-gate.test.mjs` — 5 tests locking the gate semantics the
  trials depend on: unpaid complete job → 402 by default (no download_count
  increment); unpaid + `FREE_DOWNLOADS_ENABLED=true` → 200 full export;
  paid → 200 regardless of flag; unknown job → 400 even with the flag on;
  batch-download skips unpaid jobs as payment-required unless the flag is on.
  These are the first direct tests of `functions/api/download.js`.

### Verification (all live / local, 2026-08-11)

- Live `/api/health`: `dodo.freeDownloads: false` — free full export is NOT
  enabled in production; the gate is real and would block trial downloads
  today absent the per-job grant.
- Gate code re-read: `functions/api/download.js:25-28`,
  `functions/api/batch-download.js:53-57` — `if (!job.paid_at && !freeDownloads)
  → 402 / skip`. No per-job trial grant exists in code; no admin endpoint
  grants paid state (admin API surface: overview, dodo-prices, checkout-drill,
  failover-drill, refund-drill only).
- `npm run stress:live`: product baseline healthy (108 requests, p95 275ms);
  the known `formats-blank-first-paint` failure persists — consistent with
  the documented stale production bundle (merged sendBeacon fix #22 still
  undeployed; see the first finding in this file).
- Repo gates: `npm run check:pricing` pass, `node --test tests/*.test.mjs`
  111/111 pass (106 prior + 5 new), `npm run build` pass.

### Why the five sessions cannot be run from a lane

1. **Recruitment**: no participant pool, no outreach accounts, no network of
   bookkeepers / SMB operators. Nish has the professional network (and the
   product is his to pitch).
2. **Observation**: an observed trial is a live human session (screen share /
   watch + notes + consent). Fleet assets cannot be present in a human
   session; no consent mechanism exists.
3. Per fleet policy, human interactions and account actions stay with Nish —
   same class of blocker as the launch-venue submissions (this file,
   entries below).

### Remaining step to close the item (Nish-held)

Run five sessions with the kit in `ops/customer-trials.md` (recruit → screen →
observe → grant per-job export → record ledger rows). After each session,
grant the export with the doc's SQL (`UPDATE jobs SET paid_at = …,
payment_id = 'trial:<id>' WHERE id = '<job id>'`). When 5/5 rows are recorded,
flip the scout item closed. If the global flag is ever used instead, record
its exact on/off window in the doc.

### Checks on this lane

- `npm run check:pricing` — Pricing is consistent.
- `node --test tests/*.test.mjs` — 111 pass, 0 fail.
- `npm run build` — green.
- Live `/api/health` — `freeDownloads: false` (2026-08-11).

## 2026-08-11 — dogfood 3af46f8a2040: Slow rendered load on home (re-verification)

**Verdict: the finding is STILL LIVE on production. The code fix (PR #22,
`88e3d3c`, sendBeacon) is merged to main but has never been deployed. The
deploy still cannot be performed by any VPS agent (verified today): no
wrangler session, the fleet Cloudflare token still lacks Pages:Edit, and the
fleet releaser refuses the first release without a known-good baseline. The
item closes only after one human Pages:Edit deploy.**

### The finding

`runs/20260808T074205Z-msk2fl3n.json` reported "Slow rendered load on home"
(dogfood 3af46f8a2040): the rendered audit reached network idle in 27423ms
(25s network-idle cap + fallback waits) on 2026-08-08, and timed out at
25000ms again on 2026-08-09.

### Root cause

The home page sends a `page_view` funnel beacon on mount via
`fetch("/api/funnel-event", { method: "POST", keepalive: ... })`. On the
Cloudflare edge, Chromium receives the 200 response but never emits
`requestfinished` for that keepalive fetch, so the page never reaches network
idle and the rendered-load audit hangs to its 25s cap.

### Fix (merged, undeployed)

PR #22 / commit `88e3d3c` ("fix: stop the home page from never reaching
network idle") switches the beacon to `navigator.sendBeacon()` (which
Chromium reports as finished) with a plain non-keepalive `fetch()` POST
fallback. Present in `origin/main` today at `33d3cb0`.

### Re-verification 2026-08-11 (Chromium headless, same engine semantics: `page.goto` `networkidle` wait, 25s cap)

Live https://aiconverter.app/ — bundle still `assets/index-Dqg0j7kd.js`
(280,475 bytes: `keepalive` present, zero `sendBeacon`):

- 3/3 fresh runs: network idle **TIMED OUT at the 25s cap**; the funnel-event
  POST's `requestfinished` **never fires**.
- Root cause pinned in a full request trace: every other request finished
  (bundle +342ms, woff2 fonts ~+670ms, `/api/config` +670ms,
  `/api/pricing-preview` +1067ms). The ONLY request still unfinished 3s after
  the cap is `POST /api/funnel-event` (started +418ms, HTTP 200 received,
  `requestfinished` never fires). That single in-flight request is what
  blocks network idle until the 25s cap — the exact 27423ms behavior from
  the original dogfood run.

Local build of `origin/main` at `33d3cb0` (`assets/index-7zU5-aJu.js`,
279,607 bytes: `sendBeacon` present, zero `keepalive`):

- Network idle reached at **1202ms** even with +350ms CDP network latency;
  the sendBeacon funnel POST reports `requestfinished = true`.
- Repo gates green: `npm run check:pricing` consistent, `node --test
  tests/*.test.mjs` 106/106 pass, `npm run build` green.

### Why the item cannot be closed from a lane (verified 2026-08-11)

1. `wrangler whoami` → "You are not authenticated. Please run `wrangler
   login`." — no OAuth session exists on this VPS and the environment is
   non-interactive.
2. Fleet `CLOUDFLARE_API_TOKEN` (loaded by `fleet-release.timer` from
   `~/.config/fleet-console/cf.env`): token verify succeeds, but
   `GET /accounts/<account>/pages/projects/aiconverter` returns
   `{"errors":[{"code":10000,"message":"Authentication error"}]}` — the
   token still lacks Account > Cloudflare Pages > Edit (Workers-only scope).
3. Fleet release machinery is now ARMED (`release-policy-aiconverter-app.txt`
   = "on") but the 2026-08-11T00:50:40 run refused with "needs Nish: no
   known-good release baseline - schema compatibility of 33d3cb04 is unknown
   - code-only release REFUSED until a baseline is recorded" (no
   `release-state-aiconverter-app.json` exists; the first release must be
   supervised). Even if a baseline existed, (2) would still block the Pages
   deploy.

### Remaining step to close the item (Nish-held)

One Cloudflare Pages:Edit deploy of a clean `origin/main` build, then rerun
the dogfood batch:

```bash
# from a clean origin/main checkout, with a Pages:Edit credential
SAFE_DEPLOY_APPROVED='pages deploy dist --project-name aiconverter --branch main' \
  wrangler pages deploy dist --project-name aiconverter --branch main
```

Alternative: grant the fleet token Account > Cloudflare Pages > Edit and
supervise the first fleet release (records the baseline, then all subsequent
merged fixes deploy automatically). After deploy, the rendered-load audit
should clear — expect network idle ~1–2s on the fixed bundle.

### Checks on this lane

- `npm run check:pricing` — Pricing is consistent.
- `node --test tests/*.test.mjs` — 106 pass, 0 fail.
- `npm run build` — green; fixed bundle `assets/index-7zU5-aJu.js`.
- Live bundle re-fetched twice today — unchanged `assets/index-Dqg0j7kd.js`.

## 2026-08-11 — WeLikeTools listing + xix.ai paid/decline decision (re-verification, item c716f1de42)

**Verdict: the item's research deliverable is complete and re-verified live on
2026-08-11; both venue decisions and kits are recorded in
`ops/launch-venues.md` (this run's PR). Both venues still host exact-category
competitor tools while aiconverter.app is absent. The remaining steps are
Nish-held: the free WeLikeTools submission (Google sign-in) and the xix.ai
$9.90 paid/decline spend decision. This supersedes PR #30, whose branch
(`lane1/weliketools-xix-listing`) predates the #40 re-verification merge and
never landed.**

### Re-verification (all credential-free, live 2026-08-11)

WeLikeTools:

- Search `q=aiconverter` → "Found 0 results / No tools found" (HTTP 200) — no
  duplicate, no aiconverter.app listing.
- Exact-category competitor still live: Bank Statement Engine
  (https://weliketools.com/tool/bankstatementengine, published 2026-07-12,
  Category: Business & Finance, Pricing: Free).
- `/submit` still gates behind Google sign-in ("Log in to Submit" /
  "Log in with Google") — free, no fee or paid tier mentioned.

xix.ai:

- Site search `q=aiconverter` → "No results found in the search" (HTTP 200);
  `/tool/ai-converter.html` → 404.
- Exact-term category page still live and still competitor-occupied:
  "PDF Bank Statements Converter"
  (https://xix.ai/tool/pdf-bank-statements-converter.html, listed 2025-09-08,
  current tool aibankparser.com; tags pdf-csv-converter /
  bank-statement-parser / financial-data-processing-tool).
- `/submit` still payment-gated: "$9.90", "no queue, listed within 48 hours",
  account sign-in required (graphic captcha at payment step, scout-verified
  2026-08-09).

Product baseline (aiconverter.app, 2026-08-11): `/`, `/llms.txt`,
`/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all HTTP
200; `/pricing/` and `/receipt-to-csv/` still 404 (PR #42 for pricing still
open, undeployed) — no kit claims those routes.

### Decisions recorded (dated 2026-08-10, re-verified 2026-08-11)

- WeLikeTools: **SUBMIT — manual submission by Nish (free, no fee)**; kit
  copy-paste ready in `ops/launch-venues.md`.
- xix.ai: **PAID listing at $9.90 recommended; declined for agent-executed
  submission** — the $9.90 spend and the submission are Nish's human actions;
  the dated decision line flips to SUBMITTED or DECLINED once Nish decides.

### Why the item cannot be closed from a lane (unchanged policy)

Both venues are `automation_disposition: unknown` in the fleet venue policy
ledger (`agent-state/growth-loop/venue-policy.json`), so `venue-claim claim`
exits 4 for each; the xix.ai listing additionally requires a $9.90 payment.
Per fleet policy, account actions and spend stay with Nish.

### Checks on this lane

- Live HTTP checks for both venues' search/submit/category/competitor pages
  (2026-08-11) — all as recorded above.
- No code changed; docs only (`ops/launch-venues.md`,
  `.lane/report.md`).

---

# 2026-08-11 — Toolbit.ai launch venue (re-verification packet)

**Verdict: listing recorded as SUBMIT (free plan first, manual by Nish); the
actual Toolbit submission is a human account action, same as the other four
venues. Packet delivered the re-verified decision record + submission kit on
main-track via PR #49.**

### What was done (all live-verified 2026-08-11)

- Fresh branch `lane1/toolbit-listing-20260811` from origin/main (405e3b2).
- `ops/launch-venues.md`: added Toolbit.ai decision (dated 2026-08-10,
  re-verified 2026-08-11) + manual submission kit + fleet re-verification
  ledger section; header now covers all five venues.
- Live checks: Toolbit search `q=aiconverter` → no aiconverter.app result
  (unrelated only); `/ai-tool/ai-converter` 404; StatementSheet
  (`/ai-tool/statementsheet`, Data Extraction, 9.5K visits, Paid) and Rocket
  Statements (`/ai-tool/rocketstatements` — slug CHANGED since 2026-08-10,
  old `/ai-tool/rocket-statements` now 404) both still live; `/submit` paid
  plans unchanged (Launch Tool $29 one-time, Update $19, Advertise from $39,
  Guest Post $39) + free FAQ "reviewed in up to 3 days"; `/submit/tool?plan=free`
  renders sign-in wall; `/launch-badge` 404; ToS §7 (last updated 2026-07-20)
  still prohibits robots/spiders/automatic access.
- Policy: `agent-state/growth-loop/venue-policy.json` (updated 2026-08-08)
  still has no toolbit.ai entry → `automation_disposition: unknown` →
  `venue-claim` exits 4; ToS §7 is Product-Hunt-class prohibition — flagged
  for the venue research desk in the doc (ledger not modified; outside this
  worktree's scope).
- Kit canonical links all HTTP 200; `/pricing/` and `/receipt-to-csv/` still
  404 (not claimed).

### Outcome

- PR #49 (https://github.com/nish3451/aiconverter-app/pull/49): MERGEABLE,
  all CI green (Build, Gitleaks, Pricing check, Unit tests, classify).
- Stale PR #34 (`lane1/toolbit-listing`, conflicting, 2026-08-10 content)
  annotated as superseded by #49.
- Gates run: `npm run check:pricing` pass, `node --test tests/*.test.mjs`
  106/106 pass, `npm run build` pass.

### Nish-held next action

Sign in at toolbit.ai (Google/email), submit via the kit (free Launch Tool $0
first), embed the Launch Badge snippet on aiconverter.app (tiny deploy — note
Pages:Edit deploy still blocked per the finding above), then update
`ops/launch-venues.md` with the public tool URL. The $29 paid launch remains a
deferred commercial decision.

---

# 2026-08-11 — Toolify.ai launch venue (new packet, item: paid $99 submit path)

**Verdict: the research deliverable is complete and verified live on
2026-08-11; the Toolify.ai decision and submission kit are recorded in
`ops/launch-venues.md` (this run's PR). Toolify already hosts the exact
category — the "Bank Statement to CSV" and "Bank Statement to Excel" tag
pages both lead with LedgerBox — while aiconverter.app is absent (search
returns zero results). The remaining steps are Nish-held: the account, the
$99 one-time payment, and the form submission.**

### Re-verification (all credential-free, live 2026-08-11)

Toolify.ai direct HTTP is Cloudflare-challenged from this VPS ("Just a
moment...", 403 on /submit, /tool/*, /tag/*, /search) — verified through a
JS-rendering reader proxy (r.jina.ai) plus Wayback Machine captures
(submit page 2026-07-04, Fulfillment Policy 2026-07-02):

- Search `q=aiconverter` (JS-rendered) → "Sorry, there are no tools
  containing your keywords at the moment" — no listing, no duplicate;
  `/tool/ai-converter` → 404.
- Exact-category tag pages: "The best ai tools for Bank Statement to CSV
  are: LedgerBox" (https://www.toolify.ai/tag/Bank%20Statement%20to%20CSV,
  2 AIs, updated 2026-08-11); same verdict for /tag/Bank%20Statement%20to
  %20Excel. LedgerBox live at /tool/ledgerbox ("AI-powered bank statement
  converter from PDF to Excel and CSV", added 2023-11-11).
- Submit page (live + 2026-07-04 capture, identical): paid path only —
  **$99 one-time**, "No queue, listed within 48 hours", "Pay $99". Form:
  Name + Website URL + content mode ("Generated by Toolify" auto-writes all
  copy/translations from the site, or "Do it myself" — English supplied by
  submitter, translated by Toolify). Benefits: listing + "Just Launched"
  within 48h, border highlight, ≥6 dofollow links, listing & traffic
  forever, Toolify AI Launch embeds + AI certification.
- Fulfillment Policy (last updated 2024-08-30, re-read 2026-07-02 archive):
  one-time payment program, account registration required, rejection at
  Toolify's sole discretion, **fee non-refundable even on cancellation**.
  No robot/spider/automated-access prohibition (unlike Product Hunt ToS and
  Toolbit ToS §7) — but the venue remains `automation_disposition: unknown`
  in the fleet policy ledger, so `venue-claim` exits 4 regardless.
- Product baseline (aiconverter.app, 2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all
  HTTP 200; `/pricing/` and `/receipt-to-csv/` still 404 — the kit claims
  none of those routes.

### Decision recorded (dated 2026-08-11)

- Toolify.ai: **PAID listing at $99 recommended for evaluation; declined for
  agent-executed submission** — the $99 spend and the submission are Nish's
  human actions; the dated decision line flips to SUBMITTED or DECLINED once
  Nish decides. Kit copy-paste ready in `ops/launch-venues.md` (Name, URL,
  "Do it myself" description, tags to confirm, canonical links,
  post-listing check).

### Why the item cannot be closed from a lane (unchanged policy)

toolify.ai is `automation_disposition: unknown` in the fleet venue policy
ledger (`agent-state/growth-loop/venue-policy.json`), so `venue-claim claim`
exits 4; the listing additionally requires a $99 payment and an account.
Per fleet policy, account actions and spend stay with Nish — the agent
cannot create the account, pay, or drive the submission form.

### Checks on this lane

- Live checks for search, tag pages, LedgerBox tool page, submit page, and
  Fulfillment Policy (2026-08-11) — all as recorded above.
- No code changed; docs only (`ops/launch-venues.md`, `.lane/report.md`).

## 2026-08-11 — Microlaunch launch venue: regular (free) launch kit, Pro $39 deferred (packet item: list the product on Microlaunch via + New Launch)

**Verdict: the item's research deliverable is complete and verified live on
2026-08-11; the Microlaunch decision and kit are recorded in
`ops/launch-venues.md` (this run's PR). Microlaunch hosts the exact category —
both exact-category peers named in the packet, Bank Statement Converter and
Bankformats, are live with non-premium launch records — and aiconverter.app is
absent. The remaining steps are Nish-held: the free "Regular launch"
submission (Google/𝕏 sign-in) and the optional $39 Pro Launch spend decision.**

### Verification (all credential-free, live 2026-08-11)

- Microlaunch homepage live: "The Launch Platform for World-Class Startups",
  "August '26 — 138 products, 2001 daily visitors".
- Exact-category peers, both live with `is_premium: false` launch records
  (regular/free launches are real on this venue):
  - Bank Statement Converter (https://microlaunch.net/p/bankstatementconverter,
    launched 2026-02-08, market analytics, Saas, "Free product", mvp-wip) —
    "Instantly transform PDF bank statements into clean, structured Excel,
    CSV, or JSON data".
  - Bankformats (https://microlaunch.net/p/bankformats, launched 2026-06-14,
    market accounting, Saas, Subscription, growing) — "Bank Statement
    Converter — Convert to Excel & CSV. PDF bank statements from 1000+
    banks. EU servers, GDPR-compliant, first 3 pages free."
- No duplicate: full launches API (5,660 products) — zero aiconverter /
  "AI Converter" codename or slug (only false-positive is NoteGPT via generic
  AI-converter keywords); slug probes /p/aiconverter, /p/ai-converter,
  /p/ai-converter-app, /p/aiconverter-app all no product (500).
- Launch flow: "+ New Launch" (nav button) opens the "Pick your Launch" modal
  — Pro Launch card ($39 one-time, struck $49, code LAUNCH20 −20%, OSS/
  students 50% OFF, 40 spots/month, "Skip the Queue — Launch Anytime",
  featured spots, 4+ SEO pages, marketplace spot, verified badge) with CTA
  "Go Pro Now!" → /premium#stats. `/submit` redirects to `/premium#pricing`.
  Premium page FAQ names a "Regular launch" tier; both peers' non-premium
  records confirm it. Second pack: Expert Feedback $129 (was $149).
- Account-gated: header modal offers "Signup with Google" and "Signup with 𝕏".
- ToS (https://microlaunch.net/terms, "Last updated on 04/03/2023"): generic
  template, no robot/spider/automated-access prohibition (unlike Product Hunt
  ToS and Toolbit ToS §7) — flagged for the venue research desk; the venue
  stays `automation_disposition: unknown` in the fleet policy ledger, so
  `venue-claim` exits 4 regardless.
- Product baseline (aiconverter.app, 2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all
  HTTP 200; `/pricing/` and `/receipt-to-csv/` still 404 — the kit claims
  none of those routes.

### Decision recorded (dated 2026-08-11)

- Microlaunch: **SUBMIT — regular (free) launch first, manual by Nish. The
  paid Pro Launch ($39) is recorded and deferred to Nish's spend call.** Kit
  copy-paste ready in `ops/launch-venues.md` (Name, Tagline, Description,
  category suggestions from the peers' markets — Analytics & Data / Accounting
  Tools — product type Saas, offer type Freemium, Website, canonical links,
  post-listing check).

### Why the item cannot be closed from a lane (unchanged policy)

microlaunch.net is `automation_disposition: unknown` in the fleet venue policy
ledger (`agent-state/growth-loop/venue-policy.json`, allowlist empty), so
`venue-claim claim` exits 4; the launch additionally requires an account
(Google/𝕏 sign-in) and the free flow is inside the signed-in UI (the anonymous
"+ New Launch" modal surfaces the Pro Launch only). Per fleet policy, account
actions and spend stay with Nish — the agent cannot create the account or
drive the submission form.

### Checks on this lane

- Live checks for homepage, both peer product pages (embedded launch
  records), full-launches API duplicate check, slug probes, "Pick your
  Launch" modal, /submit redirect, premium pricing page, sign-in modal, ToS,
  and the four canonical product links (2026-08-11) — all as recorded above.
- No code changed; docs only (`ops/launch-venues.md`, `.lane/report.md`).
---

# 2026-08-11 — Uneed launch venue (new packet, item: list the product via free waiting-line submit, record paid skip-the-line decision)

**Verdict: the item's research deliverable is complete and verified live on
2026-08-11; the Uneed decision and submission kit are recorded in
`ops/launch-venues.md` (this run's PR). Uneed hosts the exact category — five
exact-category peers are live under Business with non-premium launch records —
while aiconverter.app is absent (public search API returns no hit; slug
probes 404). The free path is a ~6-month queue (next slot 2027-01-31, quoted
live by the venue's own public API). The remaining steps are Nish-held: the
email-OTP account, the free "Join the line" launch (or the $29.99 Skip-the-
Waiting-Line spend call).**

### Verification (all credential-free, live 2026-08-11)

- Venue confirmed as uneed.best (uneed.ai/uneed.app are parked domain-sale
  pages; uneed.best is the live platform: "Uneed — Launch. Get seen. Grow.",
  "10,000+ digital tools ranked by community votes" per /llms.txt).
- Exact-category peers, all live (`/tool/{slug}` HTTP 200, all
  `premium: false` in the public search API — free launches are real here):
  StatementSheet (launched 2025-11-16), Bank PDF Converter (2024-06-27),
  BankConv (launch records incl. 2026-08-08), PdfBuddy (incl. 2026-08-09),
  BankScanPro (incl. 2026-05-22).
- No duplicate: search API q=aiconverter → no aiconverter.app; q=AI Converter
  → unrelated converters only; /tool/ai-converter, /tool/aiconverter,
  /tool/ai-converter-app all 404.
- Free tier + paid options (pricing page live): "New product — Join the
  line" FREE (auto-assigned date at next available slot); **Skip the line
  $29.99** (choose date); Fast-track $14.99 (~14 days out); Relaunch $15;
  Uneed Pro $99/yr early bird includes 1 free Skip per year (worth $29.99).
- Live queue quote (public GET /api/v1/launch-dates): free_next_available
  2027-01-31 (173 days); STWL dates bookable from 2026-08-13.
- Agent path (venue-official, first for this file): /launch.txt "Agent
  Launch Guide" — full REST flow (email OTP → bearer → POST /api/v1/products
  → POST /api/v1/launches, tier free|stwl; one product per free account in
  the waiting line) + public read-only MCP server (mcp.uneed.best/mcp).
- ToS (/terms-of-use, last updated 2025-07-31, Uneed Platform, Nantes FR):
  prohibits automated vote/ranking/comment manipulation, NOT product
  submission; no blanket robot/spider/crawl ban (unlike Product Hunt ToS and
  Toolbit ToS §7).
- Product baseline (aiconverter.app, 2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all
  HTTP 200; `/pricing/` and `/receipt-to-csv/` still 404 — the kit claims
  none of those routes.

### Decision recorded (dated 2026-08-11)
- Uneed: **SUBMIT — free waiting-line launch ("Join the line") first, manual
  by Nish. The paid Skip the Waiting Line ($29.99) is recorded and deferred
  to Nish's spend call** (Fast-track $14.99 and Pro's bundled yearly Skip
  also noted). Kit copy-paste ready in `ops/launch-venues.md` (Name,
  Website, one-line description, tier choice with the live free date,
  Business category, Freemium pricing tag, post-listing check).

### Why the item cannot be closed from a lane (policy, with a first-time twist)

uneed.best is `automation_disposition: unknown` in the fleet venue policy
ledger (`agent-state/growth-loop/venue-policy.json`, allowlist empty, only
producthunt.com reviewed) → `venue-claim claim` exits 4. The free flow
requires an email-OTP account (an account action, per fleet policy Nish-held;
the agent has no inbox to receive the code) and the STWL path requires a
$29.99 payment. **Twist for the venue research desk:** unlike every prior
venue, Uneed itself publishes an official agent-launch API (launch.txt + REST
/api/v1 + MCP) and its ToS does not prohibit agent submission — positive
evidence for a future `automation_disposition: allowed` review of uneed.best.
Once the ledger is updated, a future agent packet could execute the API flow
end-to-end with Nish's email OTP.

### Checks on this lane

- Live checks for homepage, llms.txt, pricing page, submit page, launch-dates
  API, search API duplicate checks, slug probes, five peer tool pages,
  launch.txt, ToS, and the four canonical product links (2026-08-11) — all
  as recorded above.

---

## 2026-08-11 — Open-Launch launch venue: Premium Launch $12 kit, free slots booked into 2027 (packet item: list the product on Open-Launch via Premium Launch ($12; free slots booked into 2027) — exact-category peers Bank)

**Verdict: the item's research deliverable is complete and verified live on
2026-08-11; the Open-Launch decision and submission kit are recorded in
`ops/launch-venues.md` (this run's PR). Open-Launch hosts the exact category —
10+ bank-statement-converter peers are live (AI Bank Statement, Bank Statement
Boss, Bank PDF Converter, StatementSheet, Bank Statement Engine, BankScanPro,
Bank Statement Converter AI, AIBankStatement, bank-statementconverter.com,
Reconciliate Bank / Credit Card Statements with AI, ...) while aiconverter.app
is absent (site search `q=aiconverter` and `q=ai converter` return zero
results; all four slug probes 404). The remaining steps are Nish-held: the
account (Google / GitHub / email sign-in), the $12 Premium Launch payment, and
the form submission.**

### Verification (all credential-free, live 2026-08-11)

- Venue: https://open-launch.com — "Discover the Best Tech Products" launch/
  upvote platform; open source (github.com/openlaunch-org/Open-Launch, "The
  first complete open source alternative to Product Hunt", updated
  2026-08-11, 314 stars).
- Pricing page (/pricing, live 2026-08-11): **Premium Launch $12 / launch** —
  "The only way to launch right now", "Launch Tomorrow - No Wait!",
  guaranteed dofollow backlink from a DR 71 domain, only 10 premium slots
  daily, immediate availability, featured on homepage. **Free Launch $0
  fully booked into 2027** ("Want free? We'll email you when it reopens —
  just start a launch."). SEO Growth Package $59 (was $199). FAQ: all
  launches at 8:00 AM UTC; premium gets 10 dedicated priority slots daily;
  premium launches open "as early as tomorrow, up to 60 days in advance".
  Source confirms LAUNCH_LIMITS.PREMIUM_DAILY_LIMIT = 10 and the 8:00 UTC
  launch hour; payment via a Stripe-style PREMIUM_PAYMENT_LINK inside the
  signed-in flow.
- Duplicate check (platform's own `/api/search`, the nav search query):
  `q=aiconverter` → `{"results":[]}`; `q=ai converter` → zero results; slug
  probes /projects/aiconverter, /projects/ai-converter,
  /projects/aiconverter-app, /projects/ai-converter-app all 404.
- Exact-category peers (search `q=bank` / `q=statement` + live pages, all
  HTTP 200): AI Bank Statement, bank-statementconverter.com, BankScanPro |
  PDF to Excel/CSV, Reconciliate Bank / Credit Card Statements with AI,
  Bank Statement Boss, AIBankStatement, Bank PDF Converter, StatementSheet,
  Bank Statement Converter AI, Bank Statement Engine (also on the live
  `finance-tech` category page) — the venue hosts the category; only this
  product's listing is missing.
- Submission flow: /projects/submit renders the sign-in wall — Login with
  Google, Login with GitHub, or email + password. robots.txt disallows
  /api/, /projects/submit, /sign-in, /payment/, /dashboard.
- ToS (https://open-launch.com/legal/terms, "Last updated: August 11,
  2026"): generic template; section 2 Acceptable Use has **no
  robot/spider/automated-access prohibition** (unlike Product Hunt's ToS and
  Toolbit ToS §7) — flagged for the venue research desk; section 11: all
  payments final and non-refundable.
- Product baseline (aiconverter.app, 2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/` all
  HTTP 200; `/pricing/` and `/receipt-to-csv/` still 404 — the kit claims
  none of those routes.

### Decision recorded (dated 2026-08-11)
- Open-Launch: **PAID listing at $12 (Premium Launch) recommended for
  evaluation; declined for agent-executed submission** — the $12 spend, the
  account creation, and the form submission are Nish's human actions; the
  dated decision line flips to SUBMITTED or DECLINED once Nish decides. Kit
  copy-paste ready in `ops/launch-venues.md` (Name, Tagline, Description,
  category **finance-tech**, Platform Web, Pricing Freemium, launch type
  Premium Launch, Website, canonical links, post-listing check at
  /projects/aiconverter).

### Why the item cannot be closed from a lane (unchanged policy)

open-launch.com is `automation_disposition: unknown` in the fleet venue
policy ledger (`agent-state/growth-loop/venue-policy.json`, allowlist empty),
so `venue-claim claim` exits 4; the launch additionally requires an account
(Google / GitHub / email sign-in) and a $12 payment. Per fleet policy, account
actions and spend stay with Nish — the agent cannot create the account, pay,
or drive the submission form.

### Checks on this lane

- Live checks for homepage, pricing page + FAQ, site-search duplicate check
  and peer search, slug probes, six live peer pages, `finance-tech` category
  page, /projects/submit sign-in wall, robots.txt, ToS, the open-source repo
  constants, and the four canonical product links (2026-08-11) — all as
  recorded above.- No code changed; docs only (`ops/launch-venues.md`, `.lane/report.md`).

---

# 2026-08-12 — Stale unmatched Dodo payment event: code acknowledgment merged; live warning still red because production runs pre-fix code (item 5fd1b106f5, scout 2026-08-09)

**Verdict: the item's code half is COMPLETE and MERGED (PR #47, commit
`405e3b2`, identical to the two stale unmerged attempts
`lane1/ack-stale-unmatched-dodo-event` and `lane1/unmatched-dodo-warning-green`).
The live monitor warning is STILL RED on 2026-08-12 — re-verified live — because
production runs pre-fix code. The remaining step is a Cloudflare Pages deploy,
which no credential or mechanism on this VPS can perform today (verified below,
all live). No D1 cleanup is needed: the merged filter excludes the zero-amount
sandbox event, so a deploy alone turns the warning green.**

### Item recap

The live monitor has warned `Unmatched Dodo payments: 1 payment event did not
match cleanly` since 2026-07-19 for `pay_0NjXVYhB1zUB8cvHx15cO`
(checkout `cks_0NjXV87kao4KZT53vWL41`, `payment.succeeded`, amount **0** USD,
no job_id, `match_status job_not_found`). No customer money moved, so it is
Dodo sandbox/test noise, not a reconcilable payment. Decision 2026-08-10
(accept path a) = exclude zero-amount `payment.succeeded` events with no app
job from the actionable unmatched-payment filter, mirroring the existing
`payment.failed` exemption. Real paid-but-unmatched events (amount > 0, or any
job_id present) still alert.

### Live re-verification 2026-08-12 (private monitor + admin overview)

- `AICONVERTER_MONITOR_STRICT` run against https://aiconverter.app with the
  private admin token: health `ok/ready`, no critical alerts, but
  `severity: warning` → "Unmatched Dodo payments: 1 payment event did not
  match cleanly." — **warning still red**.
- Admin overview `unmatchedPayments` still returns the 2026-07-19 zero-amount
  event row, and the row **lacks the `amount` column** that merged fix
  `405e3b2` adds to the unmatched-payments SQL — direct proof production
  functions are pre-fix.
- Live HTML still serves `assets/index-Dqg0j7kd.js` (the pre-sendBeacon
  bundle, per the earlier finding in this file) vs `assets/index-BVp--8SO.js`
  from a fresh `origin/main` build — production is many merges behind main.

### Why the deploy cannot be done from a lane (all verified 2026-08-12)

1. `wrangler whoami` → "You are not authenticated." — no OAuth session.
2. Fleet `CLOUDFLARE_API_TOKEN` (`~/.config/fleet-console/cf.env`) is
   **Workers-only**: `GET /accounts/<id>/pages/projects/aiconverter/deployments`
   → `10000 Authentication error`; D1 query
   `POST /accounts/<id>/d1/database/376080eb…/query` → `7403 not authorized`;
   Workers scripts list succeeds. Pages:Edit and D1 are both absent.
3. No deploy workflow exists in the repo: `.github/workflows/` on `main`,
   `ci/pr-checks`, `ci/vps-verify-runners`, and `review-gate` contain only
   `ci.yml`, `review-gate.yml`, `secret-scan.yml`; `deploy-production.yml`
   (and `d1-remote-restore-evidence.yml`) referenced by the fleet
   `auto-deploy.py` return HTTP 404 from GitHub Actions.
4. Fleet release tracking is reporting phantom deploys (fleet-infra defect,
   outside this worktree): `last-good-release.json` records sha
   `95ab18588c0d14f33013df3c693c52e1b7b6ca94` and run 31555365351 as
   "shipped" 2026-08-12T07:56, but that sha and run do not exist on GitHub,
   and the fleet's own `release-state-aiconverter-app.json` still pins the
   live marker to the old bundle `assets/index-Dqg0j7kd.js`. The auto-deploy
   "shipped 2 change(s)" claim did not update production.

### Remaining step to close the item (Nish-held)

One Cloudflare Pages deploy of a clean `origin/main` build with a
Pages:Edit-capable credential:

```bash
# from a clean origin/main checkout, with a Pages:Edit credential
SAFE_DEPLOY_APPROVED='pages deploy dist --project-name aiconverter --branch main' \
  wrangler pages deploy dist --project-name aiconverter --branch main
```

After deploy the monitor warning goes green automatically (the merged
zero-amount filter drops the stale sandbox event; no D1 DELETE/UPDATE is
needed and no such admin surface exists). Also flag the fleet release-tracking
defect in step 4 for the lane manager / release desk.

### Checks on this lane (2026-08-12, clean `origin/main` checkout)

- `npm run check:pricing` — Pricing is consistent.
- `node --test tests/*.test.mjs` — 120 pass, 0 fail.
- `npm run build` — green; bundle `assets/index-BVp--8SO.js`.
- Live monitor (strict) — health green; the one unmatched-payment warning
  persists (pre-fix production), as recorded above.
