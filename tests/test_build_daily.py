import html
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import inish_daily.build_daily as builder

FIXTURES = Path(__file__).resolve().parent / "fixtures"

# Deliberately varied: the validator rejects editions whose stories share
# phrasing, so the fixture cannot be a single template repeated N times.
SAMPLE_STORIES = [
    {
        "title": "Ratchet ships deterministic replays",
        "url": "https://ratchet.example/launch",
        "evidence_url": "https://ratchet.example/launch",
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
        "evidence_url": "https://postmark.example/bounces",
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
        "evidence_url": "https://layout.example/subgrid",
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
        "evidence_url": "https://dbnotes.example/checksums",
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
        "evidence_url": "https://status.example/incident-4412",
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
        "evidence_url": "https://growthlog.example/annual-toggle",
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
        "evidence_url": "https://a11ynotes.example/survey",
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
        "evidence_url": "https://runner.example/speculative",
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
        self.public = self.root / "public" / "daily"
        self.candidates = self.root / "data" / "candidates"
        self.pools = self.root / "data" / "pools"
        self.editions.mkdir(parents=True)
        self.candidates.mkdir(parents=True)
        self.public.mkdir(parents=True)
        # The committed assets the generated head references. The build must
        # never overwrite them, only check they exist.
        (self.public / "styles.css").write_text("styles")
        (self.public / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

    def tearDown(self):
        self.temp.cleanup()

    def write(self, payload):
        path = self.editions / f"{payload['date']}.json"
        path.write_text(json.dumps(payload))

    def build(self):
        with (
            patch.object(builder, "EDITIONS", self.editions),
            patch.object(builder, "DAILY", self.public),
            patch.object(builder, "CANDIDATES", self.candidates),
            patch.object(builder, "POOLS", self.pools),
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

    # --- rendering -------------------------------------------------------

    def write_candidates(self, day="2026-08-02", ranked=True):
        payload = json.loads((FIXTURES / "candidates.json").read_text())
        payload["date"] = day
        if not ranked:
            payload["ranked_by"] = None
            for candidate in payload["candidates"]:
                candidate.pop("jev", None)
        (self.candidates / f"{day}.json").write_text(json.dumps(payload))

    def test_builds_the_daily_files_under_daily(self):
        self.write(edition())
        self.build()
        for filename in ("index.html", "styles.css", "favicon.svg", "latest.json", "feed.xml"):
            self.assertTrue((self.public / filename).exists(), filename)
        self.assertEqual(json.loads((self.public / "latest.json").read_text())["date"], "2026-08-02")
        feed = (self.public / "feed.xml").read_text()
        self.assertEqual(feed.count("<item>"), 1)
        self.assertIn("<link>https://nish.sh/daily</link>", feed)
        self.assertIn('<guid isPermaLink="false">the-daily-2026-08-02</guid>', feed)
        self.assertNotIn("inish.in", feed)

    def test_page_renders_from_a_fixture_edition(self):
        self.write(edition(stories=4, candidate_count=229))
        self.write_candidates()
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertIn("<title>The Daily \u00b7 2026-08-02</title>", page)
        self.assertIn("<h1><a href=\"/daily\">The Daily</a></h1>", page)
        self.assertIn("Sunday, 2 August 2026", page)
        self.assertIn("Compiled from <b>12 of 13</b> sources", page)
        self.assertIn("229 items read", page)
        self.assertIn("4 picked", page)
        self.assertIn("updated 07:41 IST", page)
        # One lead, the rest as picks, each carrying the three labels.
        self.assertEqual(page.count('class="story story-lead"'), 1)
        self.assertEqual(page.count('class="story story-pick"'), 3)
        # The lead carries the checked fact, the take and the caveat; picks are short.
        self.assertEqual(page.count("<b>Checked</b>"), 1)
        self.assertEqual(page.count("<b>Nish</b>"), 1)
        self.assertEqual(page.count("<b>But</b>"), 1)
        # Section nav, section cards by source group, and the wire.
        for anchor in ("lead", "picks", "s-ai", "s-dev", "s-product", "s-news", "s-reddit", "wire"):
            self.assertIn(f'<a href="#{anchor}">', page)
            self.assertIn(f'id="{anchor}"', page)
        self.assertNotIn("<script", page)

    def test_every_listed_item_links_to_its_original(self):
        self.write(edition(stories=2))
        self.write_candidates()
        self.build()
        front = json.loads((self.public / "latest.json").read_text())
        page = (self.public / "index.html").read_text()
        items = [item for section in front["sections"] for item in section["items"]] + front["wire"]
        self.assertGreater(len(items), 10)
        for item in items:
            self.assertIn(f'href="{html.escape(item["url"], quote=True)}"', page)
        for story in front["stories"]:
            self.assertIn(f'href="{html.escape(story["url"], quote=True)}"', page)
        lead = front["stories"][0]
        self.assertIn(f'<a href="{html.escape(lead["evidence_url"], quote=True)}" rel="noopener noreferrer">{html.escape(lead["fact"], quote=True)}</a>', page)

    def test_cards_skip_stories_already_picked_and_jev_skips(self):
        self.write(edition(stories=1))
        self.write_candidates()
        self.build()
        front = json.loads((self.public / "latest.json").read_text())
        urls = [item["url"] for section in front["sections"] for item in section["items"]] + [i["url"] for i in front["wire"]]
        self.assertNotIn(SAMPLE_STORIES[0]["url"], urls)
        self.assertNotIn("https://skipped.example/offtopic", urls)
        self.assertEqual(len(urls), len(set(urls)))
        for section in front["sections"]:
            self.assertLessEqual(len(section["items"]), builder.CARD_ITEMS)
        self.assertLessEqual(len(front["wire"]), builder.WIRE_ITEMS)

    def test_the_pool_is_kept_so_the_page_rebuilds_without_the_candidate_file(self):
        self.write(edition())
        self.write_candidates()
        self.build()
        first = (self.public / "index.html").read_text()
        self.assertTrue((self.pools / "2026-08-02.json").exists())
        (self.candidates / "2026-08-02.json").unlink()
        self.build()
        self.assertEqual((self.public / "index.html").read_text(), first)

    def test_without_a_pool_the_page_still_builds_from_the_picks(self):
        self.write(edition())
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertIn('id="lead"', page)
        self.assertNotIn('id="wire"', page)
        self.assertIn(f"<b>{len(builder.fetch_candidates.load_sources()['sources'])}</b> sources", page)

    def test_an_unranked_pool_keeps_fetch_order_and_every_item(self):
        self.write(edition(stories=1))
        self.write_candidates(ranked=False)
        self.build()
        front = json.loads((self.public / "latest.json").read_text())
        urls = [item["url"] for section in front["sections"] for item in section["items"]] + [i["url"] for i in front["wire"]]
        self.assertIn("https://skipped.example/offtopic", urls)

    def test_an_edition_may_carry_its_own_sections_and_wire(self):
        # The later editor step writes these directly; the pool is then ignored
        # for them and the page renders exactly what the edition says.
        payload = edition(stories=1)
        payload["sections"] = [{"id": "ai", "label": "AI", "items": [
            {"title": "Editor-chosen item", "url": "https://editor.example/a", "source": "Editor", "blurb": "Why it matters."}]}]
        payload["wire"] = [{"title": "Wire line", "url": "https://editor.example/w", "source": "Editor"}]
        self.write(payload)
        self.write_candidates()
        self.build()
        front = json.loads((self.public / "latest.json").read_text())
        self.assertEqual([s["id"] for s in front["sections"]], ["ai"])
        self.assertEqual([i["title"] for i in front["wire"]], ["Wire line"])
        page = (self.public / "index.html").read_text()
        self.assertIn("Editor-chosen item", page)
        self.assertIn("Why it matters.", page)

    def test_rejects_a_bad_link_in_editor_written_sections(self):
        payload = edition(stories=1)
        payload["wire"] = [{"title": "Wire line", "url": "http://editor.example/w", "source": "Editor"}]
        self.assertRejects(payload, "Only public HTTPS")

    def test_markup_in_source_titles_is_escaped(self):
        self.write(edition(stories=1))
        self.write_candidates()
        path = self.candidates / "2026-08-02.json"
        payload = json.loads(path.read_text())
        payload["candidates"][0]["title"] = '<img src=x onerror=alert(1)> & "quotes"'
        path.write_text(json.dumps(payload))
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertNotIn("<img src=x", page)
        self.assertIn("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;", page)

    def test_a_candidate_with_an_unsafe_link_is_dropped_not_fatal(self):
        self.write(edition(stories=1))
        self.write_candidates()
        path = self.candidates / "2026-08-02.json"
        payload = json.loads(path.read_text())
        payload["candidates"][0]["url"] = "javascript:alert(1)"
        path.write_text(json.dumps(payload))
        self.build()
        self.assertNotIn("javascript:", (self.public / "index.html").read_text())

    def test_quiet_day_publishes_a_short_edition(self):
        self.write(edition(stories=0, editor_note="Nothing today survived a second look at the source."))
        self.write_candidates()
        self.build()
        page = (self.public / "index.html").read_text()
        self.assertIn("Nothing cleared the bar today", page)
        self.assertIn("no picks today", page)
        self.assertIn('id="wire"', page)
        self.assertEqual(json.loads((self.public / "latest.json").read_text())["stories"], [])

    def test_no_shipped_file_still_names_the_retired_site(self):
        self.write(edition())
        self.write_candidates()
        self.build()
        root = Path(__file__).resolve().parents[1]
        shipped = list(self.public.iterdir()) + [
            path for path in (root / "public").rglob("*") if path.is_file() and path.suffix in {".html", ".css", ".svg", ".json", ".xml"}
        ]
        for path in shipped:
            with self.subTest(path=path.name):
                text = path.read_text().lower()
                self.assertNotIn("inish.in", text)
                self.assertNotIn("nish's daily reads", text)
                self.assertNotRegex(text, r"tiny\s*studio")

    def test_committed_surface_matches_the_newest_accepted_edition(self):
        # Deliberately NOT patched to temp dirs: the committed generated
        # surface must equal exactly what the builder renders from the newest
        # accepted edition and its stored pool, so a hand edit or a stale build
        # fails here.
        config = builder.fetch_candidates.load_sources()
        latest = builder.load_latest()
        pool, _ = builder.load_pool(__import__("datetime").date.fromisoformat(latest["date"]), config)
        front = builder.compose_front(latest, pool, config)
        self.assertEqual(
            (builder.DAILY / "latest.json").read_text(encoding="utf-8"),
            json.dumps(front, indent=2, ensure_ascii=False) + "\n",
        )
        self.assertEqual((builder.DAILY / "feed.xml").read_text(encoding="utf-8"), builder.rss(front))
        self.assertEqual((builder.DAILY / "index.html").read_text(encoding="utf-8"), builder.page(front))

    def test_asset_list_is_pinned(self):
        # The guards below iterate builder.ASSETS; an emptied tuple would make
        # them pass vacuously.
        self.assertEqual(set(builder.ASSETS), {"styles.css", "favicon.svg"})

    def test_rss_item_carries_every_story_of_its_edition(self):
        # The root page rolls over every day, so the RSS item must keep the
        # whole edition readable after the link target has changed. The
        # description renders the editor's note and every story — title with
        # its source link, summary, Checked fact linked to its evidence, take,
        # and caveat — as one HTML string escaped into the XML character data.
        self.write(edition(stories=3))
        self.build()
        feed = (self.public / "feed.xml").read_text()
        description = feed.split("<item>", 1)[1].split("<description>", 1)[1].rsplit("</description>", 1)[0]
        self.assertEqual(
            description,
            builder.rss_item_description(self.load()),
        )
        self.assertIn(
            f"<p>{edition()['editor_note']}</p>",
            html.unescape(description),
        )
        for index in range(3):
            story = SAMPLE_STORIES[index]
            self.assertIn(
                f'<h3><a href="{story["url"]}">{story["title"]}</a></h3>',
                html.unescape(description),
            )
            self.assertIn(f"<p>{story['summary']}</p>", html.unescape(description))
            self.assertIn(
                f'<p><strong>Checked</strong> <a href="{story["evidence_url"]}">'
                f"{story['fact']}</a></p>",
                html.unescape(description),
            )
            self.assertIn(f"<p><strong>Nish</strong> {story['take']}</p>", html.unescape(description))
            self.assertIn(f"<p><strong>But</strong> {story['caveat']}</p>", html.unescape(description))

    def test_rss_item_description_is_well_formed_when_copy_has_special_characters(self):
        # A story whose copy contains an ampersand, a quote, or angle brackets
        # must not corrupt the XML or another story's markup: the whole
        # description is escaped into character data, so the feed still parses
        # and the round-tripped HTML is exactly the intended markup.
        payload = edition(stories=1)
        story = payload["stories"][0]
        story["title"] = 'R&D <launch> & "results"'
        story["fact"] = 'The README says "&lt;3 &amp; more" and quotes an "angle: <tag>"'
        story["take"] = 'I would measure the <launch> & "results" spec myself before trusting its numbers.'
        story["caveat"] = 'Single "quotes", double "quotes", & ampersands, <angle> brackets.'
        self.write(payload)
        self.build()
        feed = (self.public / "feed.xml").read_text()
        description = feed.split("<item>", 1)[1].split("<description>", 1)[1].rsplit("</description>", 1)[0]
        self.assertNotIn("<launch>", description)
        self.assertNotIn("<tag>", description)
        import xml.etree.ElementTree as ET
        ET.fromstring(feed)
        self.assertEqual(
            html.unescape(description),
            f"<p>{payload['editor_note']}</p>"
            f'<h3><a href="{story["url"]}">{story["title"]}</a></h3>'
            f"<p>{story['summary']}</p>"
            f'<p><strong>Checked</strong> <a href="{story["evidence_url"]}">{story["fact"]}</a></p>'
            f"<p><strong>Nish</strong> {story['take']}</p>"
            f"<p><strong>But</strong> {story['caveat']}</p>",
        )

    def cross_source_story(self):
        """A story whose Checked fact is only supported by a separate source.

        The fact (Hacker News engagement) is not on the story page at all; the
        HN item is the exact evidence, so the renderer must link the fact to
        the HN item while the story keeps its own primary-source links.
        """
        return {
            "title": "Claude Code messages cross sessions now",
            "url": "https://code.claude.com/docs/en/cross-session-messaging",
            "evidence_url": "https://news.ycombinator.com/item?id=49222824",
            "source": "Anthropic",
            "section": "AI",
            "summary": "A new Claude Code page explains how messages persist across sessions on the same machine.",
            "fact": "Hacker News logged 168 points and 70 comments on the discussion of the launch.",
            "take": "I read the HN thread before trusting the feature, because points measure attention, not correctness.",
            "caveat": "Points and comment counts are engagement, not an endorsement of the feature.",
        }

    def test_rejects_cross_source_fact_without_evidence_url(self):
        # A story whose fact is only supported by a separate source must carry
        # that evidence URL, or the whole edition is rejected. "Checked" with
        # no reachable evidence is a bare assertion.
        payload = edition(stories=1, date="2026-08-02")
        payload["stories"][0] = self.cross_source_story()
        del payload["stories"][0]["evidence_url"]
        self.assertRejects(payload, "story fields must be exactly")

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

    def test_rejects_em_dashes_in_any_story_text(self):
        # Em dashes are the loudest AI tell in the copy (12 in the 2026-09-28
        # edition). Every reader-facing field goes through the same check.
        for field in ("title", "summary", "fact", "take", "caveat"):
            with self.subTest(field=field):
                payload = edition()
                payload["stories"][0][field] = payload["stories"][0][field] + " — and more 42."
                self.assertRejects(payload, "em dash")
        payload = edition()
        payload["editor_note"] = payload["editor_note"] + " — and more."
        self.assertRejects(payload, "em dash")

    def test_rejects_not_just_x_but_y(self):
        payload = edition()
        payload["stories"][0]["take"] = "I read the Ratchet news as a capital problem, not just a software one."
        self.assertRejects(payload, "not just")

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

    def test_keeps_committed_root_assets_untouched(self):
        """A stale daily-style mirror must never overwrite canonical root assets.

        This is the regression test for the drift class that #27, #33/#45, and
        #41 each fixed by hand-syncing the builder's daily/ mirror with merged
        root assets: the old build silently reverted the merged fix on the next
        publish until the mirror was re-synced by hand.

        Every name in builder.ASSETS is compared byte for byte. The earlier
        hand-spelled version asserted only app.js, styles.css and og-image.svg,
        which left og-image.png and apple-touch-icon.png completely unguarded:
        a build that copied valid-but-stale images over exactly those two kept
        the whole CI gate green. Stale mirror copies are real files, not
        corrupt ones, so the head's PNG-magic check does not catch them either.
        """
        self.write(edition())
        canonical = {name: (self.public / name).read_bytes() for name in builder.ASSETS}
        self.build()
        for name in builder.ASSETS:
            with self.subTest(asset=name):
                self.assertEqual((self.public / name).read_bytes(), canonical[name])

    def test_build_fails_loudly_when_a_root_asset_is_missing(self):
        """Checked for every canonical asset, not just one.

        Deleting only styles.css let the presence gate silently stop covering
        og-image.svg and both PNGs while the suite stayed green, so a missing
        share card or touch icon would have shipped to the live site instead of
        failing the build loudly.
        """
        for name in builder.ASSETS:
            with self.subTest(asset=name):
                self.write(edition())
                asset = self.public / name
                restore = asset.read_bytes()
                asset.unlink()
                try:
                    with self.assertRaisesRegex(FileNotFoundError, re.escape(name)):
                        self.build()
                finally:
                    asset.write_bytes(restore)


if __name__ == "__main__":
    unittest.main()
