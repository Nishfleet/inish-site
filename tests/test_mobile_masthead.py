"""Regression suite for the mobile masthead date.

The generated edition date (``.masthead-top span:nth-child(2)``) must stay
visible and readable at phone widths. A past layout hid it under
``@media (max-width: 820px)`` with ``display: none``; this suite pins the fix
as a static contract on the stylesheet so the defect cannot quietly return.

The site ships as static CSS-only (see MEMORY.md), so the contract is checked
by extracting the media-query blocks and rules from the stylesheet text and
asserting what they guarantee, mirroring the extractor pattern used by
DeployScriptContractTests. If the mobile layout drifts, these assertions fail
loudly instead of silently checking something else.

The same assertions can be aimed at another stylesheet with the
``MOBILE_MASTHEAD_STYLES`` environment variable, e.g. a temporary copy of
``origin/main:styles.css``, to prove the suite catches the defect on the base
revision and passes against the candidate.
"""

from __future__ import annotations

import os
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STYLES = ROOT / "styles.css"

MOBILE_QUERY = "max-width: 820px"
TINY_QUERY = "max-width: 400px"
MASTHEAD_TOP = ".masthead-top"
DATE_SPAN = ".masthead-top span:nth-child(2)"


def _stylesheet_text() -> str:
    """The stylesheet under test: $MOBILE_MASTHEAD_STYLES or the worktree one."""
    path = Path(os.environ.get("MOBILE_MASTHEAD_STYLES", str(DEFAULT_STYLES)))
    text = path.read_text()
    assert "masthead-top" in text, f"{path} does not look like the site stylesheet"
    return text


def _media_blocks(css: str) -> list[tuple[str, str]]:
    """Every ``@media (...) { ... }`` block as (query, body), in source order."""
    blocks: list[tuple[str, str]] = []
    for match in re.finditer(r"@media\s*\((.*?)\)\s*\{", css):
        start = match.end()
        depth = 1
        i = start
        while i < len(css) and depth:
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
            i += 1
        if depth == 0:
            blocks.append((match.group(1), css[start : i - 1]))
    return blocks


def _rule_body(block: str, selector: str) -> str | None:
    """The declarations of the first ``selector { ... }`` rule in a block."""
    match = re.search(re.escape(selector) + r"\s*\{([^{}]*)\}", block)
    return match.group(1) if match else None


class MobileMastheadContractTests(unittest.TestCase):
    """The edition date renders at 320-390px without overflow or clipping."""

    @classmethod
    def setUpClass(cls):
        cls.css = _stylesheet_text()
        blocks = _media_blocks(cls.css)
        cls.mobile_block = next((b for q, b in blocks if MOBILE_QUERY in q), None)
        cls.tiny_block = next((b for q, b in blocks if TINY_QUERY in q), None)

    def test_date_is_never_hidden_on_mobile(self):
        """The <=820px layout must not hide the edition date (the defect)."""
        self.assertIsNotNone(
            self.mobile_block, f"missing @media ({MOBILE_QUERY}) block"
        )
        date_rule = _rule_body(self.mobile_block, DATE_SPAN)
        if date_rule is not None:
            self.assertNotIn("display: none", date_rule)

    def test_mobile_grid_holds_all_three_masthead_facts(self):
        """<=820px uses three tracks: name | date | scanned/kept count."""
        self.assertIsNotNone(
            self.mobile_block, f"missing @media ({MOBILE_QUERY}) block"
        )
        masthead = _rule_body(self.mobile_block, MASTHEAD_TOP)
        self.assertIsNotNone(masthead, f"missing {MASTHEAD_TOP} rule in mobile block")
        self.assertIn("auto 1fr auto", masthead)

    def test_tiny_screens_wrap_date_to_its_own_row(self):
        """At <=400px the three facts cannot share one line, so the date spans
        its own full row and can neither overflow nor clip."""
        self.assertIsNotNone(
            self.tiny_block, f"missing @media ({TINY_QUERY}) block"
        )
        masthead = _rule_body(self.tiny_block, MASTHEAD_TOP)
        self.assertIsNotNone(masthead, f"missing {MASTHEAD_TOP} rule in tiny block")
        self.assertIn("1fr auto", masthead)
        date_rule = _rule_body(self.tiny_block, DATE_SPAN)
        self.assertIsNotNone(date_rule, f"missing {DATE_SPAN} rule in tiny block")
        self.assertIn("1 / -1", date_rule)
        self.assertIn("grid-row: 2", date_rule)


if __name__ == "__main__":
    unittest.main()
