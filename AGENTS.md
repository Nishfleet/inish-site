# Project AGENTS

Launch stage: 0 (day one). Next trigger: a sign-up or subscribe form on nish.sh (none planned), which brings stage 1.

Success: days in the last 30 with a new edition live (target 30 of 30). Baseline: 6 of 30 on 2026-10-15 (`data/editions/` holds 2026-09-28, 09-29 and 10-12 to 10-15 in that window). Measured by: `node -e 'const s=new Date(Date.now()-29*864e5).toISOString().slice(0,10);console.log(require("fs").readdirSync("data/editions").filter(f=>f>=s).length)'` on an up-to-date `main`. Whether Nish reads it has no counter yet.

- Read `MEMORY.md` before architectural, deploy, or positioning decisions; read `ERRORS.md` before retrying a failed approach.
- Keep the site lightweight: static HTML, CSS, JS, and the one Worker. No helper scripts.
- Work on `main`. Run `npm test` before pushing; the push deploys.
- Check visual changes in a browser at desktop and phone widths before pushing.

## Run it and prove it

Live: https://nish.sh/daily, one page served by `worker.js` from the static assets `inish_daily/build_daily.py` writes. `inish.in` answers 301 to that URL and nothing else. There is no health route: the page, `latest.json` and the feed are the whole surface, so the page is the check.

- Run: `npm test` (node tests, then `python3 -m unittest`), then push to `main`; the push deploys.
- Prove today's edition is live: `curl -s https://nish.sh/daily/latest.json | jq -r .date` prints the edition's day, and it is today in IST. A stale day means the daily build did not run (`inish_daily/build_daily.py`; the publish step is in `MEMORY.md`), and a 404 means the deploy has not landed.
- Prove the page and the redirect: `curl -s https://nish.sh/daily | grep -o '<title>[^<]*</title>'` prints `<title>Nish’s Daily · <the same day></title>`, and `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://inish.in/` prints `301 https://nish.sh/daily`.
- Test login: none. Every path here is public.
