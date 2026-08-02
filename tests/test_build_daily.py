import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.build_daily as builder


def edition(stories=5):
    return {
        "date": "2026-08-02",
        "editor_note": "A useful day of signals.",
        "stories": [
            {
                "title": f"Story {index}",
                "url": f"https://example.com/{index}",
                "source": "Example",
                "section": "AI & agents",
                "summary": "A concrete summary with enough detail to be useful.",
                "why_it_matters": "It informs a current product or workflow decision.",
            }
            for index in range(stories)
        ],
    }


class BuildDailyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.editions = self.root / "data" / "editions"
        self.daily = self.root / "daily"
        self.editions.mkdir(parents=True)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, payload):
        (self.editions / "2026-08-02.json").write_text(json.dumps(payload))

    def test_builds_latest_archive_rss_and_json(self):
        self.write(edition())
        with patch.object(builder, "EDITIONS", self.editions), patch.object(builder, "DAILY", self.daily):
            builder.main()
        self.assertTrue((self.daily / "index.html").exists())
        self.assertTrue((self.daily / "archive" / "2026-08-02" / "index.html").exists())
        self.assertTrue((self.daily / "archive" / "index.html").exists())
        self.assertEqual(json.loads((self.daily / "latest.json").read_text())["date"], "2026-08-02")
        self.assertIn("https://inish.in/daily/archive/2026-08-02/", (self.daily / "feed.xml").read_text())
        self.assertIn("https://inish.in/daily/archive/2026-08-02/", (self.daily / "sitemap.xml").read_text())

    def test_rejects_non_https_links(self):
        payload = edition()
        payload["stories"][0]["url"] = "http://example.com/unsafe"
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "HTTPS"):
                builder.load_editions()

    def test_rejects_duplicate_links(self):
        payload = edition()
        payload["stories"][1]["url"] = payload["stories"][0]["url"]
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "duplicate"):
                builder.load_editions()

    def test_rejects_extra_private_fields(self):
        payload = edition()
        payload["private_notes"] = "must never reach latest.json"
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "edition fields"):
                builder.load_editions()

    def test_rejects_blank_required_copy(self):
        payload = edition()
        payload["stories"][0]["why_it_matters"] = ""
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "why_it_matters"):
                builder.load_editions()

    def test_prunes_removed_generated_editions(self):
        self.write(edition())
        stale = self.daily / "archive" / "2026-07-31"
        stale.mkdir(parents=True)
        (stale / "index.html").write_text("stale")
        with patch.object(builder, "EDITIONS", self.editions), patch.object(builder, "DAILY", self.daily):
            builder.main()
        self.assertFalse(stale.exists())


if __name__ == "__main__":
    unittest.main()
