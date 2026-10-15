#!/usr/bin/env python3

from __future__ import annotations

import datetime as dt
import html
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from inish_daily import fetch_candidates

ROOT = Path(__file__).resolve().parents[1]
EDITIONS = ROOT / "data" / "editions"
DAILY = ROOT / "public" / "daily"
CANDIDATES = ROOT / "data" / "candidates"
POOLS = ROOT / "data" / "pools"
SITE_URL = "https://nish.sh/daily"
SITE_NAME = "Nish’s Daily"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
ASSETS = ("styles.css", "favicon.svg")
SECTIONS = {"AI", "Product ideas", "Demand signals", "Tools", "Wildcard"}
REQUIRED_EDITION_FIELDS = {"date", "candidate_count", "editor_note", "stories"}
OPTIONAL_EDITION_FIELDS = {"sections", "wire"}
STORY_FIELDS = {"title", "url", "evidence_url", "source", "section", "summary", "fact", "take", "caveat"}

MAX_STORIES = 8
MAX_PER_SECTION = 4
MAX_PER_DOMAIN = 3
REPEAT_WINDOW_DAYS = 30
SHARED_PHRASE_LENGTH = 6

FIRST_PERSON = re.compile(r"\b(I|I'm|I'd|I've|I'll|my|me|mine)\b")
QUOTED = re.compile(r"[\"“”]")
WORD = re.compile(r"[a-z0-9][a-z0-9'+.-]*")

APHORISM_OPENERS = (
    "the point is",
    "the real question",
    "the interesting part",
    "trust grows",
    "speed is",
    "this matters because",
    "what matters is",
    "the bottleneck",
    "it turns out",
)

ANCHOR_STOPWORDS = {
    "about", "after", "again", "against", "agent", "agents", "already", "also", "another",
    "anything", "around", "because", "been", "before", "being", "better", "between", "both",
    "build", "building", "built", "cannot", "code", "could", "data", "does", "doing",
    "done", "down", "during", "each", "else", "enough", "even", "ever", "every", "everything",
    "from", "gets", "give", "goes", "going", "good", "have", "here", "how", "into", "just",
    "keep", "kind", "know", "less", "like", "little", "long", "look", "made", "make", "makes",
    "many", "might", "model", "models", "more", "most", "much", "must", "need", "needs", "never",
    "next", "nothing", "often", "once", "only", "other", "over", "own", "part", "people",
    "point", "pretty", "probably", "product", "project", "really", "right", "same", "seems",
    "sees", "should", "since", "some", "someone", "something", "still", "such", "take", "takes",
    "than", "that", "their", "them", "then", "there", "these", "they", "thing", "things", "think",
    "this", "those", "through", "time", "tool", "tools", "under", "until", "used", "uses",
    "using", "very", "want", "well", "were", "what", "when", "where", "which", "while", "who",
    "why", "will", "with", "without", "work", "working", "works", "would", "your",
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def words(text: str) -> list[str]:
    cleaned = []
    for match in WORD.findall(text.lower()):
        word = match.strip(".-'")
        if word.endswith("'s"):
            word = word[:-2]
        if word:
            cleaned.append(word)
    return cleaned


def singular(word: str) -> str:
    if len(word) >= 5 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def anchors(text: str) -> set[str]:
    return {
        singular(word)
        for word in words(text)
        if len(word) >= 4 and word not in ANCHOR_STOPWORDS
    }


def phrases(text: str, length: int = SHARED_PHRASE_LENGTH) -> set[str]:
    tokens = words(text)
    return {" ".join(tokens[index:index + length]) for index in range(len(tokens) - length + 1)}


def canonical_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    path = parsed.path.rstrip("/").lower()
    return f"{host}{path}"


def validate_url(value: object, label: str = "Story") -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} URL must be a string")
    url = str(value)
    parsed = urlparse(url)
    hostname = parsed.hostname
    if parsed.scheme != "https" or not parsed.netloc or not hostname or parsed.username or parsed.password:
        raise ValueError(f"Only public HTTPS {label} URLs are allowed: {url}")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        lowered = hostname.lower().rstrip(".")
        if "." not in lowered or lowered == "localhost" or lowered.endswith((".localhost", ".local", ".internal")):
            raise ValueError(f"Only public HTTPS {label} URLs are allowed: {url}") from None
    else:
        if not address.is_global:
            raise ValueError(f"Only public HTTPS {label} URLs are allowed: {url}")
    return url


NOT_JUST = re.compile(r"\bnot (?:just|merely)\b", re.IGNORECASE)


def validate_text(value: object, field: str, minimum: int, maximum: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    text = value.strip()
    if not minimum <= len(text) <= maximum:
        raise ValueError(f"{field} must contain {minimum}-{maximum} characters; found {len(text)}")
    if "\u2014" in text:
        raise ValueError(f"{field} uses an em dash; use a comma or a full stop: {text!r}")
    if NOT_JUST.search(text):
        raise ValueError(f"{field} uses 'not just X, but Y'; state the point directly: {text!r}")
    return text


def validate_fact(value: object) -> str:
    text = validate_text(value, "fact", 15, 240)
    if not any(character.isdigit() for character in text) and not QUOTED.search(text):
        raise ValueError(
            f"fact must carry a checkable detail — a number, version, date, price, or a quote "
            f"lifted from the source: {text!r}"
        )
    return text


def validate_take(value: object, anchor_pool: set[str]) -> str:
    text = validate_text(value, "take", 25, 260)
    if not FIRST_PERSON.search(text):
        raise ValueError(f"take must be written in the first person: {text!r}")
    lowered = text.lower()
    for opener in APHORISM_OPENERS:
        if lowered.startswith(opener):
            raise ValueError(f"take opens with the aphorism pattern {opener!r}: {text!r}")
    if not anchors(text) & anchor_pool:
        raise ValueError(
            f"take shares no specific term with its own headline or fact, so it reads as generic: {text!r}"
        )
    return text


def check_edition_repetition(stories: list[dict]) -> None:
    seen_phrases: dict[str, int] = {}
    seen_openers: dict[str, int] = {}
    seen_facts: dict[str, int] = {}
    for index, story in enumerate(stories, 1):
        body = " ".join((story["summary"], story["take"], story["caveat"]))
        for phrase in phrases(body):
            if phrase in seen_phrases:
                raise ValueError(
                    f"stories {seen_phrases[phrase]} and {index} share the phrase {phrase!r}"
                )
            seen_phrases[phrase] = index

        opener = " ".join(words(story["take"])[:2])
        if opener and opener in seen_openers:
            raise ValueError(
                f"stories {seen_openers[opener]} and {index} both open their take with {opener!r}"
            )
        seen_openers[opener] = index

        fact_key = " ".join(words(story["fact"]))
        if fact_key in seen_facts:
            raise ValueError(f"stories {seen_facts[fact_key]} and {index} repeat the same fact")
        seen_facts[fact_key] = index


def check_edition_balance(stories: list[dict]) -> None:
    sections: dict[str, int] = {}
    domains: dict[str, int] = {}
    for story in stories:
        section = story["section"]
        sections[section] = sections.get(section, 0) + 1
        if sections[section] > MAX_PER_SECTION:
            raise ValueError(f"more than {MAX_PER_SECTION} stories in section {section}")
        domain = (urlparse(story["url"]).hostname or "").lower().removeprefix("www.")
        domains[domain] = domains.get(domain, 0) + 1
        if domains[domain] > MAX_PER_DOMAIN:
            raise ValueError(
                f"more than {MAX_PER_DOMAIN} stories from {domain}; an edition of one source is a scrape, not a read"
            )


def load_history(latest_date: dt.date) -> dict[str, str]:
    published: dict[str, str] = {}
    cutoff = latest_date - dt.timedelta(days=REPEAT_WINDOW_DAYS)
    for path in sorted(EDITIONS.glob("*.json")):
        try:
            day = dt.date.fromisoformat(path.stem)
        except ValueError as error:
            raise ValueError(f"Edition filename must be a date: {path}") from error
        if day >= latest_date or day < cutoff:
            continue
        edition = json.loads(path.read_text())
        for story in edition.get("stories", []):
            url = story.get("url")
            if isinstance(url, str):
                published.setdefault(canonical_url(url), day.isoformat())
    return published


def validate_story(story: object, path: Path, published: dict[str, str], seen: set[str]) -> dict:
    if not isinstance(story, dict) or set(story) != STORY_FIELDS:
        raise ValueError(f"{path}: story fields must be exactly {sorted(STORY_FIELDS)}")
    url = validate_url(story["url"])
    evidence_url = validate_url(story["evidence_url"], label="evidence")
    key = canonical_url(url)
    if key in seen:
        raise ValueError(f"{path}: duplicate URL {url}")
    if key in published:
        raise ValueError(f"{path}: {url} already ran on {published[key]}")
    section = validate_text(story["section"], "section", 2, 40)
    if section not in SECTIONS:
        raise ValueError(f"{path}: unsupported section {section}")
    seen.add(key)
    title = validate_text(story["title"], "title", 5, 200)
    fact = validate_fact(story["fact"])
    return {
        "title": title,
        "url": url,
        "evidence_url": evidence_url,
        "source": validate_text(story["source"], "source", 2, 100),
        "section": section,
        "summary": validate_text(story["summary"], "summary", 25, 700),
        "fact": fact,
        "take": validate_take(story["take"], anchors(f"{title} {fact}")),
        "caveat": validate_text(story["caveat"], "caveat", 20, 240),
    }


def load_latest() -> dict:
    edition_paths = sorted(EDITIONS.glob("*.json"), reverse=True)
    if not edition_paths:
        raise ValueError("No editions found")
    path = edition_paths[0]
    edition = json.loads(path.read_text())
    fields = set(edition)
    if not REQUIRED_EDITION_FIELDS <= fields or fields - REQUIRED_EDITION_FIELDS - OPTIONAL_EDITION_FIELDS:
        raise ValueError(
            f"{path}: edition fields must be {sorted(REQUIRED_EDITION_FIELDS)} "
            f"plus optionally {sorted(OPTIONAL_EDITION_FIELDS)}"
        )
    day = dt.date.fromisoformat(edition["date"])
    if path.stem != day.isoformat():
        raise ValueError(f"Edition filename/date mismatch: {path}")

    stories = edition["stories"]
    if not isinstance(stories, list):
        raise ValueError(f"{path}: stories must be a list")
    if len(stories) > MAX_STORIES:
        raise ValueError(f"{path}: at most {MAX_STORIES} stories; found {len(stories)}")

    candidate_count = edition["candidate_count"]
    if isinstance(candidate_count, bool) or not isinstance(candidate_count, int) or candidate_count <= 0:
        raise ValueError(f"{path}: candidate_count must be a positive non-bool integer")
    if candidate_count < len(stories):
        raise ValueError(f"{path}: candidate_count must be at least the kept story count")

    published = load_history(day)
    clean_stories = []
    seen: set[str] = set()
    for story in stories:
        clean_stories.append(validate_story(story, path, published, seen))

    check_edition_repetition(clean_stories)
    check_edition_balance(clean_stories)
    clean = {
        "date": day.isoformat(),
        "candidate_count": candidate_count,
        "editor_note": validate_text(edition["editor_note"], "editor_note", 20, 400),
        "stories": clean_stories,
    }
    if "sections" in edition:
        clean["sections"] = validate_sections(edition["sections"], path)
    if "wire" in edition:
        clean["wire"] = validate_feed_items(edition["wire"], f"{path}: wire")
    return clean


CARD_ITEMS = 5
WIRE_ITEMS = 14
WIRE_PER_SOURCE = 3
POOL_PER_GROUP = 20
BLURB_CHARS = 140
FEED_ITEM_FIELDS = {"title", "url", "source", "blurb", "signal", "discussion_url"}


def clean_line(value: object, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def feed_item(raw: object, label: str) -> dict:
    if not isinstance(raw, dict) or not {"title", "url", "source"} <= set(raw) or set(raw) - FEED_ITEM_FIELDS:
        raise ValueError(f"{label}: item fields must be title, url, source plus optionally blurb, signal, discussion_url")
    title = clean_line(raw["title"], 200)
    source = clean_line(raw["source"], 100)
    if len(title) < 2 or not source:
        raise ValueError(f"{label}: item needs a title and a source")
    discussion = raw.get("discussion_url") or ""
    return {
        "title": title,
        "url": validate_url(raw["url"], label="item"),
        "source": source,
        "blurb": clean_line(raw.get("blurb"), BLURB_CHARS * 2),
        "signal": clean_line(raw.get("signal"), 60),
        "discussion_url": validate_url(discussion, label="discussion") if discussion else "",
    }


def validate_feed_items(raw: object, label: str) -> list[dict]:
    if not isinstance(raw, list):
        raise ValueError(f"{label} must be a list")
    return [feed_item(item, label) for item in raw]


def validate_sections(raw: object, path: Path) -> list[dict]:
    if not isinstance(raw, list):
        raise ValueError(f"{path}: sections must be a list")
    sections = []
    for section in raw:
        if not isinstance(section, dict) or set(section) != {"id", "label", "items"}:
            raise ValueError(f"{path}: a section needs exactly id, label and items")
        ident = str(section["id"])
        if not re.fullmatch(r"[a-z0-9-]{1,30}", ident):
            raise ValueError(f"{path}: section id must be lowercase letters, digits and hyphens: {ident!r}")
        sections.append({
            "id": ident,
            "label": clean_line(section["label"], 30),
            "items": validate_feed_items(section["items"], f"{path}: section {ident}"),
        })
    return sections


def signal_text(candidate: dict) -> str:
    signals = candidate.get("signals") or {}
    parts = []
    for key, label in (("points", "pts"), ("score", "pts"), ("stars", "stars"), ("comments", "comments")):
        value = signals.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            parts.append(f"{value:,} {label}")
    return " · ".join(parts)


def compact_pool(payload: dict, config: dict) -> dict:
    reported = payload.get("sources")
    if isinstance(reported, list) and reported:
        total = len(reported)
        ok = sum(1 for source in reported if source.get("count", 0) > 0)
    else:
        total = len(config["sources"])
        ok = len({c.get("source_id") for c in payload.get("candidates", [])} - {None})
    groups = {group["id"] for group in config["groups"]}
    kept: dict[str, int] = {}
    items = []
    for candidate in payload.get("candidates", []):
        group = candidate.get("group")
        if group not in groups or kept.get(group, 0) >= POOL_PER_GROUP:
            continue
        discussion = candidate.get("discussion_url") or ""
        try:
            item = feed_item({
                "title": candidate.get("title", ""),
                "url": candidate.get("url", ""),
                "source": candidate.get("source", ""),
                "blurb": candidate.get("description", ""),
                "signal": signal_text(candidate),
                "discussion_url": discussion,
            }, "pool")
        except ValueError:
            continue
        item["blurb"] = clean_line(item["blurb"], BLURB_CHARS)
        item["group"] = group
        priority = (candidate.get("jev") or {}).get("priority")
        item["priority"] = round(priority, 3) if isinstance(priority, (int, float)) else None
        items.append(item)
        kept[group] = kept.get(group, 0) + 1
    return {
        "date": payload["date"],
        "generated_at": payload.get("generated_at", ""),
        "candidate_count": payload.get("candidate_count", len(items)),
        "ranked_by": payload.get("ranked_by"),
        "sources": {"ok": ok, "total": total},
        "items": items,
    }


def load_pool(day: dt.date, config: dict) -> tuple[dict | None, bool]:
    candidates = CANDIDATES / f"{day.isoformat()}.json"
    if candidates.is_file():
        return compact_pool(json.loads(candidates.read_text(encoding="utf-8")), config), True
    stored = POOLS / f"{day.isoformat()}.json"
    if stored.is_file():
        return json.loads(stored.read_text(encoding="utf-8")), False
    return None, False


def compose_front(edition: dict, pool: dict | None, config: dict) -> dict:
    front = dict(edition)
    front["sources"] = {"ok": 0, "total": len(config["sources"])}
    front["generated_at"] = ""
    labels = {group["id"]: group["label"] for group in config["groups"]}
    if pool is not None:
        front["sources"] = dict(pool["sources"])
        front["generated_at"] = pool.get("generated_at", "")
        ranked = pool.get("ranked_by") is not None
        taken = {canonical_url(story["url"]) for story in edition["stories"]}
        for key in ("sections", "wire"):
            for entry in edition.get(key, []):
                for item in (entry["items"] if key == "sections" else [entry]):
                    taken.add(canonical_url(item["url"]))
        shown = []
        for item in pool["items"]:
            if canonical_url(item["url"]) in taken:
                continue
            if ranked and not item.get("priority"):
                continue
            shown.append(item)
        used: set[int] = set()
        if "sections" not in edition:
            sections = []
            for group in config["groups"]:
                picks = [(i, item) for i, item in enumerate(shown) if item["group"] == group["id"]][:CARD_ITEMS]
                if picks:
                    used.update(i for i, _ in picks)
                    sections.append({"id": group["id"], "label": labels[group["id"]], "items": [item_view(item) for _, item in picks]})
            front["sections"] = sections
        if "wire" not in edition:
            per_source: dict[str, int] = {}
            wire = []
            for i, item in enumerate(shown):
                if i in used or per_source.get(item["source"], 0) >= WIRE_PER_SOURCE:
                    continue
                per_source[item["source"]] = per_source.get(item["source"], 0) + 1
                wire.append(item_view(item))
                if len(wire) == WIRE_ITEMS:
                    break
            front["wire"] = wire
    front.setdefault("sections", [])
    front.setdefault("wire", [])
    return front


def item_view(item: dict) -> dict:
    return {key: item.get(key, "") for key in ("title", "url", "source", "blurb", "signal", "discussion_url")}


SENTENCE_BREAK = re.compile(r"(?<=[.!?])[\"”’)]?\s+(?=[A-Z0-9“\"(])")
ABBREVIATIONS = {"inc", "ltd", "co", "corp", "dr", "mr", "mrs", "ms", "st", "vs", "no", "fig", "jr", "sr", "e.g", "i.e", "u.s", "u.k"}
PICK_SUMMARY_CHARS = 170
SHORT_SENTENCE_CHARS = 80


def sentences(text: str) -> list[str]:
    parts: list[str] = []
    start = 0
    for match in SENTENCE_BREAK.finditer(text):
        head = text[start:match.start()]
        last = head.rstrip(".!?\"”’)").rsplit(" ", 1)[-1].lower()
        if len(last) == 1 or last in ABBREVIATIONS or re.fullmatch(r"(?:[a-z]\.)+[a-z]?", last):
            continue
        parts.append(head)
        start = match.end()
    parts.append(text[start:])
    return [part for part in parts if part]


def pick_summary(text: str) -> str:
    parts = sentences(text)
    first = parts[0]
    if len(first) < SHORT_SENTENCE_CHARS and len(parts) > 1 and len(first) + 1 + len(parts[1]) <= PICK_SUMMARY_CHARS:
        return f"{first} {parts[1]}"
    return first


def story_card(story: dict, index: int, prominence: str) -> str:
    heading = "h2" if prominence == "lead" else "h3"
    notes = ""
    summary = story["summary"] if prominence == "lead" or index == 2 else pick_summary(story["summary"])
    if prominence == "lead":
        notes = f"""
          <div class="notes">
            <p class="note take"><b>Nish</b> {esc(story['take'])}</p>
            <p class="note fact"><b>Checked</b> <a href="{esc(story['evidence_url'])}" rel="noopener noreferrer">{esc(story['fact'])}</a></p>
          </div>"""
    return f"""
        <article class="story story-{esc(prominence)}">
          <p class="kicker">{esc(story['section'])} <span>{esc(story['source'])}</span></p>
          <{heading}><a href="{esc(story['url'])}" rel="noopener noreferrer">{esc(story['title'])}</a></{heading}>
          <p class="summary">{esc(summary)}</p>{notes}
        </article>"""


SHOWN_LIST_ITEMS = 4
SHOWN_WIRE_ITEMS = 8


def item_row(item: dict) -> str:
    discussion = ""
    if item.get("discussion_url"):
        discussion = f' &middot; <a class="talk" href="{esc(item["discussion_url"])}" rel="noopener noreferrer">discuss</a>'
    return (
        f'<li><a class="t" href="{esc(item["url"])}" rel="noopener noreferrer">{esc(item["title"])}</a>'
        f'<span class="meta">{esc(item["source"])}{discussion}</span></li>'
    )


def edition_date_label(date: dt.date) -> str:
    return date.strftime("%A, %-d %B %Y")


def updated_label(generated_at: str) -> str:
    try:
        moment = dt.datetime.fromisoformat(generated_at)
    except ValueError:
        return ""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=dt.timezone.utc)
    return moment.astimezone(IST).strftime("%H:%M IST")


def page(front: dict) -> str:
    date = dt.date.fromisoformat(front["date"])
    title = f"{SITE_NAME} · {front['date']}"
    description = "A daily front page: AI, dev, product and startup news compiled from a fixed list of sites, with the day's best stories checked against their sources."
    stories = front["stories"]
    if stories:
        lead = f'<section id="lead" class="lead" aria-label="Lead story">{story_card(stories[0], 1, "lead")}\n      </section>'
        picks = ""
        if len(stories) > 1:
            cards = "".join(story_card(story, index, "pick") for index, story in enumerate(stories[1:], 2))
            picks = f'\n      <section id="picks" class="picks" aria-label="Top stories"><h2 class="label">Top stories</h2><div class="pick-grid">{cards}\n      </div></section>'
    else:
        lead = '<section id="lead" class="lead quiet"><h2>Nothing cleared the bar today</h2><p>Every candidate was a launch post, a repost, or something I could not check. The lists below are still worth a look.</p></section>'
        picks = ""
    cards_html = "".join(
        f'<section id="s-{esc(section["id"])}" class="card"><h2 class="label">{esc(section["label"])}</h2>'
        f'<ol>{"".join(item_row(item) for item in section["items"][:SHOWN_LIST_ITEMS])}</ol></section>'
        for section in front["sections"]
    )
    cards_html = f'\n    <section class="cards" aria-label="From the sources"><h2 class="label">From the sources</h2><div class="card-grid">{cards_html}</div></section>' if cards_html else ""
    strip = ""
    if front["sections"]:
        links = "".join(f'<a href="#s-{esc(section["id"])}">{esc(section["label"])}</a>' for section in front["sections"])
        strip = f'\n    <nav class="strip" aria-label="Sections">{links}</nav>'
    wire = ""
    if front["wire"]:
        wire = f'\n      <aside id="wire" class="wire" aria-label="Most talked about"><h2 class="label">Most talked about</h2><ol>{"".join(item_row(item) for item in front["wire"][:SHOWN_WIRE_ITEMS])}</ol></aside>'
    updated = updated_label(front.get("generated_at", ""))
    stamp = f'<time datetime="{esc(front["date"])}">{esc(edition_date_label(date))}</time>'
    if updated:
        stamp += f' <span class="updated">updated {esc(updated)}</span>'
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)}</title>
  <link rel="canonical" href="{SITE_URL}">
  <meta name="description" content="{esc(description)}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{SITE_URL}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#f5f0e7">
  <link rel="icon" type="image/svg+xml" href="/daily/favicon.svg">
  <link rel="alternate" type="application/rss+xml" title="{SITE_NAME}" href="{SITE_URL}/feed.xml">
  <link rel="stylesheet" href="/daily/styles.css">
</head>
<body>
  <div class="paper">
    <p class="topbar"><span class="dateline">{stamp}</span><span class="feeds"><a href="{SITE_URL}/latest.json">JSON</a><a class="pill" href="{SITE_URL}/feed.xml">Subscribe</a></span></p>
    <header class="masthead">
      <h1><a href="/daily">{SITE_NAME}</a></h1>
      <p class="tagline">AI, dev, product and startup news, checked against the sources.</p>
    </header>{strip}
    <main class="layout">
      <div class="front">
      {lead}{wire}
      </div>{picks}
    </main>{cards_html}
    <footer><a class="footmark" href="/daily">{SITE_NAME}</a><span class="feeds"><a href="{SITE_URL}/latest.json">JSON</a><a class="pill" href="{SITE_URL}/feed.xml">Subscribe</a></span></footer>
  </div>
</body>
</html>
"""


def rss_item_description(edition: dict) -> str:
    parts = [f"<p>{edition['editor_note']}</p>"]
    for story in edition["stories"]:
        parts.append(f"<h3><a href=\"{story['url']}\">{story['title']}</a></h3>")
        parts.append(f"<p>{story['summary']}</p>")
        parts.append(f"<p><strong>Checked</strong> <a href=\"{story['evidence_url']}\">{story['fact']}</a></p>")
        parts.append(f"<p><strong>Nish</strong> {story['take']}</p>")
        parts.append(f"<p><strong>But</strong> {story['caveat']}</p>")
    return html.escape("".join(parts))


def rss(edition: dict) -> str:
    day = dt.date.fromisoformat(edition["date"])
    description = rss_item_description(edition)
    published = dt.datetime.combine(day, dt.time(2), tzinfo=dt.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
    guid = f"the-daily-{day.isoformat()}"
    item = f"<item><title>{SITE_NAME} · {day.isoformat()}</title><link>{SITE_URL}</link><guid isPermaLink=\"false\">{guid}</guid><pubDate>{published}</pubDate><description>{description}</description></item>"
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\"><channel>"
        f"<title>{SITE_NAME}</title><link>{SITE_URL}</link>"
        f"<atom:link href=\"{SITE_URL}/feed.xml\" rel=\"self\" type=\"application/rss+xml\"/>"
        "<description>A daily front page: AI, dev, product and startup news, with the day's best stories checked against their sources.</description>"
        f"<language>en</language><lastBuildDate>{published}</lastBuildDate>"
        + item + "</channel></rss>\n"
    )


def check_assets() -> None:
    for name in ASSETS:
        asset = DAILY / name
        if not asset.is_file():
            raise FileNotFoundError(f"Missing asset referenced by the daily page: {asset}")


def main() -> None:
    config = fetch_candidates.load_sources()
    latest = load_latest()
    DAILY.mkdir(parents=True, exist_ok=True)
    check_assets()
    pool, derived = load_pool(dt.date.fromisoformat(latest["date"]), config)
    if derived:
        POOLS.mkdir(parents=True, exist_ok=True)
        (POOLS / f"{latest['date']}.json").write_text(json.dumps(pool, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    front = compose_front(latest, pool, config)
    (DAILY / "index.html").write_text(page(front), encoding="utf-8")
    (DAILY / "latest.json").write_text(json.dumps(front, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DAILY / "feed.xml").write_text(rss(front), encoding="utf-8")
    print(f"built latest={front['date']} stories={len(front['stories'])} scanned={front['candidate_count']} sources={front['sources']['ok']}/{front['sources']['total']}")


if __name__ == "__main__":
    main()
