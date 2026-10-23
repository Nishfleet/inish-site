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
- Every push to `main` runs the CI workflow, which tests, deploys the worker, and
  smoke-checks the live page. A pull request runs the tests only.

## Automation Off-Switches

Every workflow in `.github/workflows/`, what fires it, and how to switch it off.
Deleting the file switches the workflow off, because GitHub runs only what that
directory holds. Removing one trigger is the smaller step when the rest of the
file must stay for a manual run.

| Workflow | Fires on | Off-switch |
| --- | --- | --- |
| `ci.yml` | Every pull request, every push to `main`, and a manual run from the Actions tab | Delete the file. It reports the `test` check that the `main-no-force-push` ruleset requires, so clear that check under Settings → Rules → Rulesets first, or every pull request waits on a check that never reports. The push to `main` also deploys the worker, so the site stops updating until the file comes back. |
| `agent-dispatch.yml` | Issue labels and comments, pull-request events, a completed CI run, every 6 hours, and a manual run | Delete the file to stop the fleet from starting worker runs on this repo. Delete the `schedule:` block to keep event-driven dispatch and drop the 6-hour sweep. The dispatch logic lives in `Nishfleet/fleet-ops`, so this file is only a trigger stub and the site does not depend on it. |
| `lighthouse.yml` | After a successful production deploy, Mondays at 04:41 UTC, and a manual run | Delete the file to stop the page audit. The site does not depend on it. |

The two stubs above call reusable workflows in `Nishfleet/fleet-ops` at `@main`, and
`.pinact.yaml` exempts that ref on purpose: the dispatch is addressed by name, so
pinning the callee would fork it from the version the dispatcher runs.

## Version tags

A tag marks one published state of the site. `v0.1.0` is the first one, on the
commit that closed the 2026-10-23 glue audit.

To cut the next one:

1. Land the change on `main`.
2. `git tag -a v0.1.1 -m "v0.1.1: <one line>" <merge commit>`.
3. `git push origin v0.1.1`.

The version in `package.json` tracks the tag.
