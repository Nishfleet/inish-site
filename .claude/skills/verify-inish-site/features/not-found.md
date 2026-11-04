# Not found page

Any path under `/daily/` that is not a served file answers 404 with the branded "Not found" page and `Cache-Control: no-store`.

## Sub-features

- `404-status` answers 404, never 200 or a redirect.
- `404-page` shows the branded page for GET and an empty body for HEAD.

## How to get to it (user POV)

- Open a mistyped link such as `https://nish.sh/daily/old-post`.

## Driving it with curl and headless Chrome

Preconditions:

- Doctor passed on `$PORT`.

- **GET.** Run `curl -s -D "$OUT/404-headers.txt" -o "$OUT/404.html" -w '%{http_code}\n' "http://localhost:$PORT/daily/no-such-page" | tee "$OUT/404-status.txt"`. It prints `404`. Then `grep -o '<title>[^<]*</title>' "$OUT/404.html"` prints `<title>Not found · Nish’s Daily</title>`, and `grep -i cache-control "$OUT/404-headers.txt"` prints `no-store`.
- **HEAD.** Run `curl -sI "http://localhost:$PORT/daily/no-such-page" | head -1`. It prints a `404` status line.

## Gotchas

- Paths outside `/daily` never reach this Worker in production (its routes cover only `nish.sh/daily` and `nish.sh/daily/*`). Locally every path reaches it, so test 404s under `/daily/`.
