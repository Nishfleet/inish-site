import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "route-contract.js"
MIDDLEWARE = ROOT / "functions" / "_middleware.js"
WORKER = ROOT / "worker.js"
PAGE_404 = ROOT / "404.html"

# Cloudflare runs functions/_middleware.js as an ES module, so there is no local
# Pages runtime to import it into; the documented verification for the file is
# static (see docs/plans/2026-06-18-001-feat-agent-surface-plan.md). These tests
# follow the DeployScriptContractTests pattern: they extract the allowlist, font
# pattern, and redirect map straight from the shared route-contract.js — the one
# source of truth both edges import — and evaluate the middleware's exact deny
# rule against them. If a file's shape drifts from the extractors, the tests
# fail loudly instead of silently checking something else.

# The deny branch must stay anchored to these two checks; a catch-all or a
# widened allowlist is exactly the regression this suite exists to catch.
DENY_BRANCH = "!publicPaths.has(url.pathname) && !fontPath.test(url.pathname)"


def _middleware_source():
    text = MIDDLEWARE.read_text()
    assert "new Response(\"Not found\"" in text, "404 branch missing from middleware"
    assert "status: 404" in text, "404 status missing from middleware"
    assert DENY_BRANCH in text, "deny branch changed; update this suite deliberately"
    return text


def _contract_source():
    text = CONTRACT.read_text()
    assert 'export const publicPaths = new Set([' in text, "allowlist missing from route-contract.js"
    assert "export const redirects = new Map([" in text, "redirects missing from route-contract.js"
    return text


def _extract_set(text, name):
    match = re.search(rf"{name}\s*=\s*new Set\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Set in {CONTRACT.name}"
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def _extract_map(text, name):
    match = re.search(rf"{name}\s*=\s*new Map\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Map in {CONTRACT.name}"
    pairs = re.findall(r'\["([^"]+)",\s*"([^"]+)"\]', match.group(1))
    return dict(pairs)


def _extract_font_pattern(text):
    match = re.search(r"fontPath\s*=\s*/(.*?)/;", text, re.S)
    assert match, f"could not find the fontPath pattern in {CONTRACT.name}"
    # The JS regex is already anchored (^...$) and uses only constructs that
    # mean the same thing in Python re.
    return re.compile(match.group(1))


class MiddlewareContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract_text = _contract_source()
        cls.middleware_text = _middleware_source()
        cls.public_paths = _extract_set(cls.contract_text, "publicPaths")
        cls.redirects = _extract_map(cls.contract_text, "redirects")
        cls.font_path = _extract_font_pattern(cls.contract_text)

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

    def test_allowlist_names_only_real_root_files(self):
        # The narrowness guard, now structural: every allowlisted path except
        # "/" must name a file that actually exists at the repo root, so a
        # phantom or typo'd path (or an archive sneaking into the surface)
        # fails loudly. Adding a real public path cannot break this test.
        for path in self.public_paths:
            with self.subTest(path=path):
                if path != "/":
                    self.assertTrue(
                        (ROOT / path.lstrip("/")).is_file(),
                        f"allowlisted path {path} has no root file",
                    )

    def test_edges_import_the_contract_and_define_no_literals(self):
        # The single-source-of-truth rule: both edges must import the shared
        # contract and never re-declare their own literals, or a path added in
        # one edge but not the other would silently split the public surface.
        for name, source, import_needle in (
            ("worker.js", WORKER.read_text(), 'from "./route-contract.js"'),
            ("_middleware.js", self.middleware_text, 'from "../route-contract.js"'),
        ):
            with self.subTest(edge=name):
                self.assertIn(import_needle, source)
                self.assertNotIn("const publicPaths = new Set", source)
                self.assertNotIn("const redirects = new Map", source)
                self.assertNotIn("const hstsHeader =", source)
                self.assertNotIn("const fontPath =", source)

    def test_feed_paths_stay_static_and_legacy_links_redirect(self):
        for feed in ("/", "/latest.json", "/feed.xml", "/robots.txt", "/sitemap.xml", "/app.js", "/styles.css"):
            with self.subTest(feed=feed):
                self.assertEqual(self.middleware_status(feed), "static")
        for legacy in (
            "/index.html",
            "/daily",
            "/daily/",
            "/daily/index.html",
            "/daily/app.js",
            "/daily/styles.css",
            "/daily/latest.json",
            "/daily/feed.xml",
            "/daily/sitemap.xml",
        ):
            with self.subTest(legacy=legacy):
                self.assertEqual(self.middleware_status(legacy), 301)

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

    def test_unknown_paths_serve_branded_status_preserving_404(self):
        # Unknown paths keep HTTP 404 but must serve the deployed branded page
        # (404.html) through the ASSETS binding — streamed, never buffered —
        # in both edge implementations, with the deny branch exactly as it
        # was. The 404 asset stays internal: it is not a new public path and
        # direct /404.html access stays denied. The allowlist and redirects
        # are no longer hard-coded here — they come from route-contract.js,
        # so adding a public path cannot fail this contract test.
        worker_text = WORKER.read_text()
        page_text = PAGE_404.read_text()

        for name, source in (("worker.js", worker_text), ("_middleware.js", self.middleware_text)):
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

        # The 404 asset stays internal: not allowlisted, no redirect, and the
        # deny surface still 404s.
        self.assertNotIn("/404.html", self.public_paths)
        self.assertNotIn("/404.html", self.redirects)
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
