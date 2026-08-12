import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIDDLEWARE = ROOT / "functions" / "_middleware.js"
WORKER = ROOT / "worker.js"
PAGE_404 = ROOT / "404.html"

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
        for asset in ("/og-image.svg", "/og-image.png", "/apple-touch-icon.png"):
            self.assertIn(asset, self.public_paths)

    def test_allowlist_is_exactly_the_known_surface(self):
        # Exact equality is the narrowness guard: the raster share card, its
        # legacy SVG source, the touch icon, and the font license text are all
        # present and nothing else was slipped in.
        self.assertEqual(
            self.public_paths,
            {
                "/",
                "/app.js",
                "/styles.css",
                "/apple-touch-icon.png",
                "/og-image.svg",
                "/og-image.png",
                "/latest.json",
                "/feed.xml",
                "/robots.txt",
                "/sitemap.xml",
                "/fonts/OFL.txt",
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
            "/og-image.png": "static",
            "/apple-touch-icon.png": "static",
            "/fonts/archivo-700.woff2": "static",
            "/fonts/OFL.txt": "static",
            "/archive": 404,
            "/admin": 404,
            "/secrets.json": 404,
            "/og-image.jpg": 404,
            "/apple-touch-icon.ico": 404,
            "/fonts/nope.ttf": 404,
            "/fonts/nope.woff2/": 404,
            "/fonts/OFL.md": 404,
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

    def test_unknown_paths_serve_branded_status_preserving_404(self):
        # Unknown paths keep HTTP 404 but must serve the deployed branded page
        # (404.html) through the ASSETS binding — streamed, never buffered —
        # in both edge implementations, with the allowlist, redirects, and
        # deny branch exactly as they were. The 404 asset stays internal: it
        # is not a new public path and direct /404.html access stays denied.
        worker_text = WORKER.read_text()
        middleware_text = _source()
        page_text = PAGE_404.read_text()

        for name, source in (("worker.js", worker_text), ("_middleware.js", middleware_text)):
            with self.subTest(edge=name):
                self.assertIn(DENY_BRANCH, source, "deny branch changed")
                self.assertIn('env.ASSETS.fetch("https://inish.in/404.html")', source)
                self.assertIn("status: 404", source)
                self.assertIn('"Cache-Control": "no-store"', source)
                self.assertIn('"Content-Type": "text/html; charset=utf-8"', source)
                # Stream the asset body; the edge must not buffer it.
                self.assertIn("new Response(asset.body", source)
                self.assertNotIn(".text()", source)
                self.assertNotIn(".arrayBuffer()", source)
                # HEAD stays bodyless; a failed asset fetch falls back safely.
                self.assertIn('request.method === "HEAD"', source)
                self.assertIn("new Response(null", source)
                self.assertIn('new Response("Not found"', source)

        # Allowlist keeps only the known surface plus the OFL license text the
        # shipped stylesheet references; no new redirect, the deny surface still
        # 404s, and the 404 asset itself stays internal.
        self.assertEqual(
            self.public_paths,
            {
                "/",
                "/app.js",
                "/styles.css",
                "/apple-touch-icon.png",
                "/og-image.svg",
                "/og-image.png",
                "/latest.json",
                "/feed.xml",
                "/robots.txt",
                "/sitemap.xml",
                "/fonts/OFL.txt",
            },
        )
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
        for path in ("/404.html", "/admin", "/secrets.json", "/daily/2026-08-09"):
            with self.subTest(denied=path):
                self.assertEqual(self.middleware_status(path), 404)

        # The branded page contract: honest title, one h1, a way back to the
        # front page, the shared stylesheet, the desktop icon declaration that
        # matches the generated head (so no default /favicon.ico request is
        # issued against the 404 surface), and no scripts.
        self.assertIn("<title>Not found", page_text)
        self.assertEqual(page_text.count("<h1>"), 1)
        self.assertIn('href="/"', page_text)
        self.assertIn('href="/styles.css"', page_text)
        self.assertIn('<link rel="icon" type="image/png" href="/apple-touch-icon.png">', page_text)
        self.assertNotIn("<script", page_text)


if __name__ == "__main__":
    unittest.main()
