import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# The route contract moved to functions/policy.js so the deny branch can be
# imported and exercised by real tests; the middleware is now a thin entrypoint
# that imports from it. POINT-OF-UPDATE: when the policy shape changes, this
# file and tests/test_middleware_deny.test.mjs change together.
POLICY = ROOT / "functions" / "policy.js"
MIDDLEWARE = ROOT / "functions" / "_middleware.js"
WORKER = ROOT / "worker.js"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"
CONTRACT = ROOT / "public-paths.json"
REDIRECTS_FILE = ROOT / "_redirects"
PAGE_404 = ROOT / "404.html"

# Cloudflare runs functions/_middleware.js as an ES module, so there is no local
<<<<<<< HEAD
# Pages runtime to import it into; the documented verification for the file is
# static (see docs/plans/2026-06-18-001-feat-agent-surface-plan.md). The public
# route contract has ONE source of truth — public-paths.json — and both edge
# implementations read it. These tests load that file directly and evaluate the
# middleware's exact deny rule against it, so adding a public path is a single
# data edit plus the file on the deploy copy line; it must not require editing
# this suite.
=======
# Pages runtime to import it into. tests/test_middleware_deny.test.mjs is the
# executable proof of the deny property against the imported policy; this file
# stays the cross-source contract guard, now reading the policy module as the
# canonical source and the middleware as the thin entrypoint that consumes it.
>>>>>>> origin/main

# The deny branch must stay anchored to these two checks; a catch-all or a
# widened allowlist is exactly the regression this suite exists to catch. The
# focused JS run also pins this property against the imported function, so
# mutating the source (e.g. with `false &&`) makes both suites red.
#
# The policy module's decide(pathname) takes the path as a parameter, so its
# deny form is `pathname`. Both edge implementations now import that decision
# rather than inlining their own deny check.
DENY_BRANCH_POLICY = "!publicPaths.has(pathname) && !fontPath.test(pathname)"


def _policy_source():
    text = POLICY.read_text()
    assert DENY_BRANCH_POLICY in text, "deny branch changed in policy.js; update this suite deliberately"
    return text


def _middleware_source():
    text = MIDDLEWARE.read_text()
    assert "new Response(\"Not found\"" in text, "404 branch missing from middleware"
    assert "status: 404" in text, "404 status missing from middleware"
    # The middleware must import its decision from the policy module rather than
    # re-implementing it; drift here is the same kind of regression.
    assert "from \"./policy.js\"" in text, "middleware must import its decision from policy.js"
    assert "decide(" in text, "middleware must call decide() rather than re-implement the rule"
    # The canonical host/scheme redirect lives in policy.js too; both edges
    # must import it so a regression that drops the canonical check is
    # visible from this single file rather than per-edge.
    assert "canonicalize(" in text, "middleware must call canonicalize() before decide()"
    return text


<<<<<<< HEAD
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
=======
def _extract_set(text, name):
    match = re.search(rf"{name}\s*=\s*new Set\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Set in {POLICY.name}"
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def _extract_map(text, name):
    match = re.search(rf"{name}\s*=\s*new Map\(\[(.*?)\]\);", text, re.S)
    assert match, f"could not find the {name} Map in {POLICY.name}"
    pairs = re.findall(r'\["([^"]+)",\s*"([^"]+)"\]', match.group(1))
    return dict(pairs)


def _extract_font_pattern(text):
    match = re.search(r"fontPath\s*=\s*/(.*?)/;", text, re.S)
    assert match, f"could not find the fontPath pattern in {POLICY.name}"
    # The JS regex is already anchored (^...$) and uses only constructs that
    # mean the same thing in Python re.
    return re.compile(match.group(1))
>>>>>>> origin/main


def _extract_canonical_origin(text):
    # The export is a single string literal; the narrowness of this regex
    # keeps any future policy edit from silently widening the surface the
    # site serves from.
    match = re.search(r'canonicalOrigin\s*=\s*"([^"]+)"', text)
    assert match, f"could not find the canonicalOrigin string in {POLICY.name}"
    return match.group(1)


class MiddlewareContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
<<<<<<< HEAD
        text = _source()
        cls.contract = _load_contract()
        cls.public_paths = set(cls.contract["publicPaths"])
        cls.redirects = dict(cls.contract["redirects"])
        cls.font_path = re.compile(cls.contract["fontPath"])
=======
        cls.policy_text = _policy_source()
        cls.middleware_text = _middleware_source()
        cls.public_paths = _extract_set(cls.policy_text, "publicPaths")
        cls.redirects = _extract_map(cls.policy_text, "redirects")
        cls.font_path = _extract_font_pattern(cls.policy_text)
        cls.canonical_origin = _extract_canonical_origin(cls.policy_text)
>>>>>>> origin/main

    def middleware_status(self, path):
        """The middleware's decision for a pathname, using the contract it ships."""
        if path in self.redirects:
            return 301
        if path in self.public_paths or self.font_path.fullmatch(path):
            return "static"
        return 404

    def test_root_metadata_assets_are_allowlisted(self):
        for asset in ("/og-image.svg", "/og-image.png", "/apple-touch-icon.png"):
            self.assertIn(asset, self.public_paths)

<<<<<<< HEAD
    def test_allowlist_is_exactly_the_deployed_surface(self):
        # Exact equality is the narrowness guard, anchored on real artifacts
        # instead of a literal: the allowlist must be exactly the public files
        # the deploy payload ships — the root files on deploy_daily.sh's copy
        # line (minus the edge-internal 404.html/_redirects) plus the license
        # text that ships inside fonts/. A path addition needs the data edit
        # and the file on the copy line, never a test edit.
        self.assertEqual(self.public_paths, _deployed_public_surface())
=======
    def test_allowlist_is_exactly_the_known_surface(self):
        # Exact equality is the narrowness guard: both metadata assets and the
        # font license text are present and nothing else was slipped in.
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
>>>>>>> origin/main

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

    def test_canonical_origin_is_bare_apex_https(self):
        # The single source of truth for the canonical host/scheme is the
        # canonicalOrigin export in policy.js. Pinning it here means a drift
        # (adding www., dropping the scheme, switching to http) makes this
        # suite red and the worker redirect goes to the wrong place. The
        # exact-string form (https:// + bare host + trailing slash) is
        # checked by the behavioral suite in test_middleware_deny.test.mjs.
        self.assertEqual(self.canonical_origin, "https://inish.in/")

    def test_unknown_paths_serve_branded_status_preserving_404(self):
        # Unknown paths keep HTTP 404 but must serve the deployed branded page
        # (404.html) through the ASSETS binding — streamed, never buffered —
        # in both edge implementations, with the allowlist, redirects, and
        # deny branch exactly as they were. The 404 asset stays internal: it
        # is not a new public path and direct /404.html access stays denied.
        worker_text = WORKER.read_text()
        middleware_text = self.middleware_text
        page_text = PAGE_404.read_text()

        # The route contract now lives in the policy module; the middleware
        # entrypoint and the worker must keep mirroring it. The policy module
        # is the canonical source of the deny branch — no 404 plumbing or
        # HSTS header lives there, so the cross-source check is split.
        for name, source in (("worker.js", worker_text), ("_middleware.js", middleware_text)):
            with self.subTest(edge=name):
                self.assertIn("max-age=31536000; includeSubDomains", source)
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

<<<<<<< HEAD
        # The allowlist is exactly the deployed public surface and the deny
        # surface still 404s; the 404 asset itself stays internal.
        self.assertEqual(self.public_paths, _deployed_public_surface())
        self.assertEqual(self.redirects, _redirects_file_map())
=======
        # The Pages middleware must delegate the decision to the policy module
        # rather than re-implementing it; drift here is the same kind of
        # regression as a widened allowlist. The Worker must do the same: it
        # imports the decision and never re-declares its own allowlist, so a
        # path addition is a single edit in the policy module.
        self.assertIn("from \"./policy.js\"", middleware_text)
        self.assertIn("decide(", middleware_text)
        self.assertIn("canonicalize(", middleware_text)
        self.assertIn("from \"./functions/policy.js\"", worker_text)
        self.assertIn("decide(", worker_text)
        self.assertIn("canonicalize(", worker_text)
        self.assertNotIn("const publicPaths = new Set", worker_text)
        self.assertNotIn("const redirects = new Map", worker_text)
        self.assertNotIn("const fontPath =", worker_text)
        # The canonical host/scheme rewrite lives in policy.js too; the worker
        # and the Pages middleware must import it rather than inlining their
        # own host checks. Drift here is the same kind of regression as a
        # re-implemented deny branch.
        self.assertNotIn('hostname === "inish.in"', worker_text)
        self.assertNotIn('hostname === "inish.in"', middleware_text)
        self.assertNotIn('protocol === "https:"', worker_text)
        self.assertNotIn('protocol === "https:"', middleware_text)

        # The policy module is the canonical source of the deny branch, and
        # both edges must import the decision from it so a mutation is visible
        # at the same place the test reads.
        self.assertIn(DENY_BRANCH_POLICY, self.policy_text)
        # The Pages middleware now imports the decision; its deny branch is
        # the imported call, not the raw expression — assert the import.
        self.assertNotIn(DENY_BRANCH_POLICY, middleware_text)

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
>>>>>>> origin/main
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
