#!/usr/bin/env python3
"""Validate editions and render the latest Nish Daily feed at the site root."""

from __future__ import annotations

import datetime as dt
import html
import ipaddress
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EDITIONS = ROOT / "data" / "editions"
DAILY = ROOT
LEGACY_DAILY = ROOT / "daily"
ASSETS = ("app.js", "styles.css")
SECTIONS = {"AI & agents", "Build & ship", "Design & product", "Business & growth"}
EDITION_FIELDS = {"date", "editor_note", "stories"}
STORY_FIELDS = {"title", "url", "source", "section", "summary", "why_it_matters"}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def validate_url(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Story URL must be a string")
    url = str(value)
    parsed = urlparse(url)
    hostname = parsed.hostname
    if parsed.scheme != "https" or not parsed.netloc or not hostname or parsed.username or parsed.password:
        raise ValueError(f"Only public HTTPS story URLs are allowed: {url}")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        lowered = hostname.lower().rstrip(".")
        if "." not in lowered or lowered == "localhost" or lowered.endswith((".localhost", ".local", ".internal")):
            raise ValueError(f"Only public HTTPS story URLs are allowed: {url}") from None
    else:
        if not address.is_global:
            raise ValueError(f"Only public HTTPS story URLs are allowed: {url}")
    return url


def validate_text(value: object, field: str, minimum: int, maximum: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    text = value.strip()
    if not minimum <= len(text) <= maximum:
        raise ValueError(f"{field} must contain {minimum}-{maximum} characters")
    return text


def load_editions() -> list[dict]:
    editions = []
    for path in sorted(EDITIONS.glob("*.json"), reverse=True):
        edition = json.loads(path.read_text())
        if set(edition) != EDITION_FIELDS:
            raise ValueError(f"{path}: edition fields must be exactly {sorted(EDITION_FIELDS)}")
        day = dt.date.fromisoformat(edition["date"])
        if path.stem != day.isoformat():
            raise ValueError(f"Edition filename/date mismatch: {path}")
        stories = edition.get("stories", [])
        if not 5 <= len(stories) <= 15:
            raise ValueError(f"{path}: expected 5-15 stories")
        clean_stories = []
        seen = set()
        for story in stories:
            if not isinstance(story, dict) or set(story) != STORY_FIELDS:
                raise ValueError(f"{path}: story fields must be exactly {sorted(STORY_FIELDS)}")
            url = validate_url(story["url"])
            if url in seen:
                raise ValueError(f"{path}: duplicate URL {url}")
            section = validate_text(story["section"], "section", 2, 40)
            if section not in SECTIONS:
                raise ValueError(f"{path}: unsupported section {section}")
            seen.add(url)
            clean_stories.append({
                "title": validate_text(story["title"], "title", 5, 200),
                "url": url,
                "source": validate_text(story["source"], "source", 2, 100),
                "section": section,
                "summary": validate_text(story["summary"], "summary", 25, 700),
                "why_it_matters": validate_text(story["why_it_matters"], "why_it_matters", 20, 500),
            })
        editions.append({
            "date": day.isoformat(),
            "editor_note": validate_text(edition["editor_note"], "editor_note", 20, 1000),
            "stories": clean_stories,
        })
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


def page(edition: dict) -> str:
    date = dt.date.fromisoformat(edition["date"])
    title_date = date.strftime("%A, %d %B %Y")
    cards = "\n".join(story_card(story, index) for index, story in enumerate(edition["stories"], 1))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nish Daily — {esc(edition['date'])}</title>
  <meta name="description" content="Nish's daily signal feed for AI, building, design, product, and business.">
  <link rel="alternate" type="application/rss+xml" title="Nish Daily" href="https://inish.in/feed.xml">
  <link rel="stylesheet" href="/styles.css">
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
    <div class="footer-links"><a href="/feed.xml">RSS</a><a href="/latest.json">JSON</a></div>
    <p>Curated by Hermes on Nish's VPS. Sources remain the source of truth.</p>
  </footer>
  <script src="/app.js" defer></script>
</body>
</html>
"""


def rss(editions: list[dict]) -> str:
    edition = editions[0]
    day = dt.date.fromisoformat(edition["date"])
    link = "https://inish.in/"
    description = html.escape(edition["editor_note"])
    published = dt.datetime.combine(day, dt.time(0), tzinfo=dt.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
    guid = f"inish-daily-{day.isoformat()}"
    item = f"<item><title>Nish Daily — {day.isoformat()}</title><link>{link}</link><guid isPermaLink=\"false\">{guid}</guid><pubDate>{published}</pubDate><description>{description}</description></item>"
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\"><channel><title>Nish Daily</title><link>https://inish.in/</link><description>Nish's daily signal feed.</description>" + item + "</channel></rss>\n"


def sitemap() -> str:
    body = '<url><loc>https://inish.in/</loc></url>'
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n'


def copy_assets() -> None:
    for name in ASSETS:
        source = LEGACY_DAILY / name
        destination = DAILY / name
        if source.is_file() and source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
        elif not destination.is_file():
            raise FileNotFoundError(f"Missing Nish Daily asset: {source}")


def main() -> None:
    editions = load_editions()
    latest = editions[0]
    DAILY.mkdir(parents=True, exist_ok=True)
    copy_assets()
    archive_roots = [DAILY / "archive"]
    if DAILY == ROOT:
        archive_roots.append(LEGACY_DAILY / "archive")
    for archive_root in set(archive_roots):
        if archive_root.is_symlink() or archive_root.is_file():
            archive_root.unlink()
        elif archive_root.is_dir():
            shutil.rmtree(archive_root)
    (DAILY / "index.html").write_text(page(latest), encoding="utf-8")
    (DAILY / "latest.json").write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DAILY / "feed.xml").write_text(rss(editions), encoding="utf-8")
    (DAILY / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    print(f"built {len(editions)} edition(s); latest={latest['date']} stories={len(latest['stories'])}")


if __name__ == "__main__":
    main()
