#!/usr/bin/env python3
"""Fetch a small, auditable candidate pool for the Nish Daily editor.

Pool quality decides edition quality. A week-old repository with 15 stars has
no evidence behind it except its own README, so an editor working from that
pool can only paraphrase marketing. Every candidate here therefore carries an
`evidence_class` saying what kind of proof exists for it, and discussion
threads are pulled alongside links so criticism is in the pool, not just
announcements.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "inish-daily/1.0 (+https://inish.in/)"

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
    except Exception:
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


def arxiv() -> list[dict]:
    query = urllib.parse.quote("cat:cs.AI OR cat:cs.HC OR cat:cs.SE")
    url = f"https://export.arxiv.org/api/query?search_query={query}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        root = ET.fromstring(response.read())
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []
    for entry in root.findall("atom:entry", ns):
        title = " ".join((entry.findtext("atom:title", default="", namespaces=ns)).split())
        summary = " ".join((entry.findtext("atom:summary", default="", namespaces=ns)).split())
        url = entry.findtext("atom:id", default="", namespaces=ns)
        items.append({
            "source": "arXiv",
            "evidence_class": PREPRINT,
            "title": title,
            "url": url,
            "description": summary,
        })
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=dt.date.today().isoformat())
    args = parser.parse_args()
    day = dt.date.fromisoformat(args.date)
    output = ROOT / "data" / "candidates" / f"{day.isoformat()}.json"
    output.parent.mkdir(parents=True, exist_ok=True)

    candidates: list[dict] = []
    errors: list[str] = []
    for name, loader in (
        ("hacker_news", hacker_news),
        ("lobsters", lobsters),
        ("github", lambda: github(day)),
        ("arxiv", arxiv),
    ):
        try:
            candidates.extend(loader())
        except Exception as exc:  # Keep the other independent sources useful.
            errors.append(f"{name}: {type(exc).__name__}: {exc}")

    by_class: dict[str, int] = {}
    for candidate in candidates:
        key = candidate["evidence_class"]
        by_class[key] = by_class.get(key, 0) + 1

    payload = {
        "date": day.isoformat(),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "candidate_count": len(candidates),
        "by_evidence_class": by_class,
        "source_errors": errors,
        "candidates": candidates,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(output)
    print(f"candidates={len(candidates)} by_class={by_class} source_errors={len(errors)}")
    return 0 if candidates else 1


if __name__ == "__main__":
    raise SystemExit(main())
