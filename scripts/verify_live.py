#!/usr/bin/env python3
"""Verify the complete public route contract for feed-only inish.in.

The canonical feeds (latest.json and feed.xml) are additionally compared whole
against the accepted local edition, so a stale or mismatched live hostname
fails with the observed date and story mismatch instead of a generic byte diff.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import xml.etree.ElementTree as ET
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


def json_feed_mismatch(local: bytes, live: bytes) -> str | None:
    """Compare the complete canonical JSON feed against the accepted edition.

    Returns None when the live edition is exactly the accepted edition, or a
    specific failure line naming the observed date and story count when live
    delivery has gone stale. A stale hostname is a failure here, never a reason
    to overwrite the last accepted edition.
    """
    try:
        expected = json.loads(local)
        observed = json.loads(live)
    except json.JSONDecodeError:
        return "live_feed_parity /latest.json: live body is not valid JSON"
    if expected == observed:
        return None
    expected_stories = expected.get("stories")
    observed_stories = observed.get("stories")
    if not isinstance(expected_stories, list) or not isinstance(observed_stories, list):
        return (
            "live_feed_parity /latest.json: live body is not a complete edition "
            f"(expected date={expected.get('date')!r} stories={expected_stories!r}, "
            f"observed date={observed.get('date')!r} stories={observed_stories!r})"
        )
    if (expected.get("date"), len(expected_stories)) != (observed.get("date"), len(observed_stories)):
        return (
            "live_feed_parity: expected edition "
            f"{expected.get('date')} with {len(expected_stories)} stories, "
            f"live serves {observed.get('date')} with {len(observed_stories)} stories"
        )
    expected_urls = [story.get("url") for story in expected_stories]
    observed_urls = [story.get("url") for story in observed_stories]
    return (
        "live_feed_parity /latest.json: live edition carries the accepted date and "
        "story count but differs in content "
        f"(expected urls {expected_urls!r}, live urls {observed_urls!r})"
    )


def rss_item(body: bytes) -> tuple[str, str, str, str, str]:
    """(title, guid, link, pubDate, description) of the single channel item."""
    root = ET.fromstring(body)
    item = root.find("./channel/item")
    if item is None:
        raise ValueError("missing <item>")
    identity = []
    for tag in ("title", "guid", "link", "pubDate", "description"):
        element = item.find(tag)
        if element is None or element.text is None:
            raise ValueError(f"missing <{tag}>")
        identity.append(element.text)
    return tuple(identity)  # type: ignore[return-value]


def rss_feed_mismatch(local: bytes, live: bytes) -> str | None:
    """Compare the complete canonical RSS feed against the accepted edition.

    Returns None when the live item is exactly the accepted item, or a specific
    failure line naming the observed guid when live delivery is stale.
    """
    try:
        expected = rss_item(local)
        observed = rss_item(live)
    except (ET.ParseError, ValueError) as error:
        return f"live_feed_parity /feed.xml: feed is not a valid single-item RSS ({error})"
    if expected == observed:
        return None
    if expected[1] != observed[1]:
        return f"live_feed_parity: expected RSS item {expected[1]}, live serves {observed[1]}"
    return (
        "live_feed_parity /feed.xml: RSS item carries the accepted guid but "
        "differs in content; refusing to call a mismatched feed live"
    )


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

    # The public route contract has one source of truth: public-paths.json,
    # which the deploy payload ships beside worker.js. The edge allowlist and
    # this verifier both read it, so adding a public path is a single data
    # edit instead of a multi-file contract change. A snapshot without the
    # file is a loud failure, never a silent narrower check.
    try:
        route_contract = json.loads((args.root / "public-paths.json").read_text())
    except (OSError, json.JSONDecodeError) as error:
        failures.append(f"public-paths.json: cannot load the route contract from the snapshot ({error})")
        route_contract = {}
    public_paths = set(route_contract.get("publicPaths", []))

    # A missing font file fails silently in the browser: the page still renders,
    # just in whatever face the visitor's OS happens to own. Verify the bytes.
    # The OFL license text the shipped stylesheets reference is just as silent
    # when dropped, so it is byte-checked alongside the faces (it is allowlisted
    # in public-paths.json, so it reaches the checks below as a public path).
    fonts = {
        f"/fonts/{path.name}": f"fonts/{path.name}"
        for path in sorted((args.root / "fonts").glob("*.woff2"))
    }
    if not fonts:
        failures.append("fonts: no woff2 files found to verify")

    # Every public path must answer with the exact snapshot bytes: the identity
    # assets referenced by the generated head (the social share card and the
    # iOS touch icon) are staged by deploy_daily.sh and allowed through the
    # worker allowlist, but nothing verified they actually reached the live
    # hostname; a deploy that dropped them again would have passed verification.
    byte_checks = {"/": "index.html"}
    for path in sorted(public_paths - {"/"}):
        byte_checks[path] = path.lstrip("/")
    byte_checks.update(fonts)
    for path, relative in byte_checks.items():
        expected_path = args.root / relative
        if not expected_path.is_file():
            failures.append(f"{path}: snapshot lacks {relative} named by the route contract")
            continue
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}")
        expected = expected_path.read_bytes()
        if path == "/":
            body = without_cloudflare_beacon(body)
        if status != 200 or body != expected:
            failures.append(f"{path}: expected exact 200 body, got {status} and {len(body)} bytes")

    for path in sorted(public_paths | set(fonts)):
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}", method="HEAD")
        if status != 200 or body:
            failures.append(f"HEAD {path}: expected empty 200, got {status} and {len(body)} bytes")

    # Complete canonical feed parity: both feeds must agree with the accepted
    # local edition as data, not just as bytes, so a stale live hostname fails
    # with the observed date/story mismatch and a named stage.
    for path, relative in (("/latest.json", "latest.json"), ("/feed.xml", "feed.xml")):
        status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}")
        if status != 200:
            failures.append(f"live_feed_parity {path}: expected 200, got {status}")
            continue
        expected = (args.root / relative).read_bytes()
        mismatch = json_feed_mismatch(expected, body) if relative == "latest.json" else rss_feed_mismatch(expected, body)
        if mismatch is not None:
            failures.append(mismatch)

    redirects = dict(route_contract.get("redirects", {}))
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
        # The 404 asset itself is internal to the edge (worker.js and the Pages
        # middleware serve it through the ASSETS binding); a public request for
        # it must get the same denied branded 404 as any other unknown path.
        "/404.html",
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
    # The branded 404 page is a public promise a status code alone cannot see:
    # if the edge's ASSETS fallback ever takes over (the plain "Not found"
    # response in worker.js / functions/_middleware.js), every removed route
    # still answers 404 and verification would stay green while visitors lose
    # the error desk. Byte-check the GET body against the snapshot's 404.html
    # (beacon-stripped like the root page); HEAD stays bodyless by contract.
    try:
        branded_404 = (args.root / "404.html").read_bytes()
    except FileNotFoundError:
        failures.append("404.html: snapshot lacks the branded 404 page; cannot verify the error desk")
        branded_404 = None
    for path in removed:
        for method in ("GET", "HEAD"):
            status, body, _ = fetch(args.base, f"{path}?deploy={cache_token}", method=method)
            if method == "GET":
                if branded_404 is not None and status == 404 and without_cloudflare_beacon(body) == branded_404:
                    continue
                failures.append(
                    f"GET {path}: expected the branded 404 page, got {status} and {len(body)} bytes"
                )
            elif status != 404 or body:
                failures.append(f"HEAD {path}: expected empty 404, got {status} and {len(body)} bytes")

    # The public metadata files are byte-checked above as ordinary public
    # paths (they are allowlisted in public-paths.json), so no separate check
    # is needed here.

    if failures:
        print("\n".join(failures))
        return 1
    print(f"verified_feed_only date={args.edition_date} commit={args.commit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
