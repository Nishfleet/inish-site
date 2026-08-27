# Legacy redirects — `/daily/*` and `/about`

The redirect map in `public-paths.json`'s `redirects` field collapses
old URLs to their current root-level equivalents. These are the
preserved-by-design links from before the 2026-08-03 founder-surface
removal; `MEMORY.md` makes preserving them a hard rule, and archive
URLs intentionally return 404 (they are a separate `DENY_SAMPLE`).

## How to drive it

```bash
BASE=http://127.0.0.1:4891
# Each pair: (legacy path, expected 301 Location)
# Locally, the URL-rewrite shim forwards the request to the production
# worker with a `https://inish.in/` URL, so the worker's redirect map
# resolves against the canonical origin. The `Location` header is the
# canonical absolute URL (e.g. `https://inish.in/about.html`), which is
# the same value a live probe of the same legacy path would receive.
for pair in '/index.html https://inish.in/' \
            '/daily https://inish.in/' \
            '/daily/ https://inish.in/' \
            '/daily/index.html https://inish.in/' \
            '/daily/app.js https://inish.in/app.js' \
            '/daily/styles.css https://inish.in/styles.css' \
            '/daily/latest.json https://inish.in/latest.json' \
            '/daily/feed.xml https://inish.in/feed.xml' \
            '/daily/sitemap.xml https://inish.in/sitemap.xml' \
            '/about https://inish.in/about.html'; do
    legacy="${pair% *}"
    expected="${pair#* }"
    actual=$(curl -sI "$BASE$legacy" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r\n')
    [ "$actual" = "$expected" ] && echo "OK  $legacy -> $actual" || echo "FAIL $legacy -> $actual (expected $expected)"
done
```

The expected 301 is the value of the right-hand side of the redirect
map in `public-paths.json`, resolved against the canonical origin
(`https://inish.in/`). The query string is preserved across the
redirect: `?foo=bar` round-trips.

```bash
BASE=http://127.0.0.1:4891
location=$(curl -sI "$BASE/about?utm_source=test" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r\n')
echo "$location"
# Must contain ?utm_source=test
```

## What proves success

- Every redirect pair returns 301 with the exact `Location` header
  the redirect map specifies, resolved against the canonical
  origin.
- The query string round-trips: `?key=value` survives the 301.
- The redirect response carries the full security-header set
  (HSTS, CSP, Referrer-Policy, nosniff, frame guard).
- The redirect target returns 200 on the second hop (not 404 from
  a typo in the redirect map).

## Local honesty note

The local 301 to `https://inish.in/about.html` (instead of
`http://127.0.0.1:4891/about.html`) is the URL-rewrite shim's
correct behavior: the shim forwards the loopback request to the
production worker with a `https://inish.in/` URL so the
`canonicalize()` check accepts it, then the production worker's
redirect map rewrites `/about` to `/about.html` against the
canonical origin. A `-L` follow would chase the 301 to the live
site, which is not what the harness wants — the harness drives
non-redirect paths only, and treats the 301 itself as the
observable. The test above asserts the canonical-absolute URL
form, so local and live probes both pass on the same expected
value.
