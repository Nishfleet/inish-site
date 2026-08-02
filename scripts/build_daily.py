#!/usr/bin/env python3
"""Validate editions and render the static Nish Daily site, archive, JSON, and RSS."""

from __future__ import annotations

import datetime as dt
import html
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EDITIONS = ROOT / "data" / "editions"
DAILY = ROOT / "daily"
SECTIONS = {"AI & agents", "Build & ship", "Design & product", "Business & growth"}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def validate_url(value: object) -> str:
    url = str(value)
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"Only public HTTPS story URLs are allowed: {url}")
    return url


def load_editions() -> list[dict]:
    editions = []
    for path in sorted(EDITIONS.glob("*.json"), reverse=True):
        edition = json.loads(path.read_text())
        day = dt.date.fromisoformat(edition["date"])
        if path.stem != day.isoformat():
            raise ValueError(f"Edition filename/date mismatch: {path}")
        stories = edition.get("stories", [])
        if not 5 <= len(stories) <= 15:
            raise ValueError(f"{path}: expected 5-15 stories")
        seen = set()
        for story in stories:
            missing = {"title", "url", "source", "section", "summary", "why_it_matters"} - story.keys()
            if missing:
                raise ValueError(f"{path}: missing story fields {sorted(missing)}")
            url = validate_url(story["url"])
            if url in seen:
                raise ValueError(f"{path}: duplicate URL {url}")
            if story["section"] not in SECTIONS:
                raise ValueError(f"{path}: unsupported section {story['section']}")
            if not 25 <= len(story["summary"]) <= 700:
                raise ValueError(f"{path}: summary length is not useful")
            seen.add(url)
        editions.append(edition)
    if not editions:
        raise ValueError("No editions found")
    return editions


def story_card(story: dict, index: int) -> str:
    domain = urlparse(story["url"]).netloc.removeprefix("www.")
    return f"""
      <article class="story" data-section="{esc(story['section'])}">
        <div class="story-number">{index:02d}</div>
        <div class="story-body">
          <div class="story-meta"><span>{esc(story['section'])}</span><span>{esc(story['source'])}</span></div>
          <h2><a href="{esc(story['url'])}" rel="noopener noreferrer">{esc(story['title'])}</a></h2>
          <p>{esc(story['summary'])}</p>
          <p class="why"><strong>Why read:</strong> {esc(story['why_it_matters'])}</p>
          <a class="source-link" href="{esc(story['url'])}" rel="noopener noreferrer">Read at {esc(domain)} ↗</a>
        </div>
      </article>"""


def page(edition: dict, archive: list[dict], relative_root: str = "") -> str:
    date = dt.date.fromisoformat(edition["date"])
    title_date = date.strftime("%A, %d %B %Y")
    cards = "\n".join(story_card(story, index) for index, story in enumerate(edition["stories"], 1))
    archive_links = "\n".join(
        f'<a href="{relative_root}archive/{esc(item["date"])}/">{esc(item["date"])}</a>' for item in archive[:14]
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nish Daily — {esc(edition['date'])}</title>
  <meta name="description" content="Nish's daily signal feed for AI, building, design, product, and business.">
  <link rel="alternate" type="application/rss+xml" title="Nish Daily" href="https://inish.in/daily/feed.xml">
  <link rel="stylesheet" href="{relative_root}styles.css">
</head>
<body>
  <a class="skip" href="#stories">Skip to stories</a>
  <header class="masthead">
    <div class="masthead-top"><a href="/">inish.in</a><span>{esc(title_date)}</span><span>{len(edition['stories'])} stories</span></div>
    <div class="title-row"><div><p class="kicker">A personal signal newspaper</p><h1>Nish Daily</h1></div><p class="dek">The useful bits from AI, code, design, product, and business—selected for what Nish is building now.</p></div>
    <nav class="filters" aria-label="Filter stories">
      <button class="active" data-filter="all">All</button>
      {''.join(f'<button data-filter="{esc(section)}">{esc(section)}</button>' for section in sorted(SECTIONS))}
    </nav>
  </header>
  <main id="stories" class="stories">
    <section class="edition-note"><span>Editor’s note</span><p>{esc(edition['editor_note'])}</p></section>
{cards}
  </main>
  <footer>
    <div><strong>Recent editions</strong><div class="archive-links">{archive_links}<a href="{relative_root}archive/">Full archive →</a></div></div>
    <div class="footer-links"><a href="{relative_root}feed.xml">RSS</a><a href="{relative_root}latest.json">JSON</a><a href="/">About Nish</a></div>
    <p>Curated by Hermes on Nish's VPS. Sources remain the source of truth.</p>
  </footer>
  <script src="{relative_root}app.js" defer></script>
</body>
</html>
"""


def rss(editions: list[dict]) -> str:
    items = []
    for edition in editions[:30]:
        day = dt.date.fromisoformat(edition["date"])
        link = f"https://inish.in/daily/archive/{day.isoformat()}/"
        description = html.escape(edition["editor_note"])
        published = dt.datetime.combine(day, dt.time(0), tzinfo=dt.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
        items.append(f"<item><title>Nish Daily — {day.isoformat()}</title><link>{link}</link><guid>{link}</guid><pubDate>{published}</pubDate><description>{description}</description></item>")
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\"><channel><title>Nish Daily</title><link>https://inish.in/daily/</link><description>Nish's daily signal feed.</description>" + "".join(items) + "</channel></rss>\n"


def archive_page(editions: list[dict]) -> str:
    links = "\n".join(
        f'<li><a href="{esc(item["date"])}/"><span>{esc(item["date"])}</span><strong>{len(item["stories"])} stories</strong></a></li>'
        for item in editions
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nish Daily — Archive</title>
  <meta name="description" content="Every edition of Nish Daily.">
  <link rel="stylesheet" href="../styles.css">
</head>
<body class="archive-page">
  <header class="masthead">
    <div class="masthead-top"><a href="/">inish.in</a><span>Every edition</span><span>{len(editions)} total</span></div>
    <div class="title-row"><div><p class="kicker">Nish Daily</p><h1>Archive</h1></div><p class="dek">Developer and AI signal, one morning at a time.</p></div>
  </header>
  <main><ol class="edition-list">{links}</ol></main>
  <footer><div class="footer-links"><a href="../">Latest edition</a><a href="../feed.xml">RSS</a><a href="../latest.json">JSON</a></div></footer>
</body>
</html>
"""


def sitemap(editions: list[dict]) -> str:
    urls = ["https://inish.in/daily/", "https://inish.in/daily/archive/"]
    urls.extend(f'https://inish.in/daily/archive/{edition["date"]}/' for edition in editions)
    body = "".join(f"<url><loc>{esc(url)}</loc></url>" for url in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n'


def main() -> None:
    editions = load_editions()
    latest = editions[0]
    DAILY.mkdir(exist_ok=True)
    (DAILY / "index.html").write_text(page(latest, editions), encoding="utf-8")
    (DAILY / "latest.json").write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DAILY / "feed.xml").write_text(rss(editions), encoding="utf-8")
    archive_root = DAILY / "archive"
    archive_root.mkdir(parents=True, exist_ok=True)
    (archive_root / "index.html").write_text(archive_page(editions), encoding="utf-8")
    (DAILY / "sitemap.xml").write_text(sitemap(editions), encoding="utf-8")
    for edition in editions:
        target = DAILY / "archive" / edition["date"]
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(page(edition, editions, "../../"), encoding="utf-8")
    print(f"built {len(editions)} edition(s); latest={latest['date']} stories={len(latest['stories'])}")


if __name__ == "__main__":
    main()
