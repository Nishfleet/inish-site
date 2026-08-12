import base64
import html
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.build_daily as builder

# Deliberately varied: the validator rejects editions whose stories share
# phrasing, so the fixture cannot be a single template repeated N times.
SAMPLE_STORIES = [
    {
        "title": "Ratchet ships deterministic replays",
        "url": "https://ratchet.example/launch",
        "source": "Ratchet",
        "section": "AI",
        "summary": "Ratchet records tool calls and replays them against a pinned snapshot of the environment.",
        "fact": "Replay of a 240-step trace finished in 1.8s against the pinned snapshot.",
        "take": "I want Ratchet pointed at my overnight runs before trusting another unattended lane.",
        "caveat": "Everything here is measured on one synthetic trace the authors chose themselves.",
    },
    {
        "title": "Postmark publishes five years of bounce data",
        "url": "https://postmark.example/bounces",
        "source": "Postmark",
        "section": "Demand signals",
        "summary": "An email provider released aggregate delivery outcomes covering a large sender population.",
        "fact": "Hard bounces sat at 0.42% across 19 billion messages.",
        "take": "My list is nowhere near Postmark scale, so a 0.42% floor reads aspirational to me.",
        "caveat": "Aggregates hide the senders who were suspended before the window even opened.",
    },
    {
        "title": "Grid layout gets a subgrid escape hatch",
        "url": "https://layout.example/subgrid",
        "source": "Layout Weekly",
        "section": "Product ideas",
        "summary": "A walkthrough of aligning nested cards to an outer track without redefining columns.",
        "fact": "Subgrid support reached 94% of tracked browsers in the July 2026 table.",
        "take": "Subgrid kills the wrapper divs I keep hand-adding to card grids every single build.",
        "caveat": "That remaining 6% is still enough to matter on a checkout page.",
    },
    {
        "title": "SQLite adds a page-level checksum mode",
        "url": "https://dbnotes.example/checksums",
        "source": "DB Notes",
        "section": "Tools",
        "summary": "An opt-in pragma stores a checksum per page and refuses reads when one fails to match.",
        "fact": "The pragma costs roughly 3% on write throughput in the maintainer's own benchmark.",
        "take": "SQLite checksums at a 3% write cost buy me corruption detection on my VPS disk.",
        "caveat": "It detects damage but repairs nothing, so backups still do the actual work.",
    },
    {
        "title": "A registry outage traced to one expired token",
        "url": "https://status.example/incident-4412",
        "source": "Status Example",
        "section": "Tools",
        "summary": "A package registry postmortem walks through a credential expiry that stalled publishes.",
        "fact": "Publishing was degraded for 71 minutes and the token had been unrotated for 14 months.",
        "take": "Fourteen months of drift is the part that worries me, not the 71-minute outage itself.",
        "caveat": "One postmortem is a story about one team, not evidence about registries generally.",
    },
    {
        "title": "Pricing page test moves annual conversion",
        "url": "https://growthlog.example/annual-toggle",
        "source": "Growth Log",
        "section": "Demand signals",
        "summary": "A team defaulted its pricing toggle to annual billing and published the resulting split.",
        "fact": "Annual selection rose from 22% to 31% over a six-week test with 4,100 visitors.",
        "take": "Nine points from a default is real, though 4,100 visitors leaves me wanting a rerun.",
        "caveat": "Nothing in the writeup reports refund rates, which is where annual defaults usually bite.",
    },
    {
        "title": "Screen reader survey shows heading reliance",
        "url": "https://a11ynotes.example/survey",
        "source": "A11y Notes",
        "section": "Product ideas",
        "summary": "A long-running accessibility survey published how respondents navigate unfamiliar pages.",
        "fact": "68% of respondents said headings are their first navigation method on a new page.",
        "take": "Headings beating landmarks at 68% changes how I would order my own page structure.",
        "caveat": "Survey respondents skew toward expert users who already know what to look for.",
    },
    {
        "title": "Local model runner adds speculative decoding",
        "url": "https://runner.example/speculative",
        "source": "Runner",
        "section": "AI",
        "summary": "A desktop inference tool added draft-model speculation behind a configuration flag.",
        "fact": "The changelog claims 1.7x faster decoding on an M4 Pro with a 1B draft model.",
        "take": "A 1.7x claim from a changelog is not a benchmark, so I would measure Runner myself.",
        "caveat": "Speculation helps predictable text and can lose ground on genuinely novel output.",
    },
]


def story(index: int) -> dict:
    """A unique, valid story. Indexes past the sample set are for count checks only."""
    base = dict(SAMPLE_STORIES[index % len(SAMPLE_STORIES)])
    if index >= len(SAMPLE_STORIES):
        base["url"] = f"{base['url']}-{index}"
    return base


def edition(stories=3, date="2026-08-02", candidate_count=70, **overrides):
    payload = {
        "date": date,
        "candidate_count": candidate_count,
        "editor_note": "Three things survived the check today; the rest were launch posts.",
        "stories": [story(index) for index in range(stories)],
    }
    payload.update(overrides)
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
        (self.legacy_daily / "og-image.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
        # A real 1x1 PNG so the icon fixture is a valid image, not just bytes.
        (self.legacy_daily / "apple-touch-icon.png").write_bytes(
            base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        )
        # The raster share card is pinned at the build root (no daily/ source,
        # like the touch icon), so the fixture lives at the public destination.
        self.public.mkdir()
        (self.public / "og-image.png").write_bytes(
            base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        )

    def tearDown(self):
        self.temp.cleanup()

    def write(self, payload):
        path = self.editions / f"{payload['date']}.json"
        path.write_text(json.dumps(payload))

    def build(self):
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "LEGACY_DAILY", self.legacy_daily),
        ):
            builder.main()

    def load(self):
        with patch.object(builder, "EDITIONS", self.editions):
            return builder.load_latest()

    def assertRejects(self, payload, message):
        self.write(payload)
        with patch.object(builder, "EDITIONS", self.editions):
            with self.assertRaisesRegex(ValueError, message):
                builder.load_latest()

    # --- rendering -------------------------------------------------------

    def test_builds_latest_feed_at_root(self):
        self.write(edition())
        self.build()
        for filename in ("index.html", "app.js", "styles.css", "og-image.svg", "og-image.png", "apple-touch-icon.png", "latest.json", "feed.xml", "sitemap.xml"):
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

    def test_renders_prominence_and_the_three_labels(self):
        self.write(edition(stories=6))
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertEqual(page.count('<article class="story'), 6)
        self.assertEqual(page.count('class="story story-lead"'), 1)
        self.assertEqual(page.count('class="story story-feature"'), 2)
        self.assertEqual(page.count('class="story story-brief"'), 3)
        self.assertEqual(page.count("<strong>Checked</strong>"), 6)
        self.assertEqual(page.count("<strong>Nish</strong>"), 6)
        self.assertEqual(page.count("<strong>But</strong>"), 6)
        self.assertNotIn("Nish's angle", page)
        self.assertIn("70 scanned · 6 kept", page)

    def test_every_checked_fact_links_to_its_evidence(self):
        # A "Checked" claim must be clickable through to the exact source it
        # was verified against, not a bare assertion the reader has to hunt
        # for. The label stays outside the link so the accessible name is the
        # fact sentence itself.
        self.write(edition(stories=4))
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertEqual(page.count('<p class="fact"><strong>Checked</strong> <a href='), 4)
        for index in range(4):
            story = SAMPLE_STORIES[index]
            self.assertIn(
                f'<a href="{html.escape(story["url"], quote=True)}" '
                f'rel="noopener noreferrer">{html.escape(story["fact"], quote=True)}</a>',
                page,
            )

    def test_head_carries_social_share_metadata(self):
        self.write(edition())
        self.build()
        head = (self.public / "index.html").read_text().split("</head>", 1)[0]
        self.assertIn('<meta property="og:image" content="https://inish.in/og-image.png">', head)
        self.assertIn(
            '<meta property="og:image:alt" content="Nish\'s Daily Reads: AI news, product ideas, '
            'and early signals of demand \u2014 in plain words.">',
            head,
        )
        self.assertIn('<meta property="og:image:type" content="image/png">', head)
        self.assertIn('<meta property="og:image:width" content="1200">', head)
        self.assertIn('<meta property="og:image:height" content="630">', head)
        self.assertIn('<meta name="twitter:card" content="summary_large_image">', head)
        self.assertIn('<meta name="twitter:image" content="https://inish.in/og-image.png">', head)
        self.assertEqual(head.count("https://inish.in/og-image.png"), 2)
        # The build keeps the raster share card at the root alongside app.js and styles.css.
        self.assertTrue((self.public / "og-image.png").is_file())

    def test_head_uses_raster_social_card(self):
        # X and other raster-only unfurlers exclude SVG card images, so the
        # generated head must point both og:image and twitter:image at the
        # committed 1200x630 PNG and declare it as image/png.
        self.write(edition())
        self.build()
        head = (self.public / "index.html").read_text().split("</head>", 1)[0]
        self.assertIn('<meta property="og:image" content="https://inish.in/og-image.png">', head)
        self.assertIn('<meta property="og:image:type" content="image/png">', head)
        self.assertIn('<meta name="twitter:image" content="https://inish.in/og-image.png">', head)
        self.assertNotIn("og-image.svg", head)
        # The committed card is a real PNG with the promised dimensions,
        # validated with the standard library only (signature + IHDR fields).
        card = (Path(__file__).resolve().parents[1] / "og-image.png").read_bytes()
        self.assertTrue(card.startswith(b"\x89PNG\r\n\x1a\n"), "og-image.png is not a PNG")
        self.assertEqual(
            (int.from_bytes(card[16:20], "big"), int.from_bytes(card[20:24], "big")),
            (1200, 630),
            "og-image.png must be exactly 1200x630",
        )

    def test_head_carries_apple_touch_icon(self):
        self.write(edition())
        self.build()
        head = (self.public / "index.html").read_text().split("</head>", 1)[0]
        self.assertIn(
            '<link rel="apple-touch-icon" sizes="180x180" type="image/png" href="/apple-touch-icon.png">',
            head,
        )
        # The build keeps the icon at the root and the copy is a real PNG.
        icon = self.public / "apple-touch-icon.png"
        self.assertTrue(icon.is_file())
        self.assertGreater(icon.stat().st_size, 8)
        self.assertTrue(icon.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"))

    def test_head_declares_a_desktop_favicon(self):
        # Browsers ask for /favicon.ico by default; declaring the pinned
        # apple-touch-icon as the favicon gives desktop tabs an icon without
        # adding a new binary or touching middleware.
        self.write(edition())
        self.build()
        head = (self.public / "index.html").read_text().split("</head>", 1)[0]
        self.assertIn('<link rel="icon" type="image/png" href="/apple-touch-icon.png">', head)

    def test_head_carries_truthful_structured_data_and_share_titles(self):
        # Every share tag and every JSON-LD value is derived from the strings
        # the page really renders — never invented copy.
        self.write(edition())
        self.build()
        page = (self.public / "index.html").read_text()
        head = page.split("</head>", 1)[0]

        rendered_title = html.unescape(head.split("<title>", 1)[1].split("</title>", 1)[0])
        rendered_description = html.unescape(
            head.split('<meta name="description" content="', 1)[1].split('"', 1)[0]
        )
        for attribute, expected in (
            ('<meta property="og:title" content="', rendered_title),
            ('<meta property="og:description" content="', rendered_description),
            ('<meta name="twitter:title" content="', rendered_title),
            ('<meta name="twitter:description" content="', rendered_description),
        ):
            with self.subTest(attribute=attribute):
                value = html.unescape(head.split(attribute, 1)[1].split('"', 1)[0])
                self.assertEqual(value, expected)

        self.assertEqual(head.count("application/ld+json"), 1)
        block = head.split('<script type="application/ld+json">', 1)[1].split("</script>", 1)[0]
        data = json.loads(block)
        self.assertEqual(data["@context"], "https://schema.org")
        nodes = {node["@type"]: node for node in data["@graph"]}
        self.assertEqual(set(nodes), {"WebSite", "Person", "Article"})

        site = nodes["WebSite"]
        self.assertEqual(site["name"], "Nish's Daily Reads")
        self.assertEqual(site["url"], "https://inish.in/")
        self.assertEqual(site["description"], rendered_description)

        person = nodes["Person"]
        self.assertEqual(person["name"], "Nish")
        self.assertEqual(person["url"], "https://inish.in/")
        # Only the one surface verified to belong to Nish; no job title,
        # employer, products, or biography are claimed.
        self.assertEqual(person["sameAs"], ["https://github.com/nish3451"])
        self.assertNotIn("jobTitle", person)

        article = nodes["Article"]
        self.assertEqual(article["headline"], rendered_title)
        self.assertEqual(article["datePublished"], "2026-08-02")
        self.assertEqual(article["mainEntityOfPage"], "https://inish.in/")
        self.assertEqual(article["author"], {"@type": "Person", "name": "Nish", "url": "https://inish.in/"})

    def test_head_carries_the_canonical_url(self):
        # The root feed is the site's single public surface and there are no
        # archives, so the canonical is the fixed root URL for every edition,
        # including a day with no stories.
        for payload in (
            edition(),
            edition(stories=0, editor_note="Nothing today survived a second look at the source."),
        ):
            with self.subTest(stories=len(payload["stories"])):
                self.write(payload)
                self.build()
                head = (self.public / "index.html").read_text().split("</head>", 1)[0]
                self.assertEqual(head.count('<link rel="canonical" href="https://inish.in/">'), 1)

    def test_filters_expose_selected_state_and_announce_count(self):
        # The merged filter accessibility contract must live in the renderer,
        # not just in a committed index.html: exactly one button is
        # aria-pressed=true (the active All filter), every other filter is
        # explicitly false, and a polite live region announces the initial
        # visible count so the static markup matches app.js's runtime updates.
        for payload in (
            edition(stories=3),
            edition(stories=1),
            edition(stories=0, editor_note="Nothing today survived a second look at the source."),
        ):
            with self.subTest(stories=len(payload["stories"])):
                self.write(payload)
                self.build()
                page = (self.public / "index.html").read_text()
                if not payload["stories"]:
                    self.assertNotIn("data-filter", page)
                    self.assertNotIn("filter-status", page)
                    continue
                filters = page.split('<nav class="filters"', 1)[1].split("</nav>", 1)[0]
                self.assertEqual(filters.count('aria-pressed="true"'), 1)
                self.assertIn(
                    '<button class="active" data-filter="all" aria-pressed="true">All</button>',
                    filters,
                )
                pressed_false = filters.count('aria-pressed="false"')
                self.assertGreaterEqual(pressed_false, 1)
                # Every filter button except All carries an explicit false state.
                self.assertEqual(filters.count("<button"), pressed_false + 1)
                self.assertIn('id="filter-status" role="status" aria-live="polite"', page)
                count = len(payload["stories"])
                noun = "story" if count == 1 else "stories"
                self.assertIn(f">Showing all {count} {noun}<", page)

    def test_footer_links_the_owned_studio(self):
        # The merged outbound identity link is part of the renderer, so the
        # next daily publish cannot silently drop it from the footer.
        self.write(edition())
        self.build()
        footer = (self.public / "index.html").read_text().split("<footer>", 1)[1].split("</footer>", 1)[0]
        self.assertIn(
            '<p class="identity"><a href="https://tinystudio.in/" rel="noopener noreferrer">Tiny Studio ↗</a> — Nish\'s studio.</p>',
            footer,
        )

    def test_quiet_day_publishes_a_short_edition(self):
        self.write(edition(stories=0, editor_note="Nothing today survived a second look at the source."))
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertIn("Nothing cleared the bar today", page)
        self.assertNotIn("data-filter", page)
        self.assertEqual(json.loads((self.public / "latest.json").read_text())["stories"], [])

    # --- the fact gate ---------------------------------------------------

    def test_rejects_a_fact_with_nothing_checkable_in_it(self):
        payload = edition()
        payload["stories"][0]["fact"] = "The project describes itself as fast and easy to adopt."
        self.assertRejects(payload, "checkable detail")

    def test_accepts_a_quoted_fact_without_a_number(self):
        payload = edition()
        payload["stories"][0]["fact"] = 'The README calls the cache "best effort and not durable across restarts".'
        self.write(payload)
        self.assertEqual(len(self.load()["stories"]), 3)

    def test_rejects_two_stories_resting_on_the_same_fact(self):
        payload = edition()
        payload["stories"][1]["fact"] = payload["stories"][0]["fact"]
        payload["stories"][1]["take"] = "Nobody replays a 240-step trace twice unless it earns me something."
        self.assertRejects(payload, "repeat the same fact")

    # --- the take gate ---------------------------------------------------

    def test_rejects_a_third_person_take(self):
        payload = edition()
        payload["stories"][0]["take"] = "Ratchet is worth watching for anyone running unattended agent lanes."
        self.assertRejects(payload, "first person")

    def test_rejects_an_unanchored_aphorism(self):
        payload = edition()
        payload["stories"][0]["take"] = "I keep finding that trust grows in the small moments nobody demos."
        self.assertRejects(payload, "shares no specific term")

    def test_rejects_a_known_aphorism_opener(self):
        payload = edition()
        payload["stories"][0]["take"] = "Speed is a poor substitute for a Ratchet replay I can actually inspect."
        self.assertRejects(payload, "aphorism pattern")

    def test_rejects_two_takes_opening_the_same_way(self):
        payload = edition()
        payload["stories"][1]["take"] = "I want Postmark's raw numbers before I believe a 0.42% floor."
        self.assertRejects(payload, "open their take")

    # --- repetition and balance ------------------------------------------

    def test_rejects_a_phrase_reused_across_stories(self):
        payload = edition()
        shared = "the same six words repeated verbatim"
        payload["stories"][0]["caveat"] = f"Nobody verified {shared} anywhere else."
        payload["stories"][1]["caveat"] = f"A reader hits {shared} on the second card."
        self.assertRejects(payload, "share the phrase")

    def test_rejects_an_edition_dominated_by_one_domain(self):
        payload = edition(stories=4)
        for index, item in enumerate(payload["stories"]):
            item["url"] = f"https://github.com/example/{index}"
        self.assertRejects(payload, "more than 3 stories from github.com")

    def test_rejects_an_edition_dominated_by_one_section(self):
        payload = edition(stories=5)
        for item in payload["stories"]:
            item["section"] = "AI"
        self.assertRejects(payload, "more than 4 stories in section")

    def fresh_urls(self, payload):
        """Isolate one URL as the only overlap with an earlier edition."""
        for index, item in enumerate(payload["stories"]):
            item["url"] = f"https://fresh-{index}.example/story"
        return payload

    def test_rejects_a_story_that_ran_in_a_recent_edition(self):
        self.write(edition(stories=3, date="2026-08-01"))
        payload = self.fresh_urls(edition(stories=3, date="2026-08-02"))
        payload["stories"][0]["url"] = "https://ratchet.example/launch"
        self.assertRejects(payload, "already ran on 2026-08-01")

    def test_accepts_an_edition_with_no_overlap(self):
        self.write(edition(stories=3, date="2026-08-01"))
        self.write(self.fresh_urls(edition(stories=3, date="2026-08-02")))
        self.assertEqual(len(self.load()["stories"]), 3)

    def test_allows_a_story_older_than_the_repeat_window(self):
        self.write(edition(stories=3, date="2026-06-01"))
        self.write(edition(stories=3, date="2026-08-02"))
        self.assertEqual(len(self.load()["stories"]), 3)

    def test_ignores_host_case_www_and_trailing_slash_when_detecting_a_repeat(self):
        self.write(edition(stories=3, date="2026-08-01"))
        payload = self.fresh_urls(edition(stories=3, date="2026-08-02"))
        payload["stories"][0]["url"] = "https://WWW.Ratchet.example/launch/"
        self.assertRejects(payload, "already ran on 2026-08-01")

    # --- structural safety -----------------------------------------------

    def test_rejects_more_than_eight_stories(self):
        self.assertRejects(edition(stories=9), "at most 8 stories")

    def test_rejects_non_https_links(self):
        payload = edition()
        payload["stories"][0]["url"] = "http://example.com/unsafe"
        self.assertRejects(payload, "HTTPS")

    def test_rejects_credentialed_and_private_links(self):
        for url in ("https://user:pass@example.com/story", "https://127.0.0.1/story", "https://service.internal/story"):
            with self.subTest(url=url):
                payload = edition()
                payload["stories"][0]["url"] = url
                self.assertRejects(payload, "public HTTPS")

    def test_rejects_duplicate_links(self):
        payload = edition()
        payload["stories"][1]["url"] = payload["stories"][0]["url"]
        self.assertRejects(payload, "duplicate")

    def test_rejects_extra_private_fields(self):
        self.assertRejects(edition(private_notes="must never reach latest.json"), "edition fields")

    def test_rejects_a_story_missing_the_new_fields(self):
        payload = edition()
        del payload["stories"][0]["caveat"]
        self.assertRejects(payload, "story fields must be exactly")

    def test_rejects_blank_required_copy(self):
        payload = edition()
        payload["stories"][0]["caveat"] = ""
        self.assertRejects(payload, "caveat")

    def test_rejects_invalid_candidate_count(self):
        for candidate_count in (True, False, 0, -1, 8.0, "8", 2):
            with self.subTest(candidate_count=candidate_count):
                self.assertRejects(edition(candidate_count=candidate_count), "candidate_count")

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
