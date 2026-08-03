import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.build_daily as builder


def edition(stories=8, date="2026-08-02", candidate_count=70):
    payload = {
        "date": date,
        "editor_note": "A day of signals with clear editorial choices.",
        "stories": [
            {
                "title": f"Story {index}",
                "url": f"https://example.com/{index}",
                "source": "Example",
                "section": "AI & agents",
                "summary": "A plain summary with enough detail to explain the source.",
                "why_it_matters": "It informs a current product or workflow decision.",
            }
            for index in range(stories)
        ],
    }
    if candidate_count is not None:
        payload["candidate_count"] = candidate_count
    return payload


class BuildDailyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.editions = self.root / "data" / "editions"
        self.public = self.root / "public"
        self.legacy_daily = self.root / "legacy-daily"
        self.editions.mkdir(parents=True)
        self.legacy_daily.mkdir()
        (self.legacy_daily / "app.js").write_text("app")
        (self.legacy_daily / "styles.css").write_text("styles")

    def tearDown(self):
        self.temp.cleanup()

    def write(self, payload):
        path = self.editions / f"{payload['date']}.json"
        path.write_text(json.dumps(payload))

    def test_builds_latest_feed_at_root(self):
        self.write(edition())
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "LEGACY_DAILY", self.legacy_daily),
        ):
            builder.main()
        for filename in ("index.html", "app.js", "styles.css", "latest.json", "feed.xml", "sitemap.xml"):
            self.assertTrue((self.public / filename).exists(), filename)
        self.assertFalse((self.public / "archive").exists())
        self.assertNotIn("archive", (self.public / "index.html").read_text())
        self.assertEqual(json.loads((self.public / "latest.json").read_text())["date"], "2026-08-02")

        feed = (self.public / "feed.xml").read_text()
        self.assertEqual(feed.count("<item>"), 1)
        self.assertIn("<link>https://inish.in/</link>", feed)
        self.assertIn('<guid isPermaLink="false">inish-daily-2026-08-02</guid>', feed)
        self.assertNotIn("/daily/", feed)

        sitemap = (self.public / "sitemap.xml").read_text()
        self.assertEqual(sitemap.count("<loc>"), 1)
        self.assertIn("<loc>https://inish.in/</loc>", sitemap)
        self.assertNotIn("feed.xml", sitemap)

    def test_candidate_count_is_preserved_and_rendered(self):
        self.write(edition(candidate_count=70))
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "LEGACY_DAILY", self.legacy_daily),
        ):
            builder.main()

        latest = json.loads((self.public / "latest.json").read_text())
        self.assertEqual(latest["candidate_count"], 70)
        page = (self.public / "index.html").read_text()
        self.assertIn("70 scanned · 8 kept", page)

    def test_rejects_invalid_candidate_count(self):
        for candidate_count in (True, False, 0, -1, 8.0, "8", 7):
            with self.subTest(candidate_count=candidate_count):
                payload = edition(candidate_count=candidate_count)
                self.write(payload)
                with patch.object(builder, "EDITIONS", self.editions):
                    with self.assertRaisesRegex(ValueError, "candidate_count"):
                        builder.load_editions()

    def test_legacy_editions_without_candidate_count_remain_valid(self):
        self.write(edition(stories=8, date="2026-08-03", candidate_count=70))
        self.write(edition(stories=5, date="2026-08-02", candidate_count=None))
        with patch.object(builder, "EDITIONS", self.editions):
            editions = builder.load_editions()

        self.assertEqual([len(item["stories"]) for item in editions], [8, 5])
        self.assertNotIn("candidate_count", editions[1])

    def test_latest_requires_candidate_count(self):
        self.write(edition(stories=8, date="2026-08-03", candidate_count=None))
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "latest.*candidate_count"):
                builder.load_editions()

    def test_latest_must_contain_7_to_9_stories(self):
        for story_count in (5, 10):
            with self.subTest(story_count=story_count):
                self.write(edition(stories=story_count, date="2026-08-03"))
                with patch.object(builder, "EDITIONS", self.editions):
                    with self.assertRaisesRegex(ValueError, "Latest edition.*7-9"):
                        builder.load_editions()

    def test_rendered_prominence_and_nish_angle_label(self):
        self.write(edition(candidate_count=70))
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "LEGACY_DAILY", self.legacy_daily),
        ):
            builder.main()

        page = (self.public / "index.html").read_text()
        self.assertEqual(page.count('<article class="story'), 8)
        self.assertEqual(page.count('class="story story-lead"'), 1)
        self.assertEqual(page.count('class="story story-feature"'), 2)
        self.assertEqual(page.count('class="story story-brief"'), 5)
        self.assertIn("Nish's angle:", page)
        self.assertNotIn("Why read:", page)

    def test_rejects_non_https_links(self):
        payload = edition()
        payload["stories"][0]["url"] = "http://example.com/unsafe"
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, "HTTPS"):
                builder.load_editions()

    def test_rejects_credentialed_and_private_links(self):
        for url in ("https://user:pass@example.com/story", "https://127.0.0.1/story", "https://service.internal/story"):
            with self.subTest(url=url):
                payload = edition()
                payload["stories"][0]["url"] = url
                self.write(payload)
                with patch.object(builder, "EDITIONS", self.editions):
                    with self.assertRaisesRegex(ValueError, "public HTTPS"):
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

    def test_removes_stale_archive_output(self):
        self.write(edition())
        stale = self.public / "archive" / "2026-07-31"
        stale.mkdir(parents=True)
        (stale / "index.html").write_text("stale")
        legacy_stale = self.legacy_daily / "archive" / "2026-07-31"
        legacy_stale.mkdir(parents=True)
        (legacy_stale / "index.html").write_text("stale")
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "ROOT", self.public),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "LEGACY_DAILY", self.legacy_daily),
        ):
            builder.main()
        self.assertFalse(stale.exists())
        self.assertFalse(legacy_stale.exists())
        self.assertFalse((self.public / "archive").exists())


if __name__ == "__main__":
    unittest.main()
