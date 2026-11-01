# Nish's Daily

The front page at <https://nish.sh/daily>. It is a static site built from committed
data and served by one Cloudflare Worker (`worker.js`, route policy in `policy.js`,
route data in `public-paths.json`).

`inish.in` is retired. Its routes stay on the worker only to answer with a 301 to
<https://nish.sh/daily>.

## How it is built and run

- The source lists live in `inish_daily/`. `fetch_candidates.py` reads the sources,
  `jev_rank.py` ranks them, `build_daily.py` renders `public/daily/`.
- `npm run build` renders the page into `dist/`. `npm test` runs the Node and
  Python suites. `npm run dev` serves it locally.
- One workflow, `.github/workflows/ci.yml`, runs on GitHub-hosted runners. Each
  job says why it exists next to it. A pull request runs the tests and deploys a
  preview, a push to `main` deploys the worker and smoke-checks the live page.
- To switch CI off, delete `ci.yml` and clear the required checks in
  Settings → Rules → Rulesets, or merges stay blocked.

## Version tags

A tag marks one published state of the site. The first tag, `v0.1.0`, marks the
commit that closes the 2026-10-23 glue audit. Cut it once the audit's own
precondition holds: the fleet-ops half of the audit (Nishfleet/fleet-ops#10125)
is landed.

To cut it, and each later one:

1. Land the change on `main`.
2. Set `version` in `package.json` to the tag number.
3. `git tag -a v0.1.0 -m "v0.1.0: <one line>" <merge commit>`.
4. `git push origin v0.1.0`.
