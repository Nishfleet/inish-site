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
REQUIRED_EDITION_FIELDS = {"date", "editor_note", "stories"}
OPTIONAL_EDITION_FIELDS = {"candidate_count"}
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
    edition_paths = sorted(EDITIONS.glob("*.json"), reverse=True)
    for index, path in enumerate(edition_paths):
        edition = json.loads(path.read_text())
        fields = set(edition)
        allowed_fields = REQUIRED_EDITION_FIELDS | OPTIONAL_EDITION_FIELDS
        if not REQUIRED_EDITION_FIELDS <= fields or fields - allowed_fields:
            raise ValueError(
                f"{path}: edition fields must include {sorted(REQUIRED_EDITION_FIELDS)} "
                f"and may include {sorted(OPTIONAL_EDITION_FIELDS)}"
            )
        if index == 0 and "candidate_count" not in fields:
            raise ValueError(f"{path}: latest edition requires candidate_count")
        day = dt.date.fromisoformat(edition["date"])
        if path.stem != day.isoformat():
            raise ValueError(f"Edition filename/date mismatch: {path}")
        stories = edition.get("stories", [])
        if not isinstance(stories, list):
            raise ValueError(f"{path}: stories must be a list")
        if not 5 <= len(stories) <= 15:
            raise ValueError(f"{path}: expected 5-15 stories")
        if "candidate_count" in edition:
            candidate_count = edition["candidate_count"]
            if isinstance(candidate_count, bool) or not isinstance(candidate_count, int) or candidate_count <= 0:
                raise ValueError(f"{path}: candidate_count must be a positive non-bool integer")
            if candidate_count < len(stories):
                raise ValueError(f"{path}: candidate_count must be at least the kept story count")
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
        clean_edition = {"date": day.isoformat()}
        if "candidate_count" in edition:
            clean_edition["candidate_count"] = edition["candidate_count"]
        clean_edition.update({
            "editor_note": validate_text(edition["editor_note"], "editor_note", 20, 1000),
            "stories": clean_stories,
        })
        editions.append(clean_edition)
    if not editions:
        raise ValueError("No editions found")
    if not 7 <= len(editions[0]["stories"]) <= 9:
        raise ValueError(f"Latest edition must contain 7-9 stories; found {len(editions[0]['stories'])}")
    return editions


def story_card(story: dict, index: int, prominence: str) -> str:
    domain = urlparse(story["url"]).netloc.removeprefix("www.")
    return f"""
      <article class="story story-{esc(prominence)}" data-section="{esc(story['section'])}">
        <div class="story-number">{index:02d}</div>
        <div class="story-body">
          <div class="story-meta"><span>{esc(story['section'])}</span><span>{esc(story['source'])}</span></div>
          <h2><a href="{esc(story['url'])}" rel="noopener noreferrer">{esc(story['title'])}</a></h2>
          <p>{esc(story['summary'])}</p>
          <p class="why"><strong>Nish's angle:</strong> {esc(story['why_it_matters'])}</p>
          <a class="source-link" href="{esc(story['url'])}" rel="noopener noreferrer">Read at {esc(domain)} ↗</a>
        </div>
      </article>"""


def prominence_for(index: int) -> str:
    if index == 1:
        return "lead"
    if index in (2, 3):
        return "feature"
    return "brief"


def page(edition: dict) -> str:
    date = dt.date.fromisoformat(edition["date"])
    title_date = date.strftime("%A, %d %B %Y")
    kept_count = len(edition["stories"])
    candidate_count = edition.get("candidate_count")
    count_label = f"{candidate_count} scanned · {kept_count} kept" if candidate_count is not None else f"{kept_count} kept"
    cards = "\n".join(
        story_card(story, index, prominence_for(index))
        for index, story in enumerate(edition["stories"], 1)
    )
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
    <div class="masthead-top"><a href="/">inish.in</a><span>{esc(title_date)}</span><span>{esc(count_label)}</span></div>
    <div class="title-row"><div><p class="kicker">A personal signal newspaper</p><h1>Nish Daily</h1></div><p class="dek">A daily cut of AI, code, design, product, and business, chosen for ideas worth testing.</p></div>
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
