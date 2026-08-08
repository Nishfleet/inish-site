import io
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import scripts.verify_live as verifier
from scripts.verify_live import json_feed_mismatch, rss_feed_mismatch, without_cloudflare_beacon


def edition_payload(date="2026-08-08", stories=7):
    """A complete edition fixture; verify_live compares feeds whole, so field
    detail only needs to be valid JSON."""
    return {
        "date": date,
        "candidate_count": 243,
        "editor_note": "A fixture edition with enough words to stand in for the accepted one.",
        "stories": [
            {
                "title": f"Fixture story {index}",
                "url": f"https://example.com/story-{index}",
                "source": "Example",
                "section": "AI",
                "summary": "Fixture summaries carry a checkable number and nothing else.",
                "fact": f"Fixture fact: 1.{index} seconds on the reference run.",
                "take": f"I would measure fixture story {index} myself before trusting it.",
                "caveat": "This is fixture copy; nothing here actually ran anywhere.",
            }
            for index in range(stories)
        ],
    }


def rss_payload(date="2026-08-08"):
    note = "A fixture edition with enough words to stand in for the accepted one."
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"><channel><title>Nish\'s Daily Reads</title>'
        "<link>https://inish.in/</link>"
        "<description>A daily read for a founder: AI, product ideas, and demand signals.</description>"
        f"<item><title>Nish's Daily Reads — {date}</title><link>https://inish.in/</link>"
        f'<guid isPermaLink="false">inish-daily-{date}</guid>'
        "<pubDate>Sat, 08 Aug 2026 00:00:00 +0000</pubDate>"
        f"<description>{note}</description></item>"
        "</channel></rss>\n"
    )


def index_payload(date="2026-08-08"):
    return f"<!doctype html><html><head><title>Nish's Daily Reads — {date}</title></head><body>fixture</body></html>\n"


SITEMAP = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    "<url><loc>https://inish.in/</loc></url></urlset>\n"
)


class VerifyLiveTests(unittest.TestCase):
    def test_removes_one_cloudflare_analytics_beacon(self):
        original = b"<html>\n<body>\n<p>feed</p>\n</body>\n</html>\n"
        beacon = (
            b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123" '
            b'integrity="sha512-YWJjZA==" data-cf-beacon=\'{"token":"public"}\' crossorigin="anonymous"></script>\n'
        )
        live = original.replace(b"</body>", beacon + b"</body>")
        self.assertEqual(without_cloudflare_beacon(live), original)

    def test_leaves_other_scripts_untouched(self):
        body = b'<script src="https://example.com/app.js"></script>\n'
        self.assertEqual(without_cloudflare_beacon(body), body)

    def test_does_not_hide_malformed_beacon_content(self):
        body = (
            b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123">'
            b"<p>unexpected content</p></script>\n"
        )
        self.assertEqual(without_cloudflare_beacon(body), body)


class FeedParityTests(unittest.TestCase):
    def test_json_parity_accepts_an_identical_edition(self):
        payload = json.dumps(edition_payload(), indent=2).encode()
        self.assertIsNone(json_feed_mismatch(payload, payload))

    def test_json_parity_reports_stale_date_and_story_count(self):
        local = json.dumps(edition_payload("2026-08-08", 7)).encode()
        live = json.dumps(edition_payload("2026-08-06", 5)).encode()
        mismatch = json_feed_mismatch(local, live)
        self.assertIsNotNone(mismatch)
        self.assertIn("2026-08-08", mismatch)
        self.assertIn("7 stories", mismatch)
        self.assertIn("2026-08-06", mismatch)
        self.assertIn("5 stories", mismatch)

    def test_json_parity_reports_same_date_different_content(self):
        local = json.dumps(edition_payload("2026-08-08", 3)).encode()
        live_edition = edition_payload("2026-08-08", 3)
        live_edition["stories"][0]["url"] = "https://other.example/story"
        live = json.dumps(live_edition).encode()
        mismatch = json_feed_mismatch(local, live)
        self.assertIsNotNone(mismatch)
        self.assertIn("differs in content", mismatch)
        self.assertIn("https://other.example/story", mismatch)

    def test_json_parity_rejects_invalid_live_json(self):
        local = json.dumps(edition_payload()).encode()
        self.assertIn("not valid JSON", json_feed_mismatch(local, b"<html>not json</html>"))

    def test_json_parity_rejects_an_incomplete_live_edition(self):
        local = json.dumps(edition_payload()).encode()
        self.assertIn("not a complete edition", json_feed_mismatch(local, b'{"date": "2026-08-08"}'))

    def test_rss_parity_accepts_an_identical_feed(self):
        feed = rss_payload().encode()
        self.assertIsNone(rss_feed_mismatch(feed, feed))

    def test_rss_parity_reports_stale_guid(self):
        local = rss_payload("2026-08-08").encode()
        live = rss_payload("2026-08-06").encode()
        mismatch = rss_feed_mismatch(local, live)
        self.assertIsNotNone(mismatch)
        self.assertIn("inish-daily-2026-08-08", mismatch)
        self.assertIn("inish-daily-2026-08-06", mismatch)

    def test_rss_parity_reports_same_guid_different_content(self):
        local = rss_payload("2026-08-08").encode()
        live = rss_payload("2026-08-08").replace(
            "A fixture edition with enough words to stand in for the accepted one.",
            "A different editor note that was never accepted.",
        ).encode()
        mismatch = rss_feed_mismatch(local, live)
        self.assertIsNotNone(mismatch)
        self.assertIn("differs in content", mismatch)

    def test_rss_parity_rejects_a_malformed_live_feed(self):
        local = rss_payload().encode()
        self.assertIn("not a valid single-item RSS", rss_feed_mismatch(local, b"<rss><channel>"))


# Mirrors scripts/verify_live.py's redirect contract, so the mock hostname
# behaves like the real one for the route checks that must keep working.
REDIRECTS = {
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


def make_live_server(root: Path, overrides=None):
    """A fake verifier fetch() that serves the fixture root like the live
    hostname would, with optional per-route overrides (e.g. a stale edition)."""
    routes = {}
    for name in ("index.html", "app.js", "styles.css", "latest.json", "feed.xml", "robots.txt", "sitemap.xml"):
        routes[f"/{name}"] = (root / name).read_bytes()
    routes["/"] = routes["/index.html"]
    for font in (root / "fonts").glob("*.woff2"):
        routes[f"/fonts/{font.name}"] = font.read_bytes()
    if overrides:
        routes.update(overrides)

    def fetch(base, path, *, method="GET"):
        route, _, query = path.partition("?")
        if route in REDIRECTS:
            return 301, b"", f"{REDIRECTS[route]}?{query}"
        body = routes.get(route)
        if body is None:
            return 404, b"", None
        return 200, (b"" if method == "HEAD" else body), None

    return fetch


class LiveVerifierTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "fonts").mkdir(parents=True)
        (self.root / "fonts" / "archivo-700.woff2").write_bytes(b"\x00\x01" * 8)
        (self.root / "data" / "editions").mkdir(parents=True)
        self.write_fixtures()

    def tearDown(self):
        self.temp.cleanup()

    def write_fixtures(self, date="2026-08-08", stories=7):
        edition = edition_payload(date, stories)
        (self.root / "index.html").write_text(index_payload(date))
        (self.root / "app.js").write_text("app fixture")
        (self.root / "styles.css").write_text("styles fixture")
        (self.root / "latest.json").write_text(json.dumps(edition) + "\n")
        (self.root / "feed.xml").write_text(rss_payload(date))
        (self.root / "robots.txt").write_text("User-agent: *\nAllow: /\n")
        (self.root / "sitemap.xml").write_text(SITEMAP)
        (self.root / "data" / "editions" / f"{date}.json").write_text(json.dumps(edition))

    def run_verifier(self, overrides=None):
        output = io.StringIO()
        fetch = make_live_server(self.root, overrides)
        argv = [
            "verify_live.py",
            "--root", str(self.root),
            "--edition-date", "2026-08-08",
            "--commit", "c82bb01dead",
        ]
        with (
            patch.object(verifier, "fetch", fetch),
            patch.object(sys, "argv", argv),
            redirect_stdout(output),
        ):
            code = verifier.main()
        return code, output.getvalue()

    def test_fresh_live_edition_passes_exact_parity(self):
        code, output = self.run_verifier()
        self.assertEqual(code, 0)
        self.assertIn("verified_feed_only date=2026-08-08", output)

    def test_stale_live_edition_fails_bounded_with_observed_date_and_story_count(self):
        # A previous accepted edition is still live: the hostname has not caught
        # up. This must fail fast (mocked HTTP, no network or sleeps) with the
        # observed date/story mismatch rather than a generic byte diff.
        stale = {
            "/": index_payload("2026-08-06").encode(),
            "/latest.json": (json.dumps(edition_payload("2026-08-06", 5)) + "\n").encode(),
            "/feed.xml": rss_payload("2026-08-06").encode(),
        }
        code, output = self.run_verifier(stale)
        self.assertNotEqual(code, 0)
        self.assertIn(
            "live_feed_parity: expected edition 2026-08-08 with 7 stories, "
            "live serves 2026-08-06 with 5 stories",
            output,
        )
        self.assertIn(
            "live_feed_parity: expected RSS item inish-daily-2026-08-08, "
            "live serves inish-daily-2026-08-06",
            output,
        )

    def test_zero_story_edition_still_passes_fresh_parity(self):
        self.write_fixtures(stories=0)
        code, output = self.run_verifier()
        self.assertEqual(code, 0)
        self.assertIn("verified_feed_only date=2026-08-08", output)

    def test_unrelated_route_checks_still_enforced_when_feeds_match(self):
        # Feeds are fresh; a route-contract violation must still fail the run,
        # proving the parity guard did not narrow verification to feeds alone.
        code, output = self.run_verifier({"/archive": b"should not exist"})
        self.assertNotEqual(code, 0)
        self.assertIn("GET /archive: expected empty 404", output)
        self.assertNotIn("live_feed_parity", output)


class MiddlewareContractTests(unittest.TestCase):
    """The HSTS regression gate: the Pages middleware must keep serving a
    Strict-Transport-Security header on every response path so the HTTPS-only
    policy cannot silently regress. Source-text contract, like the deploy-script
    tests below, because the suite is stdlib-only and CI has no Node runtime."""

    MIDDLEWARE = Path(__file__).resolve().parents[1] / "functions" / "_middleware.js"

    def test_hsts_set_on_redirect_404_and_passthrough_responses(self):
        source = self.MIDDLEWARE.read_text()
        # Definition plus the three call sites: redirect, 404, and passthrough.
        self.assertEqual(source.count("withSecurityHeaders("), 4)

    def test_redirect_stays_301_with_location_query_and_hsts(self):
        source = self.MIDDLEWARE.read_text()
        self.assertIn("status: 301", source)
        self.assertIn("Location: destination.href", source)
        self.assertIn("destination.search = url.search", source)
        # The redirect is built by hand so its headers stay mutable; the built-in
        # helper returns immutable headers and the runtime 500s when HSTS is
        # attached to them.
        self.assertIn("new Response(null, {", source)

    def test_hsts_value_is_explicit_without_preload(self):
        source = self.MIDDLEWARE.read_text()
        self.assertIn('headers.set("Strict-Transport-Security", hstsHeader)', source)
        header = re.search(r'hstsHeader = "([^"]+)"', source)
        self.assertIsNotNone(header, "HSTS value must be explicit")
        self.assertIn("max-age=31536000", header.group(1))
        self.assertIn("includeSubDomains", header.group(1))
        self.assertNotIn("preload", header.group(1))

    def test_public_allowlist_and_redirect_semantics_kept(self):
        source = self.MIDDLEWARE.read_text()
        self.assertIn("publicPaths", source)
        self.assertIn('["/daily", "/"]', source)
        self.assertIn("status: 404", source)


class DeployScriptContractTests(unittest.TestCase):
    SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "deploy_daily.sh"

    def test_notification_comes_only_after_successful_verification(self):
        script = self.SCRIPT.read_text()
        self.assertEqual(script.count("hermes send"), 1)
        self.assertLess(script.index("scripts/verify_live.py"), script.index("hermes send"))
        self.assertLess(script.index("hermes send"), script.index("verified_live"))

    def test_failure_path_prints_the_specific_stage_and_never_notifies(self):
        script = self.SCRIPT.read_text()
        self.assertIn("Failing stage", script)
        stage_printed = script.index('"$VERIFY_STAGE"')
        self.assertGreater(stage_printed, script.index("done"))
        self.assertGreater(script.index("left untouched"), stage_printed)
        # The only hermes call sits above the failure path, so a failed
        # verification cannot reach it.
        self.assertLess(script.index("hermes send"), script.index("Failing stage"))


if __name__ == "__main__":
    unittest.main()
