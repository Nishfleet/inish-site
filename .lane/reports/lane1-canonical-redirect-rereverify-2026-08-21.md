# Lane 1 report — redirect `http://` and `www.` to the canonical `https://inish.in/`

Branch: `lane1/canonical-redirect-rereverify-2026-08-21`
Date: 2026-08-21
Base: fresh `origin/main` (`5b270e4`)

## Item

> redirect `http://` and `www.` to the canonical `https://inish.in/`
> instead of serving three extra copies of the site

## Verdict

**The item is already delivered and live-verified. This run is a
re-verification, not a code change.**

The canonical host/scheme redirect shipped in PR #84 (commit `cd6fbe2`,
merged 2026-08-17) and is live: all three non-canonical origins
(`http://inish.in/`, `https://www.inish.in/`, and the combined
`http://www.inish.in/`) 301 in a single hop to `https://inish.in/` with
the path and search preserved and HSTS attached. There are no extra
copies of the site left to serve.

## What the fix is (code state)

- `public-paths.json` — `canonicalOrigin: "https://inish.in/"` is the
  single source of truth for the canonical origin.
- `functions/policy.js` — exports `canonicalize(url)`: returns `null`
  on the canonical origin, otherwise the canonical URL with the
  request's path and search preserved. Comment states the three-copies
  motivation verbatim.
- `worker.js` and `functions/_middleware.js` — both call
  `canonicalize()` before `decide()`; the canonical 301 carries HSTS
  and short-circuits ASSETS (a redirect never touches the assets
  binding).
- `wrangler.jsonc` — the Worker routes the `www.inish.in` host patterns
  as well as the apex, so the Worker actually receives and 301s the
  www traffic (Cloudflare's own `www` → apex redirect is not relied on).
- Tests pin the contract behaviorally:
  - `tests/test_worker_edge.test.mjs` — drives the worker with
    `http://inish.in`, `https://www.inish.in`, and `http://www.inish.in`
    origins; asserts 301, exact `Location`, HSTS, zero ASSETS reads;
    HEAD; and the canonical-origin loop guard (no self-redirect).
  - `tests/test_middleware_deny.test.mjs` — focuses on `canonicalize`,
    including negative-space tests for dropping the protocol or host
    check.
  - `tests/test_middleware.py` — pins `canonicalOrigin`, the
    `canonicalize` imports in both edges, and rejects inlined host/
    scheme literals in the edge sources.

## Live evidence (2026-08-20 19:20Z, from this worktree)

```
$ for u in "http://inish.in/" "https://www.inish.in/" "http://www.inish.in/" "https://inish.in/"; do curl -sS -o /dev/null -D - --max-time 15 "$u" | grep -iE "^(HTTP|location|strict-transport)"; done

=== http://inish.in/ ===
HTTP/1.1 301 Moved Permanently
Location: https://inish.in/
Strict-Transport-Security: max-age=31536000; includeSubDomains

=== https://www.inish.in/ ===
HTTP/2 301
location: https://inish.in/
strict-transport-security: max-age=31536000; includeSubDomains

=== http://www.inish.in/ ===
HTTP/1.1 301 Moved Permanently
Location: https://inish.in/
Strict-Transport-Security: max-age=31536000; includeSubDomains

=== https://inish.in/ ===
HTTP/2 200
strict-transport-security: max-age=31536000; includeSubDomains
```

Path and search preservation on non-root URLs:

```
=== http://inish.in/feed.xml ===
HTTP/1.1 301 Moved Permanently
Location: https://inish.in/feed.xml

=== https://www.inish.in/?q=1 ===
HTTP/2 301
location: https://inish.in/?q=1

=== http://www.inish.in/daily?from=old ===
HTTP/1.1 301 Moved Permanently
Location: https://inish.in/daily?from=old
```

All three variants 301 in a single hop (no redirect chains), the
canonical origin serves 200, and every response carries HSTS. The live
hostname is on the current merged head, so the fix is what the tests
pin:

```
$ bash scripts/check_live_current.sh
verified_feed_only date=2026-08-20 commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
verified_live_current commit=5b270e4353754ed98eeceef905f28bd3002bdc1b
```

## Test evidence

```
$ npm test
# tests 17
# pass 17
# fail 0

$ python3 -m unittest discover -s tests -p 'test_middleware.py'
Ran 8 tests in 0.001s
OK
```

## Files touched in this run

- `.lane/reports/lane1-canonical-redirect-rereverify-2026-08-21.md` —
  new lane-unique evidence report (this file).

No other files in the worktree were modified. The code change that
delivers the item remains PR #84 (`cd6fbe2`), already merged and live.

## Recommendation

Close the item. It was delivered by PR #84 on 2026-08-17 and remains
live-verified on 2026-08-20/21. Do not re-dispatch unless a future
change removes `canonicalize()` from the edge entrypoints or the live
probe above stops 301ing one of the three non-canonical origins.
