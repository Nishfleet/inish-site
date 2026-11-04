# Daily build

`python3 -m inish_daily.build_daily` turns the newest edition in `data/editions/` and its ranked pool into `public/daily/index.html`, `latest.json` and `feed.xml`. The fleet's daily job runs it each morning (`automation/HERMES_DAILY.md`), then pushes; the push deploys.

## Sub-features

- `build-reproduce` rebuilds the committed page byte for byte from committed data.
- `build-validate` refuses a story with no fact, take or caveat, or with generic copy.

## How to get to it (user POV)

- A reader sees its output as the daily page. An operator runs it as step 5 of `automation/HERMES_DAILY.md`.

## Driving it with curl and headless Chrome

Preconditions:

- `git status --short --untracked-files=no` is empty, so any change after the build comes from the build.

- **Reproduce.** Run `python3 -m inish_daily.build_daily | tee "$OUT/build.txt"`, then `git status --short --untracked-files=no | tee "$OUT/build-git-status.txt"`. The first prints `built latest=<date> stories=<n> scanned=<n> sources=<ok>/<total>`, exit code `0`. The second prints nothing: the committed page is exactly what the committed data builds.
- **Validate.** Run `python3 -m unittest tests.test_build_daily 2>&1 >/dev/null | tail -3 | tee "$OUT/build-validate.txt"`. It ends in `OK`. The tests print build lines on stdout, so the redirect keeps only unittest's summary from stderr. These tests feed `tests/fixtures/candidates.json` and bad stories through the builder.
- **Served.** Restart the dev server, then repeat `latest-json.md`. Its date equals `<date>` from the build line.

## Gotchas

- The build writes into tracked files (`public/daily/*`, and `data/pools/<date>.json` when no pool is committed). If `git status` shows a change, that change is the finding: report it, then restore with `git restore -- public/daily data/pools` unless your change meant to alter the output.
- The build reads `data/candidates/<date>.json` when it exists. That folder is git-ignored, so a stray local candidates file can change the output. Check `ls data/candidates` before you trust a diff.
- The newest edition can be days older than today. That is a content gap (the daily job did not run), not a build failure.
