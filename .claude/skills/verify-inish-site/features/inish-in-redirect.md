# inish.in redirect

inish.in is retired. Every request to `inish.in` or `www.inish.in`, on any path, answers `301` to `https://nish.sh/daily`.

## Sub-features

- `redirect-root` sends `/` to the daily page.
- `redirect-path` sends any other path to the daily page too.

## How to get to it (user POV)

- Open `https://inish.in/` or an old inish.in link.

## Driving it with curl and headless Chrome

Preconditions:

- The second server from the skill's Launch section answers on port `8788` (`npx cf dev --host inish.in --port 8788`).

- **Root.** Run `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:8788/ | tee "$OUT/inish-in-root.txt"`. It prints `301 https://nish.sh/daily`.
- **Path.** Run `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:8788/some/old/post | tee "$OUT/inish-in-path.txt"`. It prints `301 https://nish.sh/daily`.

## Gotchas

- `curl -H 'Host: inish.in' http://localhost:$PORT/` on the main server answers 404, not 301. Local dev forwards every request to the first route's host (`nish.sh`), whatever the `Host` header says ([`dev.host`](https://developers.cloudflare.com/workers/wrangler/configuration/#local-development-settings)). That is why this feature needs the second server.
- After a deploy, also run the live check from AGENTS.md: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://inish.in/`.
