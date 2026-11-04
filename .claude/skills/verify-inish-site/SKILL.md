---
name: verify-inish-site
description: Drive Nish's Daily (the nish.sh/daily page, its latest.json, its RSS feed, the 404 page and the inish.in redirect) on a local cf dev server and capture curl and screenshot proof. Use before pushing any change to worker.js, policy.js, public/, build.mjs, inish_daily/ or the Cloudflare config, and when asked to verify, run or screenshot the site.
---

# Verify inish-site

The whole user surface is public HTTP: one page, one JSON file, one feed, a 404 page, and a redirect. There is no login, no form and no database. `features/README.md` lists every feature; drive the feature files that match your change.

## Launch

Run from the repo root. Pick a free port so two runs never share one server.

```sh
npm ci
PORT=8787
OUT="/tmp/verify-inish-site/$(date +%Y%m%dT%H%M%S)"; mkdir -p "$OUT"
setsid npm run dev -- --port "$PORT" > "$OUT/dev.log" 2>&1 &
echo $! > "$OUT/dev.pid"
until grep -q "Ready on http://localhost:$PORT" "$OUT/dev.log"; do sleep 1; done
```

- `npm run dev` runs `node build.mjs` (writes `dist/`), then `cf dev`. cf hands the dev server to Wrangler, so log lines start with `[wrangler:info]`.
- Ready line: `[wrangler:info] Ready on http://localhost:$PORT`. The first request after it already serves the page.
- The `inish.in` redirect needs its own server. Local dev forwards every request to the host of the first route (`nish.sh`), and a `Host:` header does not change that ([Wrangler configuration, `dev.host`](https://developers.cloudflare.com/workers/wrangler/configuration/#local-development-settings)). Start the second server only when you drive `features/inish-in-redirect.md`:

```sh
setsid npx cf dev --host inish.in --port 8788 > "$OUT/dev-inish-in.log" 2>&1 &
echo $! > "$OUT/dev-inish-in.pid"
until grep -q "Ready on http://localhost:8788" "$OUT/dev-inish-in.log"; do sleep 1; done
```

## Doctor

Run this first, and again whenever a result looks wrong. It is read-only.

```sh
ss -ltnp "sport = :$PORT"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:$PORT/daily"
curl -s "http://localhost:$PORT/daily/latest.json" | jq -r .date
ls data/editions | tail -1
```

- `ss` shows a `workerd` listener on the port. If the port has a listener you did not start, pick another port. Never drive a server you did not start.
- `/daily` answers `200`.
- The `latest.json` date equals the newest file name in `data/editions/`. If it does not, the server is serving a stale `dist/`; stop it and launch again.

## Drive

Every check is a plain `curl` against `http://localhost:$PORT` plus headless Chrome for screenshots. The feature files hold the exact commands and the expected output:

- `features/daily-page.md`: `/daily` and its title.
- `features/latest-json.md`: `/daily/latest.json`.
- `features/feed.md`: `/daily/feed.xml`.
- `features/not-found.md`: the 404 page.
- `features/inish-in-redirect.md`: inish.in answers 301.
- `features/daily-build.md`: `python3 -m inish_daily.build_daily` rebuilds the page from committed data.

## Evidence

- Everything goes to `$OUT` (`/tmp/verify-inish-site/<timestamp>/`): curl output as `.txt`, response bodies, and screenshots as `.png`.
- Screenshots: take both widths, because AGENTS.md asks for desktop and phone. Use Chrome's built-in headless screenshot ([Chrome headless docs](https://developer.chrome.com/docs/chromium/headless)), or Chrome DevTools MCP when the session has it:

```sh
google-chrome --headless --disable-gpu --hide-scrollbars --window-size=390,844 --screenshot="$OUT/daily-390.png" "http://localhost:$PORT/daily"
google-chrome --headless --disable-gpu --hide-scrollbars --window-size=1280,900 --screenshot="$OUT/daily-1280.png" "http://localhost:$PORT/daily"
```

- Open each PNG and look at it. Proof is the masthead with the edition date and the story cards laid out without overflow, not just a file that exists.
- Proof standards: drive the real URLs a reader uses. Capture the request and the response (status, headers that matter, body excerpt). For the daily build, the proof is the build output line plus `git status --short` after it.
- A local run proves the code. It does not prove production. Production proof is the three live curls in AGENTS.md, after the deploy.

## Cleanup

Kill only what this run started, by the PIDs it saved. `npm run dev` starts child processes (cf, Wrangler, workerd), so kill the process group. `setsid` in Launch gave each server its own group; without it, a non-interactive shell puts the server in the shell's own group, and this command would kill your shell.

```sh
for f in "$OUT"/dev*.pid; do kill -- -"$(ps -o pgid= "$(cat "$f")" | tr -d ' ')" 2>/dev/null; rm -f "$f"; done
ls "$OUT"
```

- `ls "$OUT"` must still list the evidence files. Cleanup never deletes `$OUT`.
- `dist/` and `.cloudflare/` are git-ignored build output; leave them.
- If the daily build changed tracked files, see `features/daily-build.md` before you restore them.
