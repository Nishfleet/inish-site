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
import time
import html
import json
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "inish-daily/1.0 (+https://inish.in/)"

# Reddit serves its JSON API 403 to anything that looks automated, but the RSS
# feeds still answer 200 for a browser user-agent. It rate-limits hard, so the
# subreddits are fetched slowly and one failure never sinks the run.
BROWSER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
REDDIT_SUBS = (("SaaS", "Product ideas"), ("startups", "Demand signals"), ("Entrepreneur", "Demand signals"))
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
                "description": strip_tags(node.findtext("atom:summary", default="", namespaces=ns))[:600],
                "published": node.findtext("atom:updated", default="", namespaces=ns),
            })
    return items


def google_news(query: str, lens: str) -> list[dict]:
    """Google News is the only broad, key-free way to reach non-developer press."""
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    return feed(url, "Google News", lens, INDEPENDENT, limit=15)


def reddit() -> list[dict]:
    """Where people say out loud what they want and what they will pay for."""
    items: list[dict] = []
    failures: list[str] = []
    for index, (sub, lens) in enumerate(REDDIT_SUBS):
        if index:
            time.sleep(REDDIT_PAUSE)
        url = f"https://www.reddit.com/r/{sub}/top/.rss?t=day"
        for attempt in range(REDDIT_RETRIES):
            try:
                items.extend(feed(url, f"r/{sub}", lens, INDEPENDENT, 15, agent=BROWSER_AGENT))
                break
            except Exception as exc:
                if attempt == REDDIT_RETRIES - 1:
                    failures.append(f"r/{sub}: {type(exc).__name__}")
                else:
                    time.sleep(REDDIT_PAUSE * (attempt + 2))
    if failures and not items:
        raise RuntimeError("; ".join(failures))
    return items


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
        ("show_hn", show_hn),
        ("lobsters", lobsters),
        ("github", lambda: github(day)),
        ("openai_news", lambda: feed("https://openai.com/news/rss.xml", "OpenAI", "AI", SELF_REPORTED, 12)),
        ("techcrunch_ai", lambda: feed("https://techcrunch.com/category/artificial-intelligence/feed/", "TechCrunch", "AI", INDEPENDENT, 20)),
        ("product_hunt", lambda: feed("https://www.producthunt.com/feed", "Product Hunt", "Product ideas", SELF_REPORTED, 20)),
        ("news_ai", lambda: google_news("AI model release OR pricing OR capability when:3d", "AI")),
        ("news_funding", lambda: google_news("AI startup raises funding round when:3d", "Demand signals")),
        ("news_adoption", lambda: google_news("companies spending on AI agents adoption budget when:7d", "Demand signals")),
        ("reddit", reddit),
    ):
        try:
            candidates.extend(loader())
        except Exception as exc:  # Keep the other independent sources useful.
            errors.append(f"{name}: {type(exc).__name__}: {exc}")

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
        "candidates": candidates,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(output)
    print(f"candidates={len(candidates)} by_class={by_class}")
    print(f"by_lens={by_lens} source_errors={len(errors)}")
    return 0 if candidates else 1


if __name__ == "__main__":
    raise SystemExit(main())
