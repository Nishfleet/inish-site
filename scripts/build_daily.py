#!/usr/bin/env python3
"""Validate editions and render the latest Nish Daily feed at the site root.

The validator is the editorial gate. An edition that reads like generic AI copy
should fail here rather than reach inish.in, so most of this file is refusal
logic: every story must carry a checkable detail, every take must be first
person and anchored to that story, and nothing may repeat itself or a recent
edition.
"""

from __future__ import annotations

import datetime as dt
import html
import ipaddress
import json
import re
import shutil
import textwrap
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EDITIONS = ROOT / "data" / "editions"
DAILY = ROOT
# These committed root assets are canonical: the generated head references
# every one of them, and nothing in the build may overwrite them. The old build
# copied them from a stale daily/ mirror, which silently reverted merged root
# fixes on every publish (drift classes #27, #33/#45, and #41 each needed a
# hand re-sync of the mirror); the mirror is deleted and the build now only
# fails loudly if a referenced root asset goes missing.
ASSETS = ("app.js", "styles.css", "og-image.svg", "og-image.png", "apple-touch-icon.png")
SECTIONS = {"AI", "Product ideas", "Demand signals", "Tools", "Wildcard"}
REQUIRED_EDITION_FIELDS = {"date", "candidate_count", "editor_note", "stories"}
# evidence_url is the exact source the fact was verified against. It may equal
# url (the primary source carries the claim) or be a separate HTTPS URL — a
# discussion thread, a data page, a primary document — when the fact's evidence
# lives elsewhere. Without it a "Checked" fact is a bare assertion.
STORY_FIELDS = {"title", "url", "evidence_url", "source", "section", "summary", "fact", "take", "caveat"}

MAX_STORIES = 8
MAX_PER_SECTION = 4
MAX_PER_DOMAIN = 3
REPEAT_WINDOW_DAYS = 30
SHARED_PHRASE_LENGTH = 6

FIRST_PERSON = re.compile(r"\b(I|I'm|I'd|I've|I'll|my|me|mine)\b")
# Deliberately excludes the bare apostrophe: "the project's approach" is a
# contraction, not a quotation, and must not satisfy the fact gate on its own.
QUOTED = re.compile(r"[\"“”]")
WORD = re.compile(r"[a-z0-9][a-z0-9'+.-]*")

# Openers that produce an aphorism true of any story. Cheap to check, and every
# one of these was published before the gate existed.
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

# Ordinary words carry no evidence that a take is about its own story.
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
    # Inner dots and hyphens are kept on purpose so "1.8s", "v2.1", and
    # "six-week" survive; trailing ones are punctuation, not part of the word.
    cleaned = []
    for match in WORD.findall(text.lower()):
        word = match.strip(".-'")
        if word.endswith("'s"):
            word = word[:-2]  # so "postmark's" still anchors to "postmark"
        if word:
            cleaned.append(word)
    return cleaned


def singular(word: str) -> str:
    """Enough stemming that a plural in the take still matches a singular headline."""
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


def validate_text(value: object, field: str, minimum: int, maximum: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    text = value.strip()
    if not minimum <= len(text) <= maximum:
        raise ValueError(f"{field} must contain {minimum}-{maximum} characters; found {len(text)}")
    return text


def validate_fact(value: object) -> str:
    """A story earns its place with one detail a reader could go and check."""
    text = validate_text(value, "fact", 15, 240)
    if not any(character.isdigit() for character in text) and not QUOTED.search(text):
        raise ValueError(
            f"fact must carry a checkable detail — a number, version, date, price, or a quote "
            f"lifted from the source: {text!r}"
        )
    return text


def validate_take(value: object, anchor_pool: set[str]) -> str:
    """First person, and demonstrably about this story rather than any story."""
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
    """Catch the tell of generated copy: the same sentence shape, eight times."""
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
    """Recent URLs, so the feed cannot rediscover what it ran days ago."""
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
    """Normalize one story and gate it against history and its own fields.

    Returns the cleaned story; raises on a story that must not run.
    """
    if not isinstance(story, dict) or set(story) != STORY_FIELDS:
        raise ValueError(f"{path}: story fields must be exactly {sorted(STORY_FIELDS)}")
    url = validate_url(story["url"])
    # The fact's evidence may be the story itself or a separate source (a
    # discussion thread, a data page). It must exist and be a public HTTPS URL
    # either way: a "Checked" claim with no reachable evidence is rejected.
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
    if set(edition) != REQUIRED_EDITION_FIELDS:
        raise ValueError(f"{path}: edition fields must be exactly {sorted(REQUIRED_EDITION_FIELDS)}")
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
    return {
        "date": day.isoformat(),
        "candidate_count": candidate_count,
        "editor_note": validate_text(edition["editor_note"], "editor_note", 20, 400),
        "stories": clean_stories,
    }


def story_card(story: dict, index: int, prominence: str) -> str:
    domain = urlparse(story["url"]).netloc.removeprefix("www.")
    return f"""
      <article class="story story-{esc(prominence)}" data-section="{esc(story['section'])}">
        <div class="story-number">{index:02d}</div>
        <div class="story-body">
          <div class="story-meta"><span>{esc(story['section'])}</span><span>{esc(story['source'])}</span></div>
          <h2><a href="{esc(story['url'])}" rel="noopener noreferrer">{esc(story['title'])}</a></h2>
          <p>{esc(story['summary'])}</p>
          <p class="fact"><strong>Checked</strong> <a href="{esc(story['evidence_url'])}" rel="noopener noreferrer">{esc(story['fact'])}</a></p>
          <p class="take"><strong>Nish</strong> {esc(story['take'])}</p>
          <p class="caveat"><strong>But</strong> {esc(story['caveat'])}</p>
          <a class="source-link" href="{esc(story['url'])}" rel="noopener noreferrer">Read at {esc(domain)} ↗</a>
        </div>
      </article>"""


def prominence_for(index: int) -> str:
    if index == 1:
        return "lead"
    if index in (2, 3):
        return "feature"
    return "brief"


def html_safe_json(payload: dict) -> str:
    """Serialize a payload that parses as JSON yet cannot escape its script tag.

    The unicode escapes are JSON escapes: an extractor sees the original
    characters after parsing, while the serialized text contains no "<" that
    could open "</script>" and no "&" that a lenient HTML reader could mistake
    for an entity. This is the JSON-safe counterpart of esc() for script text.
    """
    serialized = json.dumps(payload, indent=2, ensure_ascii=False)
    for character, escape in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026")):
        serialized = serialized.replace(character, escape)
    return serialized


def json_ld(title: str, description: str, date: str) -> str:
    """The head's structured data: one graph with the site, its person, and the edition.

    Truth rules: only what the page itself shows. The site is the daily feed
    and nothing else, so the Person node claims no job title, employer,
    products, or biography — just the name and the one surface verified to
    belong to Nish.
    """
    person = {
        "@type": "Person",
        "name": "Nish",
        "url": "https://inish.in/",
        "sameAs": ["https://github.com/nish3451"],
    }
    graph = [
        {
            "@type": "WebSite",
            "name": "Nish's Daily Reads",
            "url": "https://inish.in/",
            "description": description,
        },
        person,
        {
            "@type": "Article",
            "headline": title,
            "datePublished": date,
            "mainEntityOfPage": "https://inish.in/",
            # The article references the person above by name and URL only.
            "author": {"@type": "Person", "name": "Nish", "url": "https://inish.in/"},
        },
    ]
    return html_safe_json({"@context": "https://schema.org", "@graph": graph})


def page(edition: dict) -> str:
    date = dt.date.fromisoformat(edition["date"])
    title_date = date.strftime("%A, %d %B %Y")
    title = f"Nish's Daily Reads — {edition['date']}"
    description = "A daily read for a founder: AI news, product ideas, and early signals of demand — in plain words."
    kept_count = len(edition["stories"])
    count_label = f"{edition['candidate_count']} scanned · {kept_count} kept"
    if edition["stories"]:
        cards = "\n".join(
            story_card(story, index, prominence_for(index))
            for index, story in enumerate(edition["stories"], 1)
        )
        # Only sections that ran today: a filter that leads to an empty page is a
        # promise the edition did not keep.
        present = [section for section in sorted(SECTIONS) if any(s["section"] == section for s in edition["stories"])]
        # The merged filter accessibility contract: exactly one button is
        # aria-pressed=true (the active All filter), every other filter is
        # explicitly false, and a polite live region announces the initial
        # visible count so the static markup matches app.js's runtime updates.
        status_noun = "story" if kept_count == 1 else "stories"
        filters = f"""
    <nav class="filters" aria-label="Filter stories">
      <button class="active" data-filter="all" aria-pressed="true">All</button>
      {''.join(f'<button data-filter="{esc(section)}" aria-pressed="false">{esc(section)}</button>' for section in present)}
    </nav>
    <p class="visually-hidden" id="filter-status" role="status" aria-live="polite">Showing all {kept_count} {status_noun}</p>"""
    else:
        cards = """
      <article class="story story-lead quiet-day">
        <div class="story-number">00</div>
        <div class="story-body">
          <h2>Nothing cleared the bar today</h2>
          <p>Every candidate was a launch post, a repost, or something I could not check. A short edition beats a padded one.</p>
        </div>
      </article>"""
        filters = ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)}</title>
  <link rel="canonical" href="https://inish.in/">
  <meta name="description" content="{esc(description)}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:image" content="https://inish.in/og-image.png">
  <meta property="og:image:alt" content="Nish's Daily Reads: AI news, product ideas, and early signals of demand — in plain words.">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="https://inish.in/og-image.png">
  <link rel="apple-touch-icon" sizes="180x180" type="image/png" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" href="/apple-touch-icon.png">
  <link rel="alternate" type="application/rss+xml" title="Nish's Daily Reads" href="https://inish.in/feed.xml">
  <link rel="preload" href="/fonts/archivo-700.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
{textwrap.indent(json_ld(title, description, edition["date"]), "  ")}
  </script>
</head>
<body>
  <a class="skip" href="#stories">Skip to stories</a>
  <header class="masthead">
    <div class="masthead-top"><a href="/">inish.in</a><span>{esc(title_date)}</span><span>{esc(count_label)}</span></div>
    <div class="title-row"><div><p class="kicker">Built for one reader</p><h1>Nish's Daily Reads</h1></div><p class="dek">AI, product ideas, and where demand is building. Plain words, point first, nothing here unless there is a fact under it.</p></div>{filters}
  </header>
  <main id="stories" class="stories">
    <section class="edition-note"><span>Editor’s note</span><p>{esc(edition['editor_note'])}</p></section>
{cards}
  </main>
  <footer>
    <div class="footer-links"><a href="/feed.xml">RSS</a><a href="/latest.json">JSON</a></div>
    <p class="identity"><a href="https://tinystudio.in/" rel="noopener noreferrer">Tiny Studio ↗</a> — Nish's studio.</p>
    <p>Curated by Hermes on Nish's VPS. Sources remain the source of truth.</p>
  </footer>
  <script src="/app.js" defer></script>
</body>
</html>
"""


def rss_item_description(edition: dict) -> str:
    """The item body: the editor's note plus every story, so a subscriber who
    reads the feed in a reader still sees the edition after the root page has
    rolled over to a newer day. The assembled HTML is escaped once as a whole,
    so the description is character data (per RSS practice) and one story's
    ampersand or angle bracket cannot corrupt another's markup.
    """
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
    link = "https://inish.in/"
    description = rss_item_description(edition)
    published = dt.datetime.combine(day, dt.time(0), tzinfo=dt.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
    guid = f"inish-daily-{day.isoformat()}"
    item = f"<item><title>Nish's Daily Reads — {day.isoformat()}</title><link>{link}</link><guid isPermaLink=\"false\">{guid}</guid><pubDate>{published}</pubDate><description>{description}</description></item>"
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\"><channel><title>Nish's Daily Reads</title><link>https://inish.in/</link><description>A daily read for a founder: AI, product ideas, and demand signals.</description>" + item + "</channel></rss>\n"


def sitemap(edition: dict) -> str:
    """The single public URL, stamped with the edition date as <lastmod>.

    The root page is rewritten on every publish, so a sitemap entry without
    <lastmod> says nothing about when that content changed: a search or AI
    crawler sees the identical entry on the day a new edition lands as on a day
    the site sat still, and has to refetch to find out. The stamp is derived
    from the accepted edition's own date — the same date the page, the RSS
    pubDate, and latest.json publish — so freshness stays one signal from one
    source instead of a hand-maintained guess that can drift. W3C Datetime
    (which the sitemap protocol requires) permits the date-only form, which is
    exactly the resolution a once-a-day edition actually has.
    """
    day = dt.date.fromisoformat(edition["date"])
    body = f'<url><loc>https://inish.in/</loc><lastmod>{day.isoformat()}</lastmod></url>'
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n'


def check_root_assets() -> None:
    """The generated page references these committed root assets; the build
    fails loudly if any of them is missing. The root is canonical: nothing is
    ever copied over it from a mirror, because a stale mirror is exactly what
    kept reverting merged root fixes (drift classes #27, #33/#45, #41)."""
    for name in ASSETS:
        asset = DAILY / name
        if not asset.is_file():
            raise FileNotFoundError(f"Missing root asset referenced by the daily page: {asset}")


def main() -> None:
    latest = load_latest()
    DAILY.mkdir(parents=True, exist_ok=True)
    check_root_assets()
    archive_root = DAILY / "archive"
    if archive_root.is_symlink() or archive_root.is_file():
        archive_root.unlink()
    elif archive_root.is_dir():
        shutil.rmtree(archive_root)
    (DAILY / "index.html").write_text(page(latest), encoding="utf-8")
    (DAILY / "latest.json").write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DAILY / "feed.xml").write_text(rss(latest), encoding="utf-8")
    (DAILY / "sitemap.xml").write_text(sitemap(latest), encoding="utf-8")
    print(f"built latest={latest['date']} stories={len(latest['stories'])} scanned={latest['candidate_count']}")


if __name__ == "__main__":
    main()
