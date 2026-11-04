# inish-site verification map

This directory is the maintained source for verifying what a reader of Nish's Daily sees. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- A server from the skill's Launch section answers on `http://localhost:$PORT`, and Doctor passed.
- `$OUT` is this run's evidence directory.
- `jq` and `google-chrome` are on `PATH`.
- Never drive a server that this run did not start.

## Driving conventions

- Drive the URLs a reader uses: `/daily`, `/daily/`, `/daily/latest.json`, `/daily/feed.xml`, any missing path, and `inish.in`.
- Treat every command as literal.
- Compare dates against the newest file in `data/editions/`, never against today's date. A stale edition is a content fact, not a code failure (see `daily-build.md`).

## Proof and skip reporting

- Save each curl's output with `| tee "$OUT/<feature>.txt"`.
- Name the feature file and the URL with each artifact.
- If a check cannot run, report the command and the reason. Never report it as passed through another path.

## Features

- [daily-page.md](daily-page.md): the front page at `/daily`.
- [latest-json.md](latest-json.md): the edition as JSON.
- [feed.md](feed.md): the RSS feed.
- [not-found.md](not-found.md): the branded 404 page.
- [inish-in-redirect.md](inish-in-redirect.md): inish.in sends readers to `/daily`.
- [daily-build.md](daily-build.md): the Python build that writes the page.
