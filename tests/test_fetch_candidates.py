"""Feed parsing for the candidate fetcher, fed real-shaped payloads offline."""

import io
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inish_daily import fetch_candidates  # noqa: E402

# Shape of https://www.reddit.com/r/<sub>/top/.rss: Atom, body in <content>, no <summary>.
REDDIT_ATOM = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>What would you pay for a tool that files GST for freelancers?</title>
    <link href="https://www.reddit.com/r/SaaS/comments/abc123/gst_tool/"/>
    <updated>2026-09-27T10:00:00+00:00</updated>
    <content type="html">&lt;div class="md"&gt;&lt;p&gt;I spend two days a quarter on this and would pay $20 a month.&lt;/p&gt;&lt;/div&gt;</content>
  </entry>
</feed>
"""

# Plain Atom with <summary> must keep working.
SUMMARY_ATOM = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Release notes</title>
    <link href="https://example.com/notes"/>
    <summary>Short summary wins over content.</summary>
    <content type="html">Long body.</content>
  </entry>
</feed>
"""


def parse(payload: bytes) -> list[dict]:
    with mock.patch.object(fetch_candidates.urllib.request, "urlopen", return_value=io.BytesIO(payload)):
        return fetch_candidates.feed("https://example.com/feed", "r/SaaS", "Demand signals", "independent")


class AtomFeedTests(unittest.TestCase):
    def test_atom_entry_without_summary_uses_content_as_description(self):
        (item,) = parse(REDDIT_ATOM)
        self.assertEqual(item["description"], "I spend two days a quarter on this and would pay $20 a month.")

    def test_atom_summary_is_preferred_when_present(self):
        (item,) = parse(SUMMARY_ATOM)
        self.assertEqual(item["description"], "Short summary wins over content.")


if __name__ == "__main__":
    unittest.main()
