# Canonicalize apex redirect — `http://` and `www.`

The worker's `canonicalize(url)` collapses every non-canonical host
to a single 301: the bare-apex HTTPS origin `https://inish.in/`.
`http://inish.in/`, `http://www.inish.in/`, `https://www.inish.in/`,
and the `www` + `http` combined case all collapse to the same
canonical URL instead of serving three extra copies of the site.

## How to drive it

### Live (the only path that proves the redirect)

The local URL-rewrite shim forwards loopback requests with a
`https://inish.in/` URL so the `canonicalize()` check accepts them;
a local probe of the redirect itself would chase itself in a loop.

```bash
# http -> https
curl -sI http://inish.in/ | head -1
curl -sI http://inish.in/ | awk 'tolower($1)=="location:"{print $2}'
# Expect: 301, then https://inish.in/

# www -> apex
curl -sI https://www.inish.in/ | head -1
curl -sI https://www.inish.in/ | awk 'tolower($1)=="location:"{print $2}'
# Expect: 301, then https://inish.in/

# combined
curl -sI http://www.inish.in/ | awk 'tolower($1)=="location:"{print $2}'
# Expect: 301, then https://inish.in/

# bare-apex HTTPS (the canonical form) does NOT redirect
curl -sI https://inish.in/ | head -1
# Expect: 200 (or whatever the live edge returns for /)
```

The bare-apex HTTPS request must NOT redirect. `tests/test_middleware.py`
pins the contract on the in-process side; the live probe is the
network-level proof.

## What proves success

- `http://inish.in/`, `https://www.inish.in/`, and
  `http://www.inish.in/` all 301 to `https://inish.in/`.
- `https://inish.in/` does NOT redirect (canonical).
- The 301 response carries the full security-header set (HSTS rides
  on the canonicalize 301, so the browser learns the apex is
  HTTPS-only on the very first hit).

## Local honesty note

The local launch cannot drive the canonicalize redirect: the shim
forwards loopback requests with the canonical URL so the worker
proceeds. The 301 to `https://inish.in/...` that an un-shimmed
worker emits for any non-canonical host is the redirect the live
edge emits, and the live probe above is the only thing that proves
it. A local probe of `http://127.0.0.1:4891/about` would chase the
shim's loopback rewrite; that is by design.
