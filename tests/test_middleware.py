import re
import unittest
from pathlib import Path

MIDDLEWARE = Path(__file__).resolve().parents[1] / "functions" / "_middleware.js"

# Cloudflare runs functions/_middleware.js as an ES module, so there is no local
# Pages runtime to import it into; the documented verification for the file is
# static (see docs/plans/2026-06-18-001-feat-agent-surface-plan.md). These tests
# follow the DeployScriptContractTests pattern: they extract the allowlist, font
# pattern, and redirect map straight from the source and evaluate the
# middleware's exact deny rule against them. If the file's shape drifts from the
# extractors, the tests fail loudly instead of silently checking something else.

# The deny branch must stay anchored to these two checks; a catch-all or a
# widened allowlist is exactly the regression this suite exists to catch.
DENY_BRANCH = "!publicPaths.has(url.pathname) && !fontPath.test(url.pathname)"


def _source():
    text = MIDDLEWARE.read_text()
    assert "new Response(\"Not found\"" in text, "404 branch missing from middleware"
    assert "status: 404" in text, "404 status missing from middleware"
    assert DENY_BRANCH in text, "deny branch changed; update this suite deliberately"
    return text


def _extract_set(text, name):
    match = re.search(rf"{name}\s*=\s*new Set\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Set in {MIDDLEWARE.name}"
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def _extract_map(text, name):
    match = re.search(rf"{name}\s*=\s*new Map\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Map in {MIDDLEWARE.name}"
    pairs = re.findall(r'\["([^"]+)",\s*"([^"]+)"\]', match.group(1))
    return dict(pairs)


def _extract_font_pattern(text):
    match = re.search(r"fontPath\s*=\s*/(.*?)/;", text, re.S)
    assert match, f"could not find the fontPath pattern in {MIDDLEWARE.name}"
    # The JS regex is already anchored (^...$) and uses only constructs that
    # mean the same thing in Python re.
    return re.compile(match.group(1))


class MiddlewareContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        text = _source()
        cls.public_paths = _extract_set(text, "publicPaths")
        cls.redirects = _extract_map(text, "redirects")
        cls.font_path = _extract_font_pattern(text)

    def middleware_status(self, path):
        """The middleware's decision for a pathname, using the values it ships."""
        if path in self.redirects:
            return 301
        if path in self.public_paths or self.font_path.fullmatch(path):
            return "static"
        return 404

    def test_root_metadata_assets_are_allowlisted(self):
        for asset in ("/og-image.svg", "/apple-touch-icon.png"):
            self.assertIn(asset, self.public_paths)

    def test_allowlist_is_exactly_the_known_surface(self):
        # Exact equality is the narrowness guard: both metadata assets are
        # present and nothing else was slipped in.
        self.assertEqual(
            self.public_paths,
            {
                "/",
                "/app.js",
                "/styles.css",
                "/apple-touch-icon.png",
                "/og-image.svg",
                "/latest.json",
                "/feed.xml",
                "/robots.txt",
                "/sitemap.xml",
            },
        )

    def test_feed_paths_and_redirects_are_unchanged(self):
        self.assertEqual(
            self.redirects,
            {
                "/index.html": "/",
                "/daily": "/",
                "/daily/": "/",
                "/daily/index.html": "/",
                "/daily/app.js": "/app.js",
                "/daily/styles.css": "/styles.css",
                "/daily/latest.json": "/latest.json",
                "/daily/feed.xml": "/feed.xml",
                "/daily/sitemap.xml": "/sitemap.xml",
            },
        )
        for feed in ("/", "/latest.json", "/feed.xml", "/robots.txt", "/sitemap.xml", "/app.js", "/styles.css"):
            self.assertEqual(self.middleware_status(feed), "static")

    def test_metadata_assets_reach_static_layer_and_arbitrary_paths_stay_404(self):
        cases = {
            "/og-image.svg": "static",
            "/apple-touch-icon.png": "static",
            "/fonts/archivo-700.woff2": "static",
            "/archive": 404,
            "/admin": 404,
            "/secrets.json": 404,
            "/og-image.jpg": 404,
            "/apple-touch-icon.ico": 404,
            "/fonts/nope.ttf": 404,
            "/fonts/nope.woff2/": 404,
            "/daily/2026-08-08": 404,
            "/index.html": 301,
            "/daily": 301,
            "/daily/": 301,
            "/daily/latest.json": 301,
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                self.assertEqual(self.middleware_status(path), expected)

    def test_font_restriction_unchanged(self):
        # Narrow pattern only: woff2 from the fonts directory, nothing else.
        self.assertTrue(self.font_path.fullmatch("/fonts/archivo-700.woff2"))
        self.assertIsNone(self.font_path.fullmatch("/fonts/../app.js"))
        self.assertIsNone(self.font_path.fullmatch("/fonts/x.ttf"))
        self.assertIsNone(self.font_path.fullmatch("/fonts/x.woff2.css"))


if __name__ == "__main__":
    unittest.main()
