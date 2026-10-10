"""sources.json is the one place a site is added; it must load and be consistent."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from inish_daily import fetch_candidates as fc


class SourcesFileTests(unittest.TestCase):
    def test_the_committed_file_loads(self):
        config = fc.load_sources()
        self.assertGreaterEqual(len(config["sources"]), 40)
        groups = {group["id"] for group in config["groups"]}
        for source in config["sources"]:
            self.assertIn(source["group"], groups)

    def test_the_original_sources_are_still_there(self):
        ids = {source["id"] for source in fc.load_sources()["sources"]}
        for kept in ("hacker-news", "show-hn", "lobsters", "github", "openai", "techcrunch-ai", "product-hunt",
                     "news-ai", "news-funding", "news-adoption", "reddit-saas", "reddit-startups", "reddit-entrepreneur"):
            self.assertIn(kept, ids)

    def write(self, data):
        path = Path(tempfile.mkdtemp()) / "sources.json"
        path.write_text(json.dumps(data))
        return path

    def base(self, **extra):
        source = {"id": "a", "name": "A", "type": "rss", "url": "https://a.example/feed", "group": "g", "lens": "AI", "evidence": "independent"}
        source.update(extra)
        return {"groups": [{"id": "g", "label": "G"}], "sources": [source]}

    def test_a_new_rss_site_needs_no_code(self):
        self.assertEqual(len(fc.load_sources(self.write(self.base()))["sources"]), 1)

    def test_bad_entries_are_rejected(self):
        for extra, message in (
            ({"group": "nope"}, "unknown group"),
            ({"type": "carrier-pigeon"}, "unknown type"),
            ({"url": None}, "needs url"),
            ({"evidence": "vibes"}, "evidence"),
        ):
            with self.subTest(extra=extra):
                with self.assertRaisesRegex(ValueError, message):
                    fc.load_sources(self.write(self.base(**extra)))

    def test_duplicate_ids_are_rejected(self):
        data = self.base()
        data["sources"].append(dict(data["sources"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            fc.load_sources(self.write(data))

    def test_a_configured_feed_is_fetched_prefixed_tagged_and_filtered(self):
        data = self.base(title_prefix="org/repo", limit=5)
        data["filters"] = {"skip_title_regex": [r"\bbest \d+\b"]}
        source = fc.load_sources(self.write(data))["sources"][0]
        items = [
            {"title": "v1.2.3", "url": "https://a.example/1"},
            {"title": "The best 10 tools", "url": "https://a.example/2"},
        ]
        import datetime as dt
        with mock.patch.object(fc, "feed", return_value=items) as feed:
            out = fc.load_source(source, dt.date(2026, 10, 10), [r"\bbest \d+\b"])
        feed.assert_called_once()
        self.assertEqual([i["title"] for i in out], ["org/repo: v1.2.3"])
        self.assertEqual((out[0]["source"], out[0]["source_id"], out[0]["group"]), ("A", "a", "g"))

    def test_hype_and_parity_headlines_are_skipped_by_the_committed_filters(self):
        patterns = fc.load_sources()["filters"]["skip_title_regex"]
        for title in ("10 best AI tools for founders", "Top 5 agents", "Open model now matches GPT-5", "This will revolutionize work"):
            with self.subTest(title=title):
                self.assertTrue(fc.skipped_title(title, patterns))
        for title in ("OpenAI cuts API prices by 80%", "anthropics/claude-code: v2.1.296"):
            with self.subTest(title=title):
                self.assertFalse(fc.skipped_title(title, patterns))

    def test_main_reports_which_sources_worked(self):
        import os, sys
        data = self.base()
        path = self.write(data)
        tmp = Path(tempfile.mkdtemp())
        env = {k: v for k, v in os.environ.items() if k != "TYPESAFE_API_KEY"}
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(fc, "load_sources", lambda: json.loads(path.read_text())), \
                mock.patch.object(fc, "ROOT", tmp), \
                mock.patch.object(sys, "argv", ["fetch_candidates", "--date", "2026-10-10"]), \
                mock.patch.object(fc, "feed", return_value=[{"title": "t", "url": "https://a.example/t", "evidence_class": "independent", "lens": "AI", "source": "A"}]):
            self.assertEqual(fc.main(), 0)
        payload = json.loads((tmp / "data" / "candidates" / "2026-10-10.json").read_text())
        self.assertEqual(payload["sources"], [{"id": "a", "name": "A", "group": "g", "count": 1, "error": None}])


if __name__ == "__main__":
    unittest.main()
