# Feed

`/daily/feed.xml` is an RSS 2.0 feed with one item per edition day, so a feed reader picks up each new edition.

## Sub-features

- `feed-serve` serves valid XML.
- `feed-item` has one item titled with the edition date.

## How to get to it (user POV)

- Subscribe to `https://nish.sh/daily/feed.xml` in a feed reader.

## Driving it with curl and headless Chrome

Preconditions:

- Doctor passed on `$PORT`.

- **Serve.** Run `curl -s -o "$OUT/feed.xml" -w '%{http_code} %{content_type}\n' "http://localhost:$PORT/daily/feed.xml" | tee "$OUT/feed-status.txt"`. It prints `200` and an XML content type.
- **Parse.** Run `python3 -c 'import sys,xml.etree.ElementTree as E; r=E.parse(sys.argv[1]).getroot(); print(r.tag, r.get("version"), r.find("channel/item/title").text)' "$OUT/feed.xml" | tee "$OUT/feed-parse.txt"`. It prints `rss 2.0 Nish’s Daily · <date>`, with the same date as `latest.json`.

## Gotchas

- The feed holds only the current edition. A missing older day is expected.
