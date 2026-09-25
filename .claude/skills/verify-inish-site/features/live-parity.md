# Live parity — `inish_daily/verify_live.py`

The byte-level proof the worker gate + asset binding + feeds match the accepted edition.

## How to drive it

### Ad-hoc live probe

```bash
ACCEPTED_SHA="$(git -C /home/nish/workspaces/products/inish-site rev-parse origin/main)"
SNAPSHOT_ROOT="$(mktemp -d)"
git -C /home/nish/workspaces/products/inish-site archive --format=tar origin/main \
    | tar -x -C "$SNAPSHOT_ROOT"
EDITION_DATE="$(jq -er '.date' "$SNAPSHOT_ROOT/latest.json")"
python3 -m inish_daily.verify_live \
    --root "$SNAPSHOT_ROOT" --edition-date "$EDITION_DATE" --commit "$ACCEPTED_SHA"
rm -rf "$SNAPSHOT_ROOT"
```

The verify refuses anything that is not a public HTTPS origin
(`--base` defaults to `https://inish.in/`). Any non-zero exit
indicates one or more of the public paths has drifted from the
accepted edition; the failure line names the specific path and the
observed-vs-expected diff.

## What proves success

- Every public path in `public-paths.json`'s `publicPaths` byte-matches
  the snapshot.
- Every font file in `fonts/*.woff2` byte-matches the snapshot
  (a missing font fails silently in the browser, so this is the
  only way to catch the regression).
- `latest.json` and `feed.xml` exactly match the accepted edition
  (date, story count, and content); a feed-only difference between
  expected and observed URLs is named in the failure line.
- The Cloudflare beacon script the live edge injects is stripped
  before comparison; the verifier never reports a phantom diff for
  the beacon's randomized integrity hash.

## Local honesty note

`verify_live.py` is live-only. The local launch's `/about.html`,
`/feed.xml`, and `/latest.json` 200s are real worker-driven 200s,
but the byte-level feed parity is only provable against the live
edge — the local binding's snapshot is staged from the same
`origin/main` the verify script archives, so a `diff` between them
would catch a contract drift the local launch would not.
