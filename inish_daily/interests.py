from __future__ import annotations

import html
import json
import re
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

INTERESTS_FILE = Path(__file__).with_name("interests.json")
SIGNAL_TYPES = ("github_stars", "x_posts")
PAGE_BYTES = 2_000_000
BROWSER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
LINE_CHARS = 160
MAX_LINES = 40


def load(path: Path = INTERESTS_FILE) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    seen: set[str] = set()
    for signal in data["signals"]:
        for key in ("id", "name", "type"):
            if not isinstance(signal.get(key), str) or not signal[key]:
                raise ValueError(f"{path}: signal needs a non-empty {key}: {signal}")
        if signal["id"] in seen:
            raise ValueError(f"{path}: duplicate signal id {signal['id']}")
        seen.add(signal["id"])
        if signal["type"] not in SIGNAL_TYPES:
            raise ValueError(f"{path}: {signal['id']} has unknown type {signal['type']}")
        if not isinstance(signal.get("user"), str):
            raise ValueError(f"{path}: {signal['id']} needs a user (empty switches it off)")
    return data["signals"]


def line(text: str) -> str:
    return " ".join(text.split())[:LINE_CHARS]


def github_stars(user: str, limit: int) -> list[str]:
    path = f"users/{urllib.parse.quote(user)}/starred?per_page={limit}"
    command = ["gh", "api", path]
    payload = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, timeout=30).stdout)
    return [
        line(f"{repo['full_name']}: {repo.get('description') or ''}".rstrip(": "))
        for repo in payload[:limit]
    ]


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read(PAGE_BYTES).decode("utf-8", errors="replace")


def from_syndication(page: str) -> list[str]:
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.DOTALL)
    if not match:
        return []
    entries = json.loads(match.group(1)).get("props", {}).get("pageProps", {}).get("timeline", {}).get("entries") or []
    lines = []
    for entry in entries:
        post = (entry.get("content") or {}).get("tweet") or {}
        links = [u.get("expanded_url") or "" for u in (post.get("entities") or {}).get("urls") or []]
        lines.append(line(" ".join([post.get("full_text") or post.get("text") or "", *filter(None, links)])))
    return [text for text in lines if text]


def from_rss(page: str) -> list[str]:
    root = ET.fromstring(page)
    return [text for text in (line(html.unescape(node.findtext("title") or "")) for node in root.findall(".//item")) if text]


def x_posts(user: str, limit: int, fetch=fetch_text) -> list[str]:
    name = urllib.parse.quote(user)
    failures = []
    for template, parse in X_PUBLIC:
        try:
            found = parse(fetch(template.format(user=name)))
        except Exception as exc:
            failures.append(type(exc).__name__)
            continue
        if found:
            return found[:limit]
        failures.append("empty")
    raise RuntimeError(f"no public X reader answered ({', '.join(failures)})")


X_PUBLIC = (
    ("https://syndication.twitter.com/srv/timeline-profile/screen-name/{user}", from_syndication),
    ("https://nitter.net/{user}/rss", from_rss),
    ("https://xcancel.com/{user}/rss", from_rss),
)


def collect(signals: list[dict] | None = None) -> tuple[list[str], list[dict], list[str]]:
    lines: list[str] = []
    report: list[dict] = []
    errors: list[str] = []
    for signal in load() if signals is None else signals:
        user, limit = signal["user"], signal.get("limit", 30)
        if not user:
            continue
        try:
            if signal["type"] == "github_stars":
                found = github_stars(user, limit)
            else:
                found = x_posts(user, limit)
        except Exception as exc:
            reason = f"{type(exc).__name__}: {str(exc)[:120]}"
            errors.append(f"interests: {signal['id']}: {reason}")
            report.append({"id": signal["id"], "name": signal["name"], "count": 0, "error": reason})
            continue
        lines.extend(found)
        report.append({"id": signal["id"], "name": signal["name"], "count": len(found), "error": None})
    return lines[:MAX_LINES], report, errors
