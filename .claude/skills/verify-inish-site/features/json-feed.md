# JSON feed — `/latest.json`

The canonical machine-readable feed for the current edition. Built by
`scripts/build_daily.py` and written to `public/latest.json` at publish
time. The old `/daily/latest.json` URL 301s to this path.

## How users reach it

`GET https://inish.in/latest.json` — read by the live verifier, the
deploy_daily.sh parity check, and any external feed consumer that
prefers JSON over RSS.

## How to drive it

```bash
# Local
BASE=http://127.0.0.1:4891
curl -fsS "$BASE/latest.json" -o /tmp/verify-inish-latest.json
python3 -c "import json; d=json.load(open('/tmp/verify-inish-latest.json')); print('date:', d['date']); print('stories:', len(d['stories']))"

# Live
curl -fsS https://inish.in/latest.json -o /tmp/verify-inish-live-latest.json
python3 -c "import json; d=json.load(open('/tmp/verify-inish-live-latest.json')); print('date:', d['date']); print('stories:', len(d['stories']))"
```

The expected fields are: top-level `date` (YYYY-MM-DD), top-level
`candidate_count` (int), top-level `editor_note` (str), and `stories`
(array, length 0..8). Each story carries `title`, `url`, `source`,
`section`, `summary`, `fact`, `take`, `caveat`, and (since PR #58) a
required `evidence_url` (HTTPS). The builder refuses an edition
without any of those.

## What proves success

- HTTP 200 with `Content-Type: application/json` (or `text/plain` —
  the asset binding serves the file with the live edge's mime
  detection).
- The body parses with `json.load`.
- `date` matches the index page's `<title>` and the RSS `<item>`'s
  `<pubDate>`.
- `len(stories)` matches the number of `<article>` (or story-card)
  elements on the live `/` page.
- Every story has all eight required keys; the builder test in
  `tests/test_build_daily.py` pins this.

## Local honesty note

The local 200 on `/latest.json` is a real worker-driven 200. The live
verifier byte-compares the live `latest.json` against the accepted
edition's `latest.json` and reports a precise diff on any
mismatch — never a generic byte difference.
