# RSS feed — `/feed.xml`

The single-item RSS 2.0 feed for the current edition. Built by
`scripts/build_daily.py` from the same stories the index page renders
and written to the deployed `public/feed.xml` at publish time. The
old `/daily/feed.xml` URL 301s to this path.

## How users reach it

Open `https://inish.in/feed.xml` in a feed reader, or follow the
`<link rel="alternate" type="application/rss+xml">` from any page
head.

## How to drive it

```bash
# Local
BASE=http://127.0.0.1:4891
curl -fsS "$BASE/feed.xml" -o /tmp/verify-inish-feed.xml
grep -c '<rss version="2.0">' /tmp/verify-inish-feed.xml   # exactly 1
grep -c '<channel>' /tmp/verify-inish-feed.xml             # exactly 1
grep -c '<item>' /tmp/verify-inish-feed.xml                # exactly 1 (single item per day)
grep -c '<guid' /tmp/verify-inish-feed.xml                 # exactly 1

# Live
curl -fsS https://inish.in/feed.xml -o /tmp/verify-inish-live-feed.xml
grep -c '<rss version="2.0">' /tmp/verify-inish-live-feed.xml
```

The expected counts are: exactly 1 `<rss version="2.0">`, exactly 1
`<channel>`, exactly 1 `<item>`, exactly 1 `<guid>`. The
single-item shape is a contract: the feed carries the day's edition
only, not a rolling list.

## What proves success

- HTTP 200 with `Content-Type: application/rss+xml` (or
  `text/xml` — both are accepted by feed readers; the live edge sends
  whatever the asset binding serves).
- The single `<item>`'s `<title>` matches the daily edition's date.
- The single `<item>`'s `<pubDate>` is a valid RFC 822 timestamp
  pointing at the edition's `date` (UTC midnight).
- The single `<item>`'s `<description>` begins with the editor's note
  paragraph and contains every story's `<h3>` title wrapped in an
  `<a href>` to the source URL.
- The single `<item>`'s `<guid isPermaLink="false">` is
  `inish-daily-<YYYY-MM-DD>`.

## Local honesty note

The local 200 on `/feed.xml` is a real worker-driven 200. The live
verifier (`scripts/verify_live.py`) byte-compares the live `feed.xml`
against the accepted `feed.xml` and reports a precise diff on any
mismatch — never a generic byte difference.
