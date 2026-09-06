import unittest
from pathlib import Path


class DeployDailyStagingContractTests(unittest.TestCase):
    """The daily Pages payload is staged from an explicit allowlist, never a
    broad repository copy, and the list must keep every root asset the
    generated head references (og-image.svg and apple-touch-icon.png). Losing
    either one silently breaks the social share card or the iOS home-screen
    icon on the live hostname."""

    SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "deploy_daily.sh"

    @classmethod
    def staging_lines(cls):
        return [line for line in cls.SCRIPT.read_text().splitlines() if '"$PUBLIC_DIR/"' in line]

    @classmethod
    def flat_staging_line(cls):
        lines = [line for line in cls.staging_lines() if not line.lstrip().startswith("cp -R")]
        if len(lines) != 1:
            raise AssertionError(f"expected exactly one flat-file staging line, found {len(lines)}")
        return lines[0]

    def test_staging_allowlist_ships_both_head_referenced_assets(self):
        words = self.flat_staging_line().split()
        for asset in ("og-image.svg", "apple-touch-icon.png"):
            self.assertIn(asset, words)

    def test_staging_line_is_named_files_not_a_glob(self):
        self.assertNotIn("*", self.flat_staging_line())

    def test_directory_copies_cover_only_fonts_and_functions(self):
        directories = [line.split()[2] for line in self.staging_lines() if line.lstrip().startswith("cp -R")]
        self.assertEqual(sorted(directories), ["fonts", "functions"])


if __name__ == "__main__":
    unittest.main()
