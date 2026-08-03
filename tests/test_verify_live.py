import unittest

from scripts.verify_live import without_cloudflare_beacon


class VerifyLiveTests(unittest.TestCase):
    def test_removes_one_cloudflare_analytics_beacon(self):
        original = b"<html>\n<body>\n<p>feed</p>\n</body>\n</html>\n"
        beacon = (
            b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123" '
            b'integrity="sha512-YWJjZA==" data-cf-beacon=\'{"token":"public"}\' crossorigin="anonymous"></script>\n'
        )
        live = original.replace(b"</body>", beacon + b"</body>")
        self.assertEqual(without_cloudflare_beacon(live), original)

    def test_leaves_other_scripts_untouched(self):
        body = b'<script src="https://example.com/app.js"></script>\n'
        self.assertEqual(without_cloudflare_beacon(body), body)

    def test_does_not_hide_malformed_beacon_content(self):
        body = (
            b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123">'
            b'<p>unexpected content</p></script>\n'
        )
        self.assertEqual(without_cloudflare_beacon(body), body)


if __name__ == "__main__":
    unittest.main()
