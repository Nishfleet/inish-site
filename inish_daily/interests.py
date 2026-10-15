from __future__ import annotations

import json
import os
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

INTERESTS_FILE = Path(__file__).with_name("interests.json")
SIGNAL_TYPES = ("github_stars", "x_likes")
X_API = "https://api.x.com/2"
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


def x_get(path: str, token: str) -> dict:
    request = urllib.request.Request(f"{X_API}/{path}", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def x_likes(user: str, limit: int, token: str, get=x_get) -> list[str]:
    account = get(f"users/by/username/{urllib.parse.quote(user)}", token)["data"]["id"]
    count = max(5, min(limit, 100))
    payload = get(f"users/{account}/liked_tweets?max_results={count}&tweet.fields=entities", token)
    lines = []
    for post in payload.get("data") or []:
        links = [u.get("title") or u.get("expanded_url") or "" for u in (post.get("entities") or {}).get("urls") or []]
        lines.append(line(" ".join([post.get("text") or "", *filter(None, links)])))
    return [text for text in lines if text][:limit]


def collect(signals: list[dict] | None = None, env=os.environ) -> tuple[list[str], list[dict], list[str]]:
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
            elif not env.get("X_BEARER_TOKEN"):
                errors.append(f"interests: {signal['id']} skipped, X_BEARER_TOKEN is not set")
                report.append({"id": signal["id"], "name": signal["name"], "count": 0, "error": "no key"})
                continue
            else:
                found = x_likes(user, limit, env["X_BEARER_TOKEN"])
        except Exception as exc:
            errors.append(f"interests: {signal['id']}: {type(exc).__name__}")
            report.append({"id": signal["id"], "name": signal["name"], "count": 0, "error": type(exc).__name__})
            continue
        lines.extend(found)
        report.append({"id": signal["id"], "name": signal["name"], "count": len(found), "error": None})
    return lines[:MAX_LINES], report, errors
