# latest.json

`/daily/latest.json` is the current edition as JSON: its date, stories, section cards, wire and source counts. AGENTS.md uses its `.date` to prove today's edition is live.

## Sub-features

- `json-serve` serves the file with a JSON content type.
- `json-date` carries the edition date in `.date`.
- `json-stories` lists the stories, each with a fact, a take and a caveat.

## How to get to it (user POV)

- Open `https://nish.sh/daily/latest.json`.

## Driving it with curl and headless Chrome

Preconditions:

- Doctor passed on `$PORT`.

- **Serve.** Run `curl -s -o "$OUT/latest.json" -w '%{http_code} %{content_type}\n' "http://localhost:$PORT/daily/latest.json" | tee "$OUT/latest-status.txt"`. It prints `200 application/json`.
- **Date.** Run `jq -r .date "$OUT/latest.json"`. It equals the newest file name in `data/editions/`.
- **Stories.** Run `jq '[.stories[] | select(.fact and .take and .caveat)] | length' "$OUT/latest.json"` and `jq '.stories | length' "$OUT/latest.json"`. Both numbers match.

## Gotchas

- Content type can carry a charset suffix. Match the `application/json` prefix.
- An edition with 0 stories is valid (MEMORY.md: quality, not count). Then both counts are `0`.
