# Project Memory

Durable project truth that the code alone does not tell you.

## How it works

- inish.in is Nish Daily. The feed is the root page; there are no archives (old `/daily/*` links 301 to the root equivalents, archive URLs 404).
- The site is static files served by one Cloudflare Worker (`worker.js`, route policy in `policy.js`, route data in `public-paths.json`). Everything in `public/` ships; nothing else does.
- `inish_daily/fetch_candidates.py` gathers the day's candidates; `inish_daily/build_daily.py` renders `data/editions/<date>.json` into `index.html`, `latest.json`, `feed.xml` and `sitemap.xml`. Page styling is `styles.css`.
- Every push to `main` runs the `CI` workflow: tests, then `wrangler deploy`, then a live smoke check. Pull requests run tests only. `main` takes direct pushes (ruleset `main-no-force-push` blocks only force-push and deletion).
- Local: `npm run dev` (wrangler dev), `npm test` (Node + Python suites).
- The daily edition is started by the fleet (`Nishfleet/fleet-ops` `agent.yml`, job `inish-daily`, 07:30 IST) following `automation/HERMES_DAILY.md`.

## Editorial decisions

- The edition is gated on quality, not count: 0-8 stories, and a day where nothing survives checking is a valid edition. Never pad.
- Every story carries a `fact` (checkable, linked to `evidence_url`), a first-person `take`, and a `caveat`. The builder enforces all three and refuses generic copy; weakening that validator defeats the point.
- Nish chose first-person opinions backed by facts (2026-08-03).

## Rejected paths

- Banning filler words: the writer rotates to synonyms. Structural constraints the builder can enforce work; vocabulary bans do not.
- Sourcing from brand-new GitHub repos: their only evidence is their own README.

## Open items outside this repo

- GitHub profile website field for `nish3451` should be `https://inish.in/`; it needs a `user`-scoped token or a manual edit at github.com/settings/profile.
