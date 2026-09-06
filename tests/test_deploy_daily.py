"""Static regression guard for the daily deploy's Pages staging allowlist.

deploy_daily.sh stages a fixed set of root files into a temporary directory
before `wrangler pages deploy`. The built daily head (scripts/build_daily.py)
links https://inish.in/og-image.svg as og:image and /apple-touch-icon.png as
the touch icon, so both must ride the same explicit copy allowlist; an
omission ships a page whose metadata assets 404 in production.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_daily.sh"

# Root metadata assets the built head references; mirrors build_daily.py ASSETS.
REQUIRED_ROOT_ASSETS = ("og-image.svg", "apple-touch-icon.png")


def staging_allowlist(script: Path = SCRIPT) -> list:
    """Names on the script's single root-file staging cp line.

    Raises ValueError when the explicit copy line is missing, so a refactor
    that renames or drops the staging step also fails this guard loudly.
    """
    text = script.read_text()
    match = re.search(r"^cp (.+) \"\$PUBLIC_DIR/\"\s*$", text, re.MULTILINE)
    if match is None:
        raise ValueError("no explicit root-file staging cp line found")
    return [token.strip('"') for token in match.group(1).split() if not token.startswith("-")]


class DeployStagingAllowlistTests(unittest.TestCase):
    def test_root_metadata_assets_are_staged_for_pages(self):
        # Omitting either asset from the allowlist means the deployed index.html
        # advertises metadata URLs that Cloudflare Pages answers with 404.
        for asset in REQUIRED_ROOT_ASSETS:
            self.assertIn(asset, staging_allowlist())

    def test_staging_stays_an_explicit_allowlist(self):
        # The guard must not be satisfiable by copying the whole checkout:
        # the staging line lists individual root files only.
        allowlist = staging_allowlist()
        for broad_pattern in (".", "..", "*"):
            self.assertNotIn(broad_pattern, allowlist)


if __name__ == "__main__":
    unittest.main()
