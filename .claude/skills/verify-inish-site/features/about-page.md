# About page — `/about.html`

The canonical identity surface for AI engines and the only `/about*`
path the live edge serves (commit fd75bb4, 2026-08-21). Replaces the
earlier `/about` redirect target identity.

## How users reach it

Open `https://inish.in/about.html`, or follow the link from
`https://github.com/nish3451` (profile → website field, which the
machine's `gh` token still cannot set — see
`MEMORY.md` "public GitHub profile website field").

## How to drive it

```bash
# Local
BASE=http://127.0.0.1:4891
curl -fsS "$BASE/about.html" -o /tmp/verify-inish-about.html
grep -c '<title>' /tmp/verify-inish-about.html
grep -c 'Nish' /tmp/verify-inish-about.html
grep -oE 'rel="me[^"]*"' /tmp/verify-inish-about.html | wc -l   # at least 2 (github, x, tinystudio)
grep -c 'application/ld+json' /tmp/verify-inish-about.html

# Live
curl -fsS https://inish.in/about.html -o /tmp/verify-inish-live-about.html
grep -c '<title>' /tmp/verify-inish-live-about.html
grep -c 'Nish' /tmp/verify-inish-live-about.html
grep -oE 'rel="me[^"]*"' /tmp/verify-inish-live-about.html | wc -l
```

The expected counts are: exactly 1 `<title>`, at least 1 `Nish`
mention, at least 2 `rel="me` (prefix) links (GitHub + X/Twitter +
Tiny Studio — the actual HTML emits `rel="me noopener noreferrer"`,
so the harness greps for the prefix), exactly 1 JSON-LD block.
`tests/test_mobile_masthead.py` and the
`features/identity-metadata` work pin the contract.

## What proves success

- HTTP 200.
- The page references Nish by name, not "the site" or "we".
- The Person JSON-LD is present (single `@type: "Person"` block, not
  the WebSite one used on `/`).
- At least two `rel="me` (prefix) outbound links for identity verification:
  `https://github.com/nish3451` and `https://x.com/NishantRArora`.

## Local honesty note

The local 200 on `/about.html` is a real worker-driven 200 — the path
is in `publicPaths`, the asset binding serves the file, the security
headers ride on the response. The same probe against the live site
must return the same body up to the Cloudflare beacon script the
verifier strips. The 301 to `https://inish.in/about.html` from a
request to `/about` is the redirect map (the canonicalize redirect
also fires; both layers agree on the destination).
