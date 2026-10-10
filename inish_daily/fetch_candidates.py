#!/usr/bin/env python3
"""Fetch a small, auditable candidate pool for The Daily (nish.sh/daily).

Pool quality decides edition quality. A week-old repository with 15 stars has
no evidence behind it except its own README, so an editor working from that
pool can only paraphrase marketing. Every candidate here therefore carries an
`evidence_class` saying what kind of proof exists for it, and discussion
threads are pulled alongside links so criticism is in the pool, not just
announcements.

Discussion provenance is kept on each candidate as `discussion_url` (Hacker
News, Show HN, Lobsters). When a fact is verified against the discussion
rather than the linked article, the edition's `evidence_url` must be that
`discussion_url` — the builder renders the "Checked" line as a link to it, so
the provenance survives into the published page instead of being dropped.
"""

from __future__ import annotations

import argparse
import datetime as dt
import functools
import time
import html
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from inish_daily import jev_rank

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "the-daily/1.0 (+https://nish.sh/daily)"
SOURCES_FILE = Path(__file__).with_name("sources.json")

# Reddit serves its JSON API 403 to anything that looks automated, but the RSS
# feeds still answer 200 for a browser user-agent. It rate-limits hard, so the
# subreddits are fetched slowly and one failure never sinks the run.
BROWSER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
REDDIT_PAUSE = 4.0
REDDIT_RETRIES = 3

# What kind of proof exists for a candidate:
#   independent   - surfaced by a third party rather than its own author. Check
#                   signals.comments before treating it as actually discussed;
#                   a zero-comment submission has been seen, not argued about.
#   self-reported - the only account of it is the author's own
#   preprint      - unreviewed research
INDEPENDENT = "independent"
SELF_REPORTED = "self-reported"
PREPRINT = "preprint"

DISCUSSION_DEPTH = 8
COMMENTS_PER_STORY = 3
COMMENT_CHARS = 500

# A repository has to have survived contact with people who did not write it.
GITHUB_MIN_STARS = 200
GITHUB_MAX_AGE_DAYS = 90


def get_json(url: str, timeout: int = 20) -> object:
    """Returns whatever the endpoint sends; Lobsters answers with a list."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def strip_tags(text: str) -> str:
    # Hacker News returns HTML with real angle brackets escaped as entities, so
    # every bare '<' here is markup. Entities are unescaped after stripping.
    out, depth = [], 0
    for character in text:
        if character == "<":
            depth += 1
        elif character == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(character)
    return " ".join(html.unescape("".join(out)).split())


def top_comments(object_id: str) -> list[str]:
    """The argument under a link is usually worth more than the link."""
    # The id comes from a third party and is about to become part of a URL path.
    if not str(object_id).isalnum():
        return []
    try:
        item = get_json(f"https://hn.algolia.com/api/v1/items/{object_id}", timeout=15)
    except (OSError, ValueError):  # network or bad JSON; comments are optional context
        return []
    comments = []
    for child in (item.get("children") or [])[:12]:
        text = child.get("text")
        if not child.get("author") or not isinstance(text, str):
            continue
        cleaned = strip_tags(text)
        if len(cleaned) < 120:
            continue
        comments.append(cleaned[:COMMENT_CHARS])
        if len(comments) == COMMENTS_PER_STORY:
            break
    return comments


def hacker_news() -> list[dict]:
    payload = get_json("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40")
    stories = []
    for hit in payload.get("hits", []):
        title = hit.get("title") or hit.get("story_title")
        if not title:
            continue
        stories.append({
            "source": "Hacker News",
            "evidence_class": INDEPENDENT,
            "lens": "Tools",
            "title": title,
            "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "discussion_url": f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "object_id": hit["objectID"],
            "signals": {"points": hit.get("points", 0), "comments": hit.get("num_comments", 0)},
        })
    stories.sort(key=lambda item: item["signals"]["comments"], reverse=True)
    for story in stories[:DISCUSSION_DEPTH]:
        story["discussion"] = top_comments(story.pop("object_id"))
    for story in stories:
        story.pop("object_id", None)
    return stories


def lobsters() -> list[dict]:
    payload = get_json("https://lobste.rs/hottest.json")
    return [
        {
            "source": "Lobsters",
            "evidence_class": INDEPENDENT,
            "lens": "Tools",
            "title": item.get("title", ""),
            "url": item.get("url") or item.get("short_id_url", ""),
            "discussion_url": item.get("comments_url", ""),
            "description": ", ".join(item.get("tags", [])),
            "signals": {"score": item.get("score", 0), "comments": item.get("comment_count", 0)},
        }
        for item in payload
        if item.get("title") and (item.get("url") or item.get("short_id_url"))
    ]


def github(day: dt.date) -> list[dict]:
    """Repositories with outside validation, not this week's launch posts."""
    since = day - dt.timedelta(days=GITHUB_MAX_AGE_DAYS)
    query = urllib.parse.quote(f"created:>={since.isoformat()} stars:>={GITHUB_MIN_STARS}")
    command = ["gh", "api", f"search/repositories?q={query}&sort=stars&order=desc&per_page=30"]
    payload = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, timeout=30).stdout)
    return [
        {
            "source": "GitHub",
            "evidence_class": SELF_REPORTED,
            "lens": "Tools",
            "title": item["full_name"],
            "url": item["html_url"],
            "description": item.get("description") or "",
            "signals": {
                "stars": item.get("stargazers_count", 0),
                "forks": item.get("forks_count", 0),
                "open_issues": item.get("open_issues_count", 0),
                "language": item.get("language"),
                "created_at": item.get("created_at"),
                "pushed_at": item.get("pushed_at"),
            },
        }
        for item in payload.get("items", [])
    ]


def feed(url: str, source: str, lens: str, evidence: str, limit: int = 20, agent: str = USER_AGENT) -> list[dict]:
    """Parse an RSS or Atom feed into candidates."""
    request = urllib.request.Request(url, headers={"User-Agent": agent})
    with urllib.request.urlopen(request, timeout=25) as response:
        root = ET.fromstring(response.read())

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []

    for node in root.findall(".//item")[:limit]:
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        if title and link.startswith("https://"):
            items.append({
                "source": source,
                "evidence_class": evidence,
                "lens": lens,
                "title": " ".join(strip_tags(title).split()),
                "url": link,
                "description": strip_tags(node.findtext("description") or "")[:600],
                "published": (node.findtext("pubDate") or "").strip(),
            })

    for node in root.findall("atom:entry", ns)[:limit]:
        title = " ".join((node.findtext("atom:title", default="", namespaces=ns)).split())
        link_node = node.find("atom:link", ns)
        link = (link_node.get("href") if link_node is not None else "") or ""
        if title and link.startswith("https://"):
            items.append({
                "source": source,
                "evidence_class": evidence,
                "lens": lens,
                "title": title,
                "url": link,
                # Reddit's Atom carries the post body in <content> and has no <summary>.
                "description": strip_tags(
                    node.findtext("atom:summary", default="", namespaces=ns)
                    or node.findtext("atom:content", default="", namespaces=ns)
                )[:600],
                "published": node.findtext("atom:updated", default="", namespaces=ns),
            })
    return items


def google_news(query: str, lens: str) -> list[dict]:
    """Google News is the only broad, key-free way to reach non-developer press."""
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    return feed(url, "Google News", lens, INDEPENDENT, limit=15)


def reddit(sub: str, source: str, lens: str) -> list[dict]:
    """Where people say out loud what they want and what they will pay for.

    One subreddit per call. Reddit rate-limits hard, so a 429 is retried with a
    growing pause and, in the end, reported as this source's error only.
    """
    url = f"https://www.reddit.com/r/{sub}/top/.rss?t=day"
    for attempt in range(REDDIT_RETRIES):
        try:
            return feed(url, source, lens, INDEPENDENT, 15, agent=BROWSER_AGENT)
        except Exception:
            if attempt == REDDIT_RETRIES - 1:
                raise
            time.sleep(REDDIT_PAUSE * (attempt + 2))
    return []


def show_hn() -> list[dict]:
    """People launching things: the cleanest read on what someone thinks is wanted."""
    payload = get_json("https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=25")
    items = []
    for hit in payload.get("hits", []) if isinstance(payload, dict) else []:
        title = hit.get("title") or hit.get("story_title")
        if not title:
            continue
        items.append({
            "source": "Show HN",
            "evidence_class": SELF_REPORTED,
            "lens": "Product ideas",
            "title": title,
            "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "discussion_url": f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "signals": {"points": hit.get("points", 0), "comments": hit.get("num_comments", 0)},
        })
    return items


SOURCE_TYPES = ("hacker_news", "show_hn", "lobsters", "github", "rss", "google_news", "reddit")


def load_sources(path: Path = SOURCES_FILE) -> dict:
    """Read and check sources.json, the one place a site is added or removed."""
    data = json.loads(path.read_text(encoding="utf-8"))
    groups = {group["id"] for group in data["groups"]}
    seen: set[str] = set()
    for source in data["sources"]:
        for key in ("id", "name", "type", "group", "lens", "evidence"):
            if not isinstance(source.get(key), str) or not source[key]:
                raise ValueError(f"{path}: source needs a non-empty {key}: {source}")
        if source["id"] in seen:
            raise ValueError(f"{path}: duplicate source id {source['id']}")
        seen.add(source["id"])
        if source["type"] not in SOURCE_TYPES:
            raise ValueError(f"{path}: {source['id']} has unknown type {source['type']}")
        if source["group"] not in groups:
            raise ValueError(f"{path}: {source['id']} names unknown group {source['group']}")
        if source["evidence"] not in (INDEPENDENT, SELF_REPORTED, PREPRINT):
            raise ValueError(f"{path}: {source['id']} has unknown evidence class {source['evidence']}")
        need = {"rss": "url", "google_news": "query", "reddit": "sub"}.get(source["type"])
        if need and not isinstance(source.get(need), str):
            raise ValueError(f"{path}: {source['id']} (type {source['type']}) needs {need}")
    for pattern in data.get("filters", {}).get("skip_title_regex", []):
        re.compile(pattern)
    return data


def skipped_title(title: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, title, re.IGNORECASE) for pattern in patterns)


def load_source(source: dict, day: dt.date, skip: list[str] | None = None) -> list[dict]:
    """Fetch one configured source and tag every candidate with where it came from."""
    kind = source["type"]
    if kind == "hacker_news":
        items = hacker_news()
    elif kind == "show_hn":
        items = show_hn()
    elif kind == "lobsters":
        items = lobsters()
    elif kind == "github":
        items = github(day)
    elif kind == "rss":
        items = feed(
            source["url"], source["name"], source["lens"], source["evidence"], source.get("limit", 20),
            agent=BROWSER_AGENT if source.get("browser_agent") else USER_AGENT,
        )
        if source.get("title_prefix"):
            for item in items:
                item["title"] = f"{source['title_prefix']}: {item['title']}"
    elif kind == "google_news":
        items = google_news(source["query"], source["lens"])
    else:
        items = reddit(source["sub"], source["name"], source["lens"])
    # Hype, listicles and "X now matches Y" parity news are dropped before
    # ranking, so Jev never spends a grade on them.
    items = [item for item in items if not skipped_title(item["title"], skip or [])]
    for item in items:
        item["source"] = source["name"]
        item["source_id"] = source["id"]
        item["group"] = source["group"]
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=dt.date.today().isoformat())
    args = parser.parse_args()
    day = dt.date.fromisoformat(args.date)
    output = ROOT / "data" / "candidates" / f"{day.isoformat()}.json"
    output.parent.mkdir(parents=True, exist_ok=True)

    config = load_sources()
    candidates: list[dict] = []
    errors: list[str] = []
    report: list[dict] = []
    previous_reddit = False
    seen_urls: set[str] = set()
    for source in config["sources"]:
        if source["type"] == "reddit" and previous_reddit:
            time.sleep(REDDIT_PAUSE)
        previous_reddit = source["type"] == "reddit"
        try:
            items = load_source(source, day, config.get("filters", {}).get("skip_title_regex", []))
            fresh = [item for item in items if item["url"] not in seen_urls]
            seen_urls.update(item["url"] for item in fresh)
            candidates.extend(fresh)
            report.append({"id": source["id"], "name": source["name"], "group": source["group"], "count": len(items), "error": None})
        except Exception as exc:  # Keep the other independent sources useful.
            errors.append(f"{source['id']}: {type(exc).__name__}: {exc}")
            report.append({"id": source["id"], "name": source["name"], "group": source["group"], "count": 0, "error": type(exc).__name__})

    ranked_by = None
    jev_key = os.environ.get("TYPESAFE_API_KEY")
    if not jev_key:
        errors.append("jev: skipped, TYPESAFE_API_KEY is not set; candidates are in fetch order")
    elif not candidates:
        errors.append("jev: skipped, no candidates to rank")
    else:
        try:
            ranked = jev_rank.rank(
                candidates, day.isoformat(), jev_key,
                fetch_page=functools.partial(jev_rank.page_text, agent=BROWSER_AGENT),
            )
            ranked_by = ranked[0]["jev"]["model"]
            candidates = ranked
        except Exception as exc:  # A ranking failure must never block the edition.
            errors.append(f"jev: {type(exc).__name__}: {exc}; candidates are in fetch order")

    by_class: dict[str, int] = {}
    by_lens: dict[str, int] = {}
    for candidate in candidates:
        key = candidate["evidence_class"]
        by_class[key] = by_class.get(key, 0) + 1
        lens = candidate.get("lens", "unsorted")
        by_lens[lens] = by_lens.get(lens, 0) + 1

    payload = {
        "date": day.isoformat(),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "candidate_count": len(candidates),
        "by_evidence_class": by_class,
        "by_lens": by_lens,
        "source_errors": errors,
        "sources": report,
        "ranked_by": ranked_by,
        "candidates": candidates,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(output)
    print(f"candidates={len(candidates)} by_class={by_class}")
    print(f"by_lens={by_lens} source_errors={len(errors)}")
    print(f"ranked_by={ranked_by}")
    return 0 if candidates else 1


if __name__ == "__main__":
    raise SystemExit(main())
