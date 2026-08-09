"""The edition date must stay visible in the mobile masthead.

Regression for the two-row mobile masthead: at 320-390px the date used to be
hidden with `display: none` inside the @media (max-width: 820px) block. This
test reads the stylesheet statically (stdlib only, no browser) and fails on
any max-width media query that still hides or abandons the date span.

Point MOBILE_MASTHEAD_STYLES at another stylesheet to check it, e.g.:
  MOBILE_MASTHEAD_STYLES=/tmp/main.css python3 -m unittest tests.test_mobile_masthead -v
"""

import os
import re
import unittest
from pathlib import Path

STYLES = Path(
    os.environ.get("MOBILE_MASTHEAD_STYLES", Path(__file__).resolve().parents[1] / "styles.css")
)


def top_level_blocks(css):
    """Split CSS into (header, body) pairs for every top-level {...} rule."""
    blocks = []
    i = 0
    while i < len(css):
        brace = css.find("{", i)
        if brace == -1:
            break
        header = css[i:brace].strip()
        depth = 1
        j = brace + 1
        while j < len(css) and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        blocks.append((header, css[brace + 1 : j - 1]))
        i = j
    return blocks


def mobile_date_rules(css):
    """Rules targeting the date span inside any max-width <= 820px media query."""
    rules = []
    for header, body in top_level_blocks(css):
        if not header.startswith("@media"):
            continue
        widths = [float(w) for w in re.findall(r"max-width:\s*([0-9.]+)px", header)]
        if widths and max(widths) <= 820:
            for rule_header, rule_body in top_level_blocks(body):
                if "masthead-top" in rule_header and "nth-child(2)" in rule_header:
                    rules.append((rule_header, rule_body))
    return rules


class MobileMastheadTests(unittest.TestCase):
    def test_mobile_masthead_does_not_hide_the_edition_date(self):
        self.assertTrue(STYLES.is_file(), f"styles not found at {STYLES}")
        rules = mobile_date_rules(STYLES.read_text())
        self.assertTrue(
            rules, "no max-width media query (<= 820px) styles the edition date span"
        )
        for header, body in rules:
            with self.subTest(rule=header):
                self.assertIsNone(
                    re.search(r"display\s*:\s*none", body),
                    f"{header} hides the edition date with display: none",
                )


if __name__ == "__main__":
    unittest.main()
