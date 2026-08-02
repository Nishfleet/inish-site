#!/usr/bin/env python3
"""Fetch a small, auditable candidate pool for the Nish Daily editor."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "inish-daily/1.0 (+https://inish.in/daily/)"


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def hacker_news() -> list[dict]:
    payload = get_json("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40")
    return [
        {
            "source": "Hacker News",
            "title": hit.get("title") or hit.get("story_title"),
            "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "discussion_url": f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "signals": {"points": hit.get("points", 0), "comments": hit.get("num_comments", 0)},
        }
        for hit in payload.get("hits", [])
        if hit.get("title") or hit.get("story_title")
    ]


def github(day: dt.date) -> list[dict]:
    since = day - dt.timedelta(days=7)
    query = urllib.parse.quote(f"created:>={since.isoformat()} stars:>=15")
    command = [
        "gh", "api", f"search/repositories?q={query}&sort=stars&order=desc&per_page=30",
    ]
    payload = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, timeout=30).stdout)
    return [
        {
            "source": "GitHub",
            "title": item["full_name"],
            "url": item["html_url"],
            "description": item.get("description") or "",
            "signals": {"stars": item.get("stargazers_count", 0), "language": item.get("language")},
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
        items.append({"source": "arXiv", "title": title, "url": url, "description": summary})
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
    for name, loader in (("hacker_news", hacker_news), ("github", lambda: github(day)), ("arxiv", arxiv)):
        try:
            candidates.extend(loader())
        except Exception as exc:  # Keep the other independent sources useful.
            errors.append(f"{name}: {type(exc).__name__}: {exc}")

    payload = {
        "date": day.isoformat(),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "candidate_count": len(candidates),
        "source_errors": errors,
        "candidates": candidates,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(output)
    print(f"candidates={len(candidates)} source_errors={len(errors)}")
    return 0 if candidates else 1


if __name__ == "__main__":
    raise SystemExit(main())
