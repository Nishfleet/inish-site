import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inish_daily import interests  # noqa: E402


class LoadTests(unittest.TestCase):
    def test_the_committed_file_is_valid(self):
        ids = [signal["id"] for signal in interests.load()]
        self.assertIn("github-stars", ids)
        self.assertIn("x-likes", ids)

    def test_rejects_an_unknown_type(self):
        with mock.patch.object(Path, "read_text", return_value='{"signals": [{"id": "a", "name": "A", "type": "myspace", "user": "x"}]}'):
            with self.assertRaises(ValueError):
                interests.load()


class CollectTests(unittest.TestCase):
    STARS = {"id": "github-stars", "name": "GitHub stars", "type": "github_stars", "user": "nish3451", "limit": 2}
    LIKES = {"id": "x-likes", "name": "X likes", "type": "x_likes", "user": "nish", "limit": 2}

    def test_an_empty_user_is_switched_off(self):
        lines, report, errors = interests.collect([{**self.LIKES, "user": ""}], env={})
        self.assertEqual((lines, report, errors), ([], [], []))

    def test_x_without_a_key_is_skipped_and_said(self):
        lines, report, errors = interests.collect([self.LIKES], env={})
        self.assertEqual(lines, [])
        self.assertEqual(report[0]["error"], "no key")
        self.assertIn("X_BEARER_TOKEN is not set", errors[0])

    def test_a_failing_signal_does_not_stop_the_others(self):
        with mock.patch.object(interests, "github_stars", side_effect=OSError("down")), \
                mock.patch.object(interests, "x_likes", return_value=["a liked post"]):
            lines, report, errors = interests.collect([self.STARS, self.LIKES], env={"X_BEARER_TOKEN": "t"})
        self.assertEqual(lines, ["a liked post"])
        self.assertEqual([r["error"] for r in report], ["OSError", None])
        self.assertEqual(errors, ["interests: github-stars: OSError"])

    def test_lines_are_capped(self):
        many = [f"repo{i}" for i in range(interests.MAX_LINES + 5)]
        with mock.patch.object(interests, "github_stars", return_value=many):
            lines, _report, _errors = interests.collect([self.STARS], env={})
        self.assertEqual(len(lines), interests.MAX_LINES)


class XLikesTests(unittest.TestCase):
    def test_reads_liked_posts_with_their_link_titles(self):
        calls = []

        def get(path, token):
            calls.append((path, token))
            if path.startswith("users/by/username/"):
                return {"data": {"id": "42"}}
            return {"data": [
                {"text": "this is  wild", "entities": {"urls": [{"expanded_url": "https://e.com/a", "title": "A launch"}]}},
                {"text": "plain post"},
                {"text": "dropped by the limit"},
            ]}

        lines = interests.x_likes("nish", 2, "t", get=get)
        self.assertEqual(lines, ["this is wild A launch", "plain post"])
        self.assertEqual(calls[0], ("users/by/username/nish", "t"))
        self.assertTrue(calls[1][0].startswith("users/42/liked_tweets?max_results=5"))


if __name__ == "__main__":
    unittest.main()
