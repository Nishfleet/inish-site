# Deny paths — `404 + branded /404.html`

The deny branch of the worker's `decide(pathname)` is the security
floor. Every path not in `public-paths.json`'s `publicPaths` and not
matching `fontPath` is denied: the worker fetches the branded
`/404.html` from the asset binding, returns it with status 404, and
applies the full security-header stack. A widen-allowlist regression
here is the regression the in-process `tests/test_worker_edge.test.mjs`
suite is built to catch (the deny property is provable by behavior,
not by reading the source — a `false &&` prefix on the deny check
keeps every static test green while unlisted paths reach the asset
binding).

## How to drive it

```bash
BASE=http://127.0.0.1:4891
for path in /admin /admin/ /admin/login /secrets.json /.env /wp-login.php \
            /daily/2026-08-08 /daily/2026-08-08/story-1 \
            /404.html /og-image.jpg /apple-touch-icon.ico \
            /fonts/nope.ttf /fonts/nope.woff2/ /fonts/OFL.md \
            /fonts/nope.woff2.css /latest.json.bak /index.html.bak; do
    status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
    echo "$status  $path"
done
# Every line must be 404.
```

The 404 body itself is the branded `/404.html` asset the worker
fetches from the binding (see `worker.js`'s `notFoundResponse`):

```bash
curl -s "$BASE/admin" -o /tmp/verify-inish-deny.html
grep -c 'Not found\|404' /tmp/verify-inish-deny.html
```

The full deny sample set is in `tests/test_worker_edge.test.mjs`'s
`DENY_SAMPLES` array; the Python cross-source guard is
`tests/test_middleware.py`.

## What proves success

- Every probed path returns 404.
- The 404 body is the branded `/404.html` (the worker does not fall
  back to the historical plain 404 unless the asset binding is
  unreachable).
- The response carries the full security-header set:
  `Strict-Transport-Security`, `Content-Security-Policy`,
  `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`.
- `Cache-Control: no-store` is set on the 404 response.
- `HEAD /admin` is bodyless (the worker's `notFoundResponse` short-
  circuits `HEAD` before fetching the asset).

## Local honesty note

The local deny probe is a real worker-driven 404 with the real
branded 404 body — the local binding serves the staged `404.html`
through the asset binding the same way the live binding does.
A `pkill` of the worker (or a `wrangler dev` restart) does not
change the deny path; the deny branch is a pure function of
`decide(pathname)`.
