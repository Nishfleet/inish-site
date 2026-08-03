#!/usr/bin/env python3
"""Verify the complete public route contract for feed-only inish.in."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_CLOUDFLARE_BEACON = re.compile(
    rb'^<script type="module" src="https://static\.cloudflareinsights\.com/beacon\.min\.js/[A-Za-z0-9._-]+" '
    rb'integrity="sha512-[A-Za-z0-9+/=]+" data-cf-beacon=\'\{[^\'\r\n]*\}\' '
    rb'crossorigin="anonymous"></script>\r?\n?',
    re.MULTILINE,
)


def without_cloudflare_beacon(body: bytes) -> bytes:
    matches = list(_CLOUDFLARE_BEACON.finditer(body))
    if len(matches) != 1:
        return body
    match = matches[0]
    return body[:match.start()] + body[match.end():]


def fetch(base: str, path: str, *, method: str = "GET") -> tuple[int, bytes, str | None]:
    request = Request(urljoin(base, path), headers={"User-Agent": "inish-live-verifier/1.0"}, method=method)
    try:
        response = build_opener(NoRedirect).open(request, timeout=15)
        with response:
            return response.status, response.read(), response.headers.get("Location")
    except HTTPError as error:
        return error.code, error.read(), error.headers.get("Location")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://inish.in/")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--edition-date", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    parsed_base = urlparse(args.base)
    if parsed_base.scheme != "https" or not parsed_base.netloc or parsed_base.username or parsed_base.password:
        parser.error("--base must be a public HTTPS origin")
    cache_token = f"{args.commit}-{time.time_ns()}"
    failures: list[str] = []

    for path, relative in {
        "/": "index.html",
        "/app.js": "app.js",
        "/styles.css": "styles.css",
        "/latest.json": "latest.json",
        "/feed.xml": "feed.xml",
    }.items():
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}")
        expected = (args.root / relative).read_bytes()
        if path == "/":
            body = without_cloudflare_beacon(body)
        if status != 200 or body != expected:
            failures.append(f"{path}: expected exact 200 body, got {status} and {len(body)} bytes")

    for path in ("/", "/app.js", "/styles.css", "/latest.json", "/feed.xml", "/robots.txt", "/sitemap.xml"):
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}", method="HEAD")
        if status != 200 or body:
            failures.append(f"HEAD {path}: expected empty 200, got {status} and {len(body)} bytes")

    status, body, _ = fetch(args.base, f"/latest.json?deploy={cache_token}")
    if status == 200:
        try:
            if json.loads(body)["date"] != args.edition_date:
                failures.append("/latest.json: edition date mismatch")
        except (KeyError, json.JSONDecodeError):
            failures.append("/latest.json: invalid JSON")

    redirects = {
        "/index.html": "/",
        "/daily": "/",
        "/daily/": "/",
        "/daily/index.html": "/",
        "/daily/app.js": "/app.js",
        "/daily/styles.css": "/styles.css",
        "/daily/latest.json": "/latest.json",
        "/daily/feed.xml": "/feed.xml",
        "/daily/sitemap.xml": "/sitemap.xml",
    }
    for path, target in redirects.items():
        request_path = f"{path}?deploy={cache_token}"
        expected_location = urljoin(args.base, f"{target}?deploy={cache_token}")
        for method in ("GET", "HEAD"):
            status, body, location = fetch(args.base, request_path, method=method)
            actual_location = urljoin(args.base, location or "")
            if status != 301 or actual_location != expected_location or (method == "HEAD" and body):
                failures.append(
                    f"{method} {path}: expected 301 to {expected_location}, "
                    f"got {status} to {location} with {len(body)} bytes"
                )

    removed = [
        "/llms.txt",
        "/archive",
        "/archive/",
        "/archive/index.html",
        "/daily/archive",
        "/daily/archive/",
        "/daily/archive/index.html",
        f"/daily/archive/{args.edition_date}/",
        "/AGENTS.md",
        "/MEMORY.md",
        "/ERRORS.md",
        "/automation/HERMES_DAILY.md",
        "/scripts/build_daily.py",
        "/tests/test_build_daily.py",
        f"/data/editions/{args.edition_date}.json",
        f"/data/candidates/{args.edition_date}.json",
        "/definitely-removed-route",
    ]
    for edition_path in sorted((args.root / "data" / "editions").glob("*.json")):
        edition_date = edition_path.stem
        removed.extend([
            f"/archive/{edition_date}",
            f"/archive/{edition_date}/",
            f"/archive/{edition_date}/index.html",
            f"/daily/archive/{edition_date}",
            f"/daily/archive/{edition_date}/",
            f"/daily/archive/{edition_date}/index.html",
            f"/data/editions/{edition_date}.json",
        ])
    for path in removed:
        for method in ("GET", "HEAD"):
            status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}", method=method)
            if status != 404 or (method == "HEAD" and body):
                failures.append(f"{method} {path}: expected empty 404, got {status} and {len(body)} bytes")

    metadata = {
        "/robots.txt": (args.root / "robots.txt").read_bytes(),
        "/sitemap.xml": (args.root / "sitemap.xml").read_bytes(),
    }
    for path, expected in metadata.items():
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}")
        if status != 200 or body != expected:
            failures.append(f"{path}: expected exact 200 body, got {status} and {len(body)} bytes")

    if failures:
        print("\n".join(failures))
        return 1
    print(f"verified_feed_only date={args.edition_date} commit={args.commit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
