# Daily page

The daily page is Nish's Daily: the masthead with the edition date, a sources bar, a lead story, picks, one card per source group and a Wire column. It has no JavaScript, and its CSS is inlined and allowed by a CSP hash.

## Sub-features

- `page-serve` serves the page at `/daily`, `/daily/` and `/daily/index.html`.
- `page-title` puts the edition date in the title.
- `page-headers` sends HSTS, the CSP with the style hash, and `no-transform`.
- `page-layout` reads well at phone and desktop widths.

## How to get to it (user POV)

- Open `https://nish.sh/daily` (Nish's browser new-tab page).
- Open `https://nish.sh/daily/`.

## Driving it with curl and headless Chrome

Preconditions:

- Doctor passed on `$PORT`.

- **Page.** Run `for p in /daily /daily/ /daily/index.html; do curl -s -o /dev/null -w "$p %{http_code}\n" "http://localhost:$PORT$p"; done | tee "$OUT/daily-paths.txt"`. Each line ends in `200`.
- **Title.** Run `curl -s "http://localhost:$PORT/daily" | grep -o '<title>[^<]*</title>' | tee "$OUT/daily-title.txt"`. It prints `<title>Nish’s Daily · <date></title>`, and `<date>` equals `ls data/editions | tail -1` without `.json`.
- **Headers.** Run `curl -sI "http://localhost:$PORT/daily" | tee "$OUT/daily-headers.txt"`. It has `Strict-Transport-Security: max-age=31536000`, `Cache-Control` with `no-transform`, and a `Content-Security-Policy` whose `style-src` has a `sha256-` hash and no `unsafe-inline`.
- **Layout.** Take the 390 px and 1280 px screenshots from the skill's Evidence section and open both. The masthead and date are visible, and only the section nav runs off the right edge at 390 px.

## Gotchas

- At 390 px the section nav (`TOP STORIES`, `TALKED ABOUT`, ...) is cut off at the right edge with a fade. That is by design: it scrolls sideways (`overflow-x:auto` under `max-width:599px` in `styles.css`). Text cut off anywhere else is a bug.
- The page shows the newest committed edition, so its date can be days old. Compare with `data/editions/`, not with today.
- `npm run dev` rebuilds `dist/` only at start. After you edit `public/`, restart the server.
- A 301 from `/daily` locally means the dev server lost `upstreamProtocol: "https"` in `wrangler.config.ts`; the worker then redirects to its canonical https origin.
