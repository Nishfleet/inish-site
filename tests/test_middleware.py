import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIDDLEWARE = ROOT / "functions" / "_middleware.js"
WORKER = ROOT / "worker.js"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"
CONTRACT = ROOT / "public-paths.json"
REDIRECTS_FILE = ROOT / "_redirects"
PAGE_404 = ROOT / "404.html"

# Cloudflare runs functions/_middleware.js as an ES module, so there is no local
# Pages runtime to import it into; the documented verification for the file is
# static (see docs/plans/2026-06-18-001-feat-agent-surface-plan.md). The public
# route contract has ONE source of truth — public-paths.json — and both edge
# implementations read it. These tests load that file directly and evaluate the
# middleware's exact deny rule against it, so adding a public path is a single
# data edit plus the file on the deploy copy line; it must not require editing
# this suite.

# The deny branch must stay anchored to these two checks; a catch-all or a
# widened allowlist is exactly the regression this suite exists to catch.
DENY_BRANCH = "!publicPaths.has(url.pathname) && !fontPath.test(url.pathname)"


def _source():
    text = MIDDLEWARE.read_text()
    assert "new Response(\"Not found\"" in text, "404 branch missing from middleware"
    assert "status: 404" in text, "404 status missing from middleware"
    assert DENY_BRANCH in text, "deny branch changed; update this suite deliberately"
    return text


def _load_contract():
    return json.loads(CONTRACT.read_text())


def _payload_root_files():
    """The root files on deploy_daily.sh's payload copy line (minus the
    edge-internal 404.html/_redirects), each mapped to its public path."""
    script = DEPLOY_SCRIPT.read_text().replace("\\\n", " ")
    matches = list(re.finditer(r'cp (\"\$SNAPSHOT_ROOT/[A-Za-z0-9._-]+\"\s+)+\"\$PUBLIC_DIR/\"', script))
    if len(matches) != 1:
        raise AssertionError(
            f"expected exactly one root-file cp line in {DEPLOY_SCRIPT.name}, found {len(matches)}"
        )
    return re.findall(r'\"\$SNAPSHOT_ROOT/([A-Za-z0-9._-]+)\"', matches[0].group(0))


def _deployed_public_surface():
    """The public surface the deploy payload ships: "/" for index.html, every
    other root file on the copy line except the edge-internal 404.html and
    _redirects, plus the OFL license text that rides inside the fonts/
    directory copy."""
    paths = {"/"}
    for name in _payload_root_files():
        if name in ("404.html", "_redirects"):
            continue
        paths.add("/" if name == "index.html" else f"/{name}")
    paths.add("/fonts/OFL.txt")
    return paths


def _redirects_file_map():
    """The redirect map carried by the static _redirects artifact, which must
    mirror the edge contract (the Pages path is no longer deployed, so this is
    the only independent copy of the redirect list)."""
    result = {}
    for line in REDIRECTS_FILE.read_text().splitlines():
        source, target, code = line.split()
        assert code == "301", f"unexpected redirect code in {REDIRECTS_FILE.name}: {line}"
        result[source] = target
    return result


class MiddlewareContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        text = _source()
        cls.contract = _load_contract()
        cls.public_paths = set(cls.contract["publicPaths"])
        cls.redirects = dict(cls.contract["redirects"])
        cls.font_path = re.compile(cls.contract["fontPath"])

    def middleware_status(self, path):
        """The middleware's decision for a pathname, using the contract it ships."""
        if path in self.redirects:
            return 301
        if path in self.public_paths or self.font_path.fullmatch(path):
            return "static"
        return 404

    def test_root_metadata_assets_are_allowlisted(self):
        for asset in ("/og-image.svg", "/apple-touch-icon.png"):
            self.assertIn(asset, self.public_paths)

    def test_allowlist_is_exactly_the_deployed_surface(self):
        # Exact equality is the narrowness guard, anchored on real artifacts
        # instead of a literal: the allowlist must be exactly the public files
        # the deploy payload ships — the root files on deploy_daily.sh's copy
        # line (minus the edge-internal 404.html/_redirects) plus the license
        # text that ships inside fonts/. A path addition needs the data edit
        # and the file on the copy line, never a test edit.
        self.assertEqual(self.public_paths, _deployed_public_surface())

    def test_every_public_path_names_a_real_file(self):
        for path in self.public_paths:
            if path == "/":
                continue
            self.assertTrue(
                (ROOT / path.lstrip("/")).is_file(),
                f"public path names a missing file: {path}",
            )

    def test_feed_paths_are_static_and_redirects_match_the_pages_file(self):
        for feed in ("/", "/latest.json", "/feed.xml", "/robots.txt", "/sitemap.xml", "/app.js", "/styles.css"):
            self.assertEqual(self.middleware_status(feed), "static")
        # The edge contract and the static _redirects artifact must agree
        # exactly; either one drifting alone is a contract break.
        self.assertEqual(self.redirects, _redirects_file_map())

    def test_metadata_assets_reach_static_layer_and_arbitrary_paths_stay_404(self):
        cases = {
            "/og-image.svg": "static",
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
                # The route data comes from the one source of truth, never from
                # inline literals in the edge files.
                self.assertIn("public-paths.json", source)
                self.assertNotIn("new Set([", source)
                self.assertNotIn("new Map([", source)

        # The allowlist is exactly the deployed public surface and the deny
        # surface still 404s; the 404 asset itself stays internal.
        self.assertEqual(self.public_paths, _deployed_public_surface())
        self.assertEqual(self.redirects, _redirects_file_map())
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
