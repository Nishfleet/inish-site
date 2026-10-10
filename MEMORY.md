# Project Memory

Durable project truth that the code alone does not tell you.

## How it works

- The Daily is the front page at https://nish.sh/daily (Nish's browser new-tab page). inish.in is retired: its routes stay on this worker only to answer every request with a 301 to https://nish.sh/daily. Do not touch inish.in DNS or the domain.
- The site is static files served by one Cloudflare Worker (`worker.js`, route policy in `policy.js`, route data in `public-paths.json`). The worker is routed on `nish.sh/daily` and `nish.sh/daily/*`, which are more specific than the zone's catch-all `nish.sh/*` (worker `fleet-console`, another repo; never edit it), so Cloudflare sends only /daily here. Files under `public/daily/` are served at the same URL path; `/daily` and `/daily/` serve `public/daily/index.html`.
- `inish_daily/sources.json` is the single list of sites (groups, feeds, title filters). `fetch_candidates.py` reads it and writes `data/candidates/<date>.json` (not committed); `jev_rank.py` ranks it with TypeSafe Jev; `build_daily.py` renders `data/editions/<date>.json` plus the ranked pool into `public/daily/index.html`, `latest.json`, `feed.xml`, and stores the compact pool in `data/pools/<date>.json` so the page rebuilds from committed data. An edition may carry its own `sections` and `wire` (same item shape); those then win over the pool.
- Page: masthead and IST date, a "Compiled from X of Y sources" bar, section nav, lead, picks, one card per source group, a Wire column. No JS; the CSS is inlined at build (`build.mjs`, beasties) and allowed by CSP hash.
- Every push to `main` runs the `CI` workflow: tests, then `wrangler deploy`, then a live smoke check. Pull requests run tests only. `main` takes direct pushes (ruleset `main-no-force-push` blocks only force-push and deletion).
- Local: `npm run dev` (wrangler dev), `npm test` (Node + Python suites).
- The daily edition is started by the fleet (`Nishfleet/fleet-ops` `agent.yml`, job `inish-daily`, 07:30 IST plus a 10:30 IST catch-up; by hand: `gh workflow run agent.yml --repo Nishfleet/fleet-ops -f job=inish-daily`) following `automation/HERMES_DAILY.md`. It publishes to nish.sh/daily.
- Incident 2026-09-29 to 2026-10-10: the edition went stale because fleet-ops#8954 ("remove all unnecessary machinery") deleted the `inish-daily` job and its crons. A later fleet-ops PR restored it, retargeted to nish.sh/daily.

## Editorial decisions

- The edition is gated on quality, not count: 0-8 stories, and a day where nothing survives checking is a valid edition. Never pad.
- Every story carries a `fact` (checkable, linked to `evidence_url`), a first-person `take`, and a `caveat`. The builder enforces all three and refuses generic copy; weakening that validator defeats the point.
- Nish chose first-person opinions backed by facts (2026-08-03).
- Hype, listicles and "X now matches Y" parity headlines are dropped before ranking (`filters.skip_title_regex` in sources.json).

## Rejected paths

- Banning filler words: the writer rotates to synonyms. Structural constraints the builder can enforce work; vocabulary bans do not.
- Sourcing from brand-new GitHub repos: their only evidence is their own README.
- A route of `nish.sh/daily*`: it would also capture `/dailyfoo` from fleet-console, so the two exact routes are used instead.

## Open items outside this repo

- GitHub profile website field for `nish3451` should be `https://nish.sh/daily`; it needs a `user`-scoped token or a manual edit at github.com/settings/profile.
