import sys
import unittest
import urllib.parse
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inish_daily import interests  # noqa: E402


class LoadTests(unittest.TestCase):
    def test_the_committed_file_is_valid(self):
        ids = [signal["id"] for signal in interests.load()]
        self.assertIn("github-stars", ids)
        self.assertIn("x-posts", ids)

    def test_rejects_an_unknown_type(self):
        with mock.patch.object(Path, "read_text", return_value='{"signals": [{"id": "a", "name": "A", "type": "myspace", "user": "x"}]}'):
            with self.assertRaises(ValueError):
                interests.load()


class CollectTests(unittest.TestCase):
    STARS = {"id": "github-stars", "name": "GitHub stars", "type": "github_stars", "user": "nish3451", "limit": 2}
    POSTS = {"id": "x-posts", "name": "X posts", "type": "x_posts", "user": "nish", "limit": 2}

    def test_an_empty_user_is_switched_off(self):
        self.assertEqual(interests.collect([{**self.POSTS, "user": ""}]), ([], [], []))

    def test_a_failing_signal_does_not_stop_the_others(self):
        with mock.patch.object(interests, "github_stars", side_effect=OSError("down")), \
                mock.patch.object(interests, "x_posts", return_value=["a post"]):
            lines, report, errors = interests.collect([self.STARS, self.POSTS])
        self.assertEqual(lines, ["a post"])
        self.assertEqual([r["error"] for r in report], ["OSError: down", None])
        self.assertEqual(errors, ["interests: github-stars: OSError: down"])

    def test_lines_are_capped(self):
        many = [f"repo{i}" for i in range(interests.MAX_LINES + 5)]
        with mock.patch.object(interests, "github_stars", return_value=many):
            lines, _report, _errors = interests.collect([self.STARS])
        self.assertEqual(len(lines), interests.MAX_LINES)


SYNDICATION = """<html><script id="__NEXT_DATA__" type="application/json">{"props": {"pageProps": {"timeline": {"entries": [
{"content": {"tweet": {"full_text": "this is  wild", "entities": {"urls": [{"expanded_url": "https://e.com/a"}]}}}},
{"content": {"tweet": {"text": "plain post"}}},
{"content": {"tweet": {"full_text": "dropped by the limit"}}}
]}}}}</script></html>"""

RSS = """<?xml version="1.0"?><rss><channel>
<item><title>RT by @nish: agents that run overnight</title></item>
<item><title>a &amp;quot;quoted&amp;quot; take</title></item>
</channel></rss>"""


class XPostsTests(unittest.TestCase):
    def test_reads_the_embed_timeline_first(self):
        seen = []

        def fetch(url):
            seen.append(url)
            return SYNDICATION

        self.assertEqual(interests.x_posts("nish", 2, fetch=fetch), ["this is wild https://e.com/a", "plain post"])
        self.assertEqual(seen, ["https://syndication.twitter.com/srv/timeline-profile/screen-name/nish"])

    def test_falls_back_to_a_mirror_when_x_says_nothing(self):
        def fetch(url):
            host = urllib.parse.urlsplit(url).hostname
            if host == "syndication.twitter.com":
                return "<html>rate limited</html>"
            if host == "nitter.net":
                raise OSError("down")
            return RSS

        self.assertEqual(interests.x_posts("nish", 5, fetch=fetch), ["RT by @nish: agents that run overnight", 'a "quoted" take'])

    def test_says_why_when_every_reader_fails(self):
        with self.assertRaises(RuntimeError) as caught:
            interests.x_posts("nish", 5, fetch=lambda url: "<html></html>")
        self.assertIn("empty", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
