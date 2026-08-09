"""Regression test: the generated edition date stays visible in the mobile
masthead (320-390px) as a deliberate full-width dateline, and the desktop
masthead keeps its three-column layout.

Defaults to the worktree styles.css. Set MOBILE_MASTHEAD_STYLES to point the
same assertions at another stylesheet, e.g. a temporary copy of
origin/main:styles.css to prove the defect the candidate fixes.
"""

import os
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STYLES_PATH = Path(
    os.environ.get("MOBILE_MASTHEAD_STYLES", str(REPO_ROOT / "styles.css"))
)

DATE_SELECTOR = ".masthead-top span:nth-child(2)"
COUNT_SELECTOR = ".masthead-top span:last-child"


def _css():
    return STYLES_PATH.read_text(encoding="utf-8")


def _media_block(css, max_width):
    """Body of the `@media (max-width: Xpx)` block, brace-balanced, or None."""
    match = re.search(
        r"@media\s*\(max-width:\s*" + str(max_width) + r"px\)\s*\{", css
    )
    if not match:
        return None
    depth = 1
    end = match.end()
    while end < len(css) and depth:
        if css[end] == "{":
            depth += 1
        elif css[end] == "}":
            depth -= 1
        end += 1
    return css[match.end() : end - 1]


def _rule(css, selector):
    """Declaration block of the first rule whose selector is exactly
    `selector` (plus whitespace), or None."""
    match = re.search(re.escape(selector) + r"\s*\{([^{}]*)\}", css)
    return match.group(1) if match else None


def _normalize(declarations):
    return re.sub(r"\s+", " ", declarations)


class MobileMastheadRegressionTests(unittest.TestCase):
    def test_generated_date_is_never_hidden(self):
        date_rule = _rule(_css(), DATE_SELECTOR)
        self.assertIsNotNone(date_rule, "no rule styles the generated date span")
        self.assertNotIn(
            "display", _normalize(date_rule), "the date must never be display:none"
        )

    def test_mobile_date_is_a_deliberate_full_width_line(self):
        mobile = _media_block(_css(), 820)
        self.assertIsNotNone(mobile, "missing @media (max-width: 820px) block")
        date_rule = _normalize(_rule(mobile, DATE_SELECTOR))
        self.assertIsNotNone(date_rule)
        self.assertIn("grid-column: 1 / -1", date_rule)
        self.assertIn("grid-row: 2", date_rule)

    def test_mobile_keeps_site_and_count_opposing_anchors(self):
        mobile = _media_block(_css(), 820)
        self.assertIsNotNone(mobile, "missing @media (max-width: 820px) block")
        masthead_rule = _normalize(_rule(mobile, ".masthead-top"))
        self.assertIsNotNone(masthead_rule)
        self.assertIn("grid-template-columns: 1fr 1fr", masthead_rule)
        count_rule = _normalize(_rule(_css(), COUNT_SELECTOR))
        self.assertIsNotNone(count_rule)
        self.assertIn("text-align: right", count_rule)

    def test_desktop_masthead_layout_is_unchanged(self):
        desktop_rule = _normalize(_rule(_css(), ".masthead-top"))
        self.assertIsNotNone(desktop_rule)
        self.assertIn("grid-template-columns: 1fr auto 1fr", desktop_rule)


if __name__ == "__main__":
    unittest.main()
