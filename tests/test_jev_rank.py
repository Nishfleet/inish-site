"""Jev ranking of the candidate pool, exercising canned answers offline."""

import json
import os
import sys
import tempfile
import unittest
import urllib.request
import urllib.error
from copy import deepcopy
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inish_daily import fetch_candidates, jev_rank  # noqa: E402

HERMES = Path(jev_rank.ROOT) / "automation" / "HERMES_DAILY.md"


def response(fit=3.0, confidence=0.8, wildcard=0.4, engineer_only=0.1) -> dict:
    return {
        "model": "jev-latest",
        "answers": {
            "fit": {"score": fit, "confidence": confidence},
            "wildcard": {"noul": wildcard},
            "engineer_only": {"noul": engineer_only},
        },
    }


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://api.typesafe.ai/v1/systemone", code, "boom", {}, None)


class FakeHeaders(dict):
    def get_content_charset(self):
        for part in self.get("Content-Type", "").split(";"):
            part = part.strip()
            if part.lower().startswith("charset="):
                return part.split("=", 1)[1].strip('"')
        return None


class FakeResponse:
    """Just enough of an http.client.HTTPResponse for page_text."""

    def __init__(self, body, content_type="text/html; charset=utf-8"):
        self.body = body if isinstance(body, bytes) else body.encode()
        self.headers = FakeHeaders({"Content-Type": content_type})
        self.read_size = None

    def read(self, size=-1):
        self.read_size = size
        return self.body if size is None or size < 0 else self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False


class RunbookSectionTests(unittest.TestCase):
    def test_reads_the_real_sections_and_stops_at_the_next_heading(self):
        text = HERMES.read_text()
        reader = jev_rank.runbook_section(text, "Who this is for")
        bar = jev_rank.runbook_section(text, "The bar")
        self.assertIn("One reader: Nish", reader)
        self.assertIn("A story earns its place", bar)
        self.assertNotIn("\n## ", reader)
        self.assertNotIn("\n## ", bar)
        self.assertEqual(jev_rank.load_context(), (reader, bar))

    def test_missing_section_raises(self):
        with self.assertRaises(ValueError):
            jev_rank.runbook_section("# Title\n\n## Goal\n\nbody\n", "The bar")


class PageTextTests(unittest.TestCase):
    def call(self, body, content_type="text/html; charset=utf-8", error=None):
        def fetch(request, timeout=20):
            self.assertEqual(request.get_header("User-agent"), fetch_candidates.BROWSER_AGENT)
            self.assertEqual(timeout, 20)
            if error is not None:
                raise error
            return FakeResponse(body, content_type)

        return jev_rank.page_text("https://example.com/a", agent=fetch_candidates.BROWSER_AGENT, fetch=fetch)

    def test_keeps_visible_text_and_drops_code_and_whitespace(self):
        body = (
            "<html><head><style>p{color:red}</style><script>var x=1</script></head>"
            f"<body><p>Hello    there</p> <b>bold</b> {'filler ' * 60}</body></html>"
        )
        text = self.call(body)
        self.assertTrue(text.startswith("Hello there bold"))
        self.assertIn("filler", text)
        self.assertNotIn("var x", text)
        self.assertNotIn("color:red", text)
        self.assertNotIn("  ", text)

    def test_caps_at_page_chars_and_reads_at_most_two_megabytes(self):
        def fetch(request, timeout=20):
            response = FakeResponse("x" * 30000)
            self.response = response
            return response

        text = jev_rank.page_text("https://example.com/a", agent=fetch_candidates.BROWSER_AGENT, fetch=fetch)
        self.assertEqual(len(text), jev_rank.PAGE_CHARS)
        self.assertEqual(self.response.read_size, jev_rank.PAGE_BYTES)

    def test_an_unclosed_menu_does_not_swallow_the_story(self):
        for opener in ("<nav>", "<header>", "<footer>", "<form>"):
            body = f"<html><body>{opener}Home<h1>Story</h1><p>{'story ' * 60}</p></html>"
            text = self.call(body)
            self.assertIn("Story story", text, opener)

    def test_thin_interstitial_is_none(self):
        self.assertIsNone(self.call("<html><body>Google News</body></html>"))

    def test_raising_fetch_is_none(self):
        self.assertIsNone(self.call("<html><body>x</body></html>", error=OSError("refused")))

    def test_non_html_content_type_is_none(self):
        self.assertIsNone(self.call("x" * 30000, content_type="application/json"))

    def test_bad_encoding_is_replaced_not_raised(self):
        body = ("caf\xe9 " * 80).encode("latin-1")
        text = jev_rank.page_text(
            "https://example.com/a",
            agent=fetch_candidates.BROWSER_AGENT,
            fetch=lambda request, timeout=20: FakeResponse(body, "text/html; charset=iso-8859-1"),
        )
        self.assertIn("café", text)


class RecentEditionsTests(unittest.TestCase):
    def write(self, directory, stem, stories):
        (directory / f"{stem}.json").write_text(json.dumps({"date": stem, "stories": stories}))

    def test_only_before_the_day_newest_first_and_capped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            directory = root / "data" / "editions"
            directory.mkdir(parents=True)
            self.write(directory, "2026-09-01", [{"title": "old", "section": "AI"}])
            self.write(directory, "2026-09-05", [{"title": "mid", "section": "Tools"}])
            self.write(directory, "2026-09-10", [{"title": "new", "section": "AI"}])
            self.write(directory, "2026-09-28", [{"title": "today", "section": "AI"}])
            self.write(directory, "2026-10-01", [{"title": "future", "section": "AI"}])
            with mock.patch.object(jev_rank, "ROOT", root):
                recent = jev_rank.recent_editions("2026-09-28", limit=2)
        self.assertEqual(recent, [
            {"date": "2026-09-10", "title": "new", "section": "AI"},
            {"date": "2026-09-05", "title": "mid", "section": "Tools"},
        ])

    def test_missing_directory_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(jev_rank, "ROOT", Path(tmp)):
                self.assertEqual(jev_rank.recent_editions("2026-09-28"), [])


class RequestBodyTests(unittest.TestCase):
    def test_carries_the_model_questions_and_state(self):
        candidate = {"title": "A launch", "url": "https://example.com/a"}
        recent = [{"date": "2026-09-27", "title": "yesterday", "section": "AI"}]
        body = jev_rank.request_body("2026-09-28", candidate, "reader", "bar", recent, None)
        self.assertEqual(body["model"], "jev-latest")
        self.assertEqual(set(body["questions"]), {"fit", "wildcard", "engineer_only"})
        self.assertEqual(set(body["state"]), {"edition_date", "reader", "bar", "recent_editions", "candidate"})
        self.assertEqual(body["state"]["edition_date"], "2026-09-28")
        self.assertEqual(body["state"]["recent_editions"], recent)
        self.assertEqual(body["state"]["candidate"], candidate)
        self.assertNotIn("page_text", body["state"]["candidate"])
        self.assertEqual(body["questions"], jev_rank.QUESTIONS)

    def test_page_text_is_added_without_mutating_the_candidate(self):
        candidate = {"title": "A launch"}
        before = deepcopy(candidate)
        body = jev_rank.request_body("2026-09-28", candidate, "reader", "bar", [], "the page body")
        self.assertEqual(body["state"]["candidate"]["page_text"], "the page body")
        self.assertEqual(candidate, before)
        self.assertIsNot(body["state"]["candidate"], candidate)

    def test_fit_instructions_sentence_survived(self):
        self.assertIn("Read `candidate.page_text`", jev_rank.QUESTIONS["fit"]["instructions"])
        self.assertIn("recent_editions", jev_rank.QUESTIONS["fit"]["instructions"])
        self.assertIn("Judge the underlying story", jev_rank.QUESTIONS["fit"]["instructions"])


class RankTests(unittest.TestCase):
    # (fit, confidence, wildcard, engineer_only)
    ANSWERS = {
        "must": (4.0, 0.9, 0.2, 0.05),  # priority 1.0
        "wild": (0.0, 0.5, 0.8, 0.1),  # priority 0.0: the wildcard no longer lifts it
        "mid": (2.0, 0.7, 0.1, 0.1),  # priority 0.5
        "engineer": (4.0, 0.9, 0.9, 0.95),  # engineer-only, dropped to 0.0
    }
    CANDIDATES = [
        {"title": "must", "url": "https://example.com/must"},
        {"title": "wild", "url": "https://example.com/wild"},
        {"title": "mid", "url": "https://example.com/mid"},
        {"title": "engineer", "url": "https://example.com/engineer"},
    ]

    def fake_post(self, body, key):
        fit, confidence, wildcard, engineer_only = self.ANSWERS[body["state"]["candidate"]["title"]]
        return response(fit, confidence, wildcard, engineer_only)

    def rank(self, candidates, fetch_page=lambda _url: None):
        return jev_rank.rank(
            candidates, "2026-09-28", "secret",
            post=self.fake_post, sleep=lambda _s: None, fetch_page=fetch_page,
        )

    def test_order_follows_fit_without_dropping_anyone(self):
        before = deepcopy(self.CANDIDATES)
        ranked = self.rank(self.CANDIDATES)
        self.assertEqual([item["title"] for item in ranked], ["must", "mid", "wild", "engineer"])
        self.assertEqual(len(ranked), len(self.CANDIDATES))
        self.assertEqual(ranked[-1]["title"], "engineer")
        self.assertEqual(ranked[-1]["jev"]["priority"], 0.0)
        self.assertEqual(ranked[1]["jev"]["priority"], 0.5)
        self.assertEqual(
            set(ranked[0]["jev"]),
            {"model", "fit", "fit_confidence", "wildcard", "engineer_only", "priority", "page_read"},
        )
        self.assertEqual(self.CANDIDATES, before)

    def test_a_high_wildcard_no_longer_lifts_a_low_fit(self):
        ranked = self.rank(self.CANDIDATES)
        order = [item["title"] for item in ranked]
        self.assertLess(order.index("mid"), order.index("wild"))
        wild = next(item for item in ranked if item["title"] == "wild")
        self.assertEqual(wild["jev"]["priority"], 0.0)

    def test_page_read_is_recorded_and_page_text_is_not_returned(self):
        def fetch_page(url):
            return "the story" if url.endswith("/must") else None

        ranked = self.rank(self.CANDIDATES, fetch_page=fetch_page)
        read = {item["title"]: item["jev"]["page_read"] for item in ranked}
        self.assertEqual(read, {"must": True, "wild": False, "mid": False, "engineer": False})
        for item in ranked:
            self.assertNotIn("page_text", item)

    def test_page_text_is_what_jev_sees(self):
        seen = {}

        def fake_post(body, key):
            candidate = body["state"]["candidate"]
            seen[candidate["title"]] = candidate.get("page_text")
            fit, confidence, wildcard, engineer_only = self.ANSWERS[candidate["title"]]
            return response(fit, confidence, wildcard, engineer_only)

        jev_rank.rank(
            self.CANDIDATES, "2026-09-28", "secret",
            post=fake_post, sleep=lambda _s: None,
            fetch_page=lambda url: "page body" if url.endswith("/mid") else None,
        )
        self.assertEqual(seen["mid"], "page body")
        self.assertIsNone(seen["must"])

    def test_input_is_not_mutated(self):
        before = deepcopy(self.CANDIDATES)
        ranked = self.rank(self.CANDIDATES)
        self.assertEqual(self.CANDIDATES, before)
        self.assertIsNot(ranked, self.CANDIDATES)
        originals = {candidate["title"]: candidate for candidate in self.CANDIDATES}
        for item in ranked:
            self.assertIsNot(item, originals[item["title"]])
            self.assertNotIn("jev", originals[item["title"]])

    def test_one_failure_raises_with_the_count(self):
        def fake_post(body, key):
            if body["state"]["candidate"]["title"] == "bad":
                raise ValueError("nope")
            return response()

        with self.assertRaises(RuntimeError) as caught:
            jev_rank.rank(
                [{"title": "ok", "url": "https://example.com/ok"}, {"title": "bad", "url": "https://example.com/bad"}],
                "2026-09-28", "secret",
                post=fake_post, sleep=lambda _s: None, fetch_page=lambda _url: None,
            )
        message = str(caught.exception)
        self.assertIn("1 of 2 candidates failed", message)
        self.assertIn("ValueError", message)
        self.assertIn("nope", message)


class GradeRetryTests(unittest.TestCase):
    def test_retries_a_429_then_succeeds(self):
        calls = []

        def fake_post(body, key):
            calls.append(key)
            if len(calls) == 1:
                raise http_error(429)
            return response(fit=3.25, confidence=0.75, wildcard=0.5, engineer_only=0.2)

        sleeps = []
        result = jev_rank.grade({}, "secret", post=fake_post, sleep=sleeps.append)
        self.assertEqual(len(calls), 2)
        self.assertEqual(sleeps, [1])  # 2 ** 0 between the two attempts
        self.assertEqual(result["fit"], 3.25)
        self.assertEqual(result["fit_confidence"], 0.75)
        self.assertEqual(result["wildcard"], 0.5)
        self.assertEqual(result["engineer_only"], 0.2)
        self.assertEqual(result["model"], "jev-latest")

    def test_raises_after_the_retry_budget(self):
        sleeps = []

        def fake_post(body, key):
            raise http_error(503)

        with self.assertRaises(urllib.error.HTTPError):
            jev_rank.grade({}, "secret", post=fake_post, sleep=sleeps.append)
        self.assertEqual(sleeps, [1, 2, 4])
        self.assertEqual(len(sleeps), jev_rank.RETRIES - 1)

    def test_a_400_is_not_retried(self):
        sleeps = []

        def fake_post(body, key):
            raise http_error(400)

        with self.assertRaises(urllib.error.HTTPError):
            jev_rank.grade({}, "secret", post=fake_post, sleep=sleeps.append)
        self.assertEqual(sleeps, [])


class FetchMainWithoutKeyTests(unittest.TestCase):
    def test_writes_ranked_by_null_and_reports_the_skip(self):
        tiny = [{"source": "Test", "evidence_class": "independent", "lens": "Tools", "title": "t", "url": "https://example.com/t"}]
        loaders = {
            "hacker_news": lambda: tiny,
            "show_hn": lambda: [],
            "lobsters": lambda: [],
            "github": lambda day: [],
            "feed": lambda *args, **kwargs: [],
            "google_news": lambda *args, **kwargs: [],
            "reddit": lambda: [],
        }
        env = {name: value for name, value in os.environ.items() if name != "TYPESAFE_API_KEY"}
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, env, clear=True), \
                    mock.patch.object(fetch_candidates, "ROOT", Path(tmp)), \
                    mock.patch.object(sys, "argv", ["fetch_candidates", "--date", "2026-09-28"]), \
                    mock.patch.multiple(fetch_candidates, **loaders):
                self.assertEqual(fetch_candidates.main(), 0)
            payload = json.loads((Path(tmp) / "data" / "candidates" / "2026-09-28.json").read_text())
        self.assertIsNone(payload["ranked_by"])
        self.assertEqual(payload["candidate_count"], 1)
        self.assertTrue(any(error.startswith("jev: skipped") for error in payload["source_errors"]))

    def run_main(self, env, loaders):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, env, clear=True), \
                    mock.patch.object(fetch_candidates, "ROOT", Path(tmp)), \
                    mock.patch.object(sys, "argv", ["fetch_candidates", "--date", "2026-09-28"]), \
                    mock.patch.multiple(fetch_candidates, **loaders):
                code = fetch_candidates.main()
            payload = json.loads((Path(tmp) / "data" / "candidates" / "2026-09-28.json").read_text())
        return code, payload

    def loaders(self, first):
        return {
            "hacker_news": lambda: first,
            "show_hn": lambda: [],
            "lobsters": lambda: [],
            "github": lambda day: [],
            "feed": lambda *args, **kwargs: [],
            "google_news": lambda *args, **kwargs: [],
            "reddit": lambda: [],
        }

    def test_a_jev_failure_keeps_fetch_order_and_says_why(self):
        pool = [
            {"source": "Test", "evidence_class": "independent", "lens": "Tools", "title": "a", "url": "https://example.com/a"},
            {"source": "Test", "evidence_class": "independent", "lens": "AI", "title": "b", "url": "https://example.com/b"},
        ]
        env = {**os.environ, "TYPESAFE_API_KEY": "test-key"}
        with mock.patch.object(jev_rank, "rank", side_effect=RuntimeError("2 of 2 candidates failed")):
            code, payload = self.run_main(env, self.loaders(pool))
        self.assertEqual(code, 0)
        self.assertIsNone(payload["ranked_by"])
        self.assertEqual([c["title"] for c in payload["candidates"]], ["a", "b"])
        self.assertTrue(any(e.startswith("jev: RuntimeError: 2 of 2") for e in payload["source_errors"]))

    def test_an_empty_pool_with_a_key_says_why_ranked_by_is_null(self):
        env = {**os.environ, "TYPESAFE_API_KEY": "test-key"}
        code, payload = self.run_main(env, self.loaders([]))
        self.assertEqual(code, 1)
        self.assertIsNone(payload["ranked_by"])
        self.assertIn("jev: skipped, no candidates to rank", payload["source_errors"])


class PostTests(unittest.TestCase):
    def test_a_redirect_is_refused_so_the_key_stays_on_host(self):
        handler = jev_rank._RefuseRedirect()
        request = urllib.request.Request(jev_rank.JEV_URL, b"{}", {"Authorization": "Bearer test-key"})
        self.assertIsNone(handler.redirect_request(request, None, 302, "Found", {}, "https://elsewhere.example/"))
        self.assertTrue(any(isinstance(h, jev_rank._RefuseRedirect) for h in jev_rank._NO_REDIRECT.handlers))


if __name__ == "__main__":
    unittest.main()
