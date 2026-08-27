# Daily feed — `/`

The anonymous marketing feed that IS the site. inish.in replaced the founder
surface on 2026-08-03 (Nish); the feed at `/` is the only thing the
homepage serves, and the page itself is the generator output from
`scripts/build_daily.py`.

## How users reach it

Open `https://inish.in/` in a browser, or follow the RSS or JSON feed
link in the head. The page is plain HTML — no client-side fetch, no
auth, no account.

## How to drive it

### Live (the only path that proves the full body)

The local launch cannot drive `/` — see EVIDENCE / Known local
divergences in `SKILL.md`. The live probe is:

```bash
curl -fsS https://inish.in/ -o /tmp/verify-inish-live-feed.html
grep -c '<title>Nish&#x27;s Daily Reads' /tmp/verify-inish-live-feed.html
grep -c 'class="story ' /tmp/verify-inish-live-feed.html
grep -c 'Editor’' /tmp/verify-inish-live-feed.html
```

The expected counts are: 1 for the title, at least 1 for the story
cards (`class="story story-..."`), at least 1 for the editor's note
when the feed is non-empty. The story cards carry `data-section` (the
section the story belongs to) and an `<h2>` with the story title;
`class="story story-lead" / story-feature / story-brief` is the
shape that distinguishes the day's lead, the two feature stories,
and the briefs. The editor's note is the live page (the `’` is a
curly apostrophe the builder emits directly; the harness greps for
that prefix, not the escaped form).

### Local (asset-bound proof without the runtime body)

The local binding serves literal paths, so a local `/` probe would 404
even when the worker is correct. To prove the feed *content* locally
without depending on the asset binding's `/` handling, the harness
reads the generated head straight from the deployed source:

```bash
git -C /home/nish/workspaces/products/inish-site show origin/main:index.html \
    > /tmp/verify-inish-local-feed.html
grep -c '<title>Nish&#x27;s Daily Reads' /tmp/verify-inish-local-feed.html
grep -c 'class="story ' /tmp/verify-inish-local-feed.html
```

This is the same byte stream the deploy script copies into the
payload under `DEPLOY_ROOT/public/index.html` (see
`scripts/deploy_daily.sh`). The live verifier (`scripts/verify_live.py`)
byte-compares this file against the live response.

## What proves success

- HTTP 200 on `https://inish.in/`.
- The `<title>` matches the daily edition's date.
- Every story is an `<article class="story story-...">` with
  `data-section` and an `<h2>` link to the story URL.
- The editor's note paragraph is present and begins with the
  `I opened <N> candidates.` lead (the count is the actual
  `candidate_count` from `latest.json`).
- Every story carries the four required pieces (the builder refuses to
  render an edition without them): `title`, `url`, `summary`, and
  either `evidence_url` or the absence-of-evidence fallback the builder
  accepts. `tests/test_build_daily.py` pins the contract.

## Local honesty note

With the `html_handling: "none"` flag the live binding uses, the local
binding does not auto-resolve `/` to `index.html`. `scripts/launch_local.sh`
documents the divergence; the harness never uses a local `/` 200 as
proof the feed is wired correctly. The two paths above (live curl,
deployed source from git) are the only things that prove the feed.
