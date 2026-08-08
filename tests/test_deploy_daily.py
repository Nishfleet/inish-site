import re
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"
BUILD_SCRIPT = ROOT / "scripts" / "build_daily.py"

# Root static assets referenced by the generated head: the social share card
# (og:image / twitter:image) and the iOS home-screen icon. Both are pinned at
# the repo root and must ride in every temporary deploy payload.
SHARE_CARD = "og-image.svg"
HOME_SCREEN_ICON = "apple-touch-icon.png"

# The deploy script copies the root files into the payload on one line ending
# with "$PUBLIC_DIR/". The line may wrap with trailing backslashes, and the
# directory copies (`cp -R`) are separate lines.
ROOT_COPY_LINE = re.compile(r'^cp (?!-R )((?:[A-Za-z0-9._-]+ +)+)"\$PUBLIC_DIR/"$', re.MULTILINE)

# Every asset the generated head points at, rendered by build_daily.py as
# content="https://inish.in/path" or href="/path".
HEAD_ASSET = re.compile(r'(?:content|href)="(?:https://inish\.in)?(/[A-Za-z0-9._/-]+)"')


def payload_root_files() -> list[str]:
    """The root-file allowlist deploy_daily.sh copies into the payload."""
    script = DEPLOY_SCRIPT.read_text().replace("\\\n", " ")
    matches = list(ROOT_COPY_LINE.finditer(script))
    if len(matches) != 1:
        raise AssertionError(
            f"expected exactly one root-file cp line in {DEPLOY_SCRIPT}, found {len(matches)}"
        )
    return matches[0].group(1).split()


def head_root_assets() -> set[str]:
    """Root-level files the generated head references (fonts/ ships as a directory)."""
    source = BUILD_SCRIPT.read_text()
    head, _, _ = source.partition("</head>")
    return {
        match.group(1).lstrip("/")
        for match in HEAD_ASSET.finditer(head)
        if match.group(1).count("/") == 1
    }


class DeployDailyTests(unittest.TestCase):
    def test_payload_covers_every_root_asset_the_head_references(self):
        missing = sorted(head_root_assets() - set(payload_root_files()))
        self.assertEqual(
            missing,
            [],
            "deploy payload omits root assets referenced by the rendered head: "
            f"{missing}; deploy_daily.sh and build_daily.py must agree",
        )

    def test_payload_explicitly_carries_the_share_card_and_home_screen_icon(self):
        payload = payload_root_files()
        for name in (SHARE_CARD, HOME_SCREEN_ICON):
            self.assertIn(name, payload, f"deploy payload must include root {name}")

    def test_allowlist_names_only_files_that_exist_at_the_root(self):
        for name in payload_root_files():
            self.assertTrue((ROOT / name).is_file(), f"allowlist names a missing root file: {name}")

    def test_temporary_payload_contains_the_head_assets(self):
        # Mirror the script's payload build for the root files and confirm the
        # temporary deploy payload really ends up with the required assets.
        with tempfile.TemporaryDirectory() as tmp:
            payload = Path(tmp)
            for name in payload_root_files():
                shutil.copyfile(ROOT / name, payload / name)
            required = head_root_assets() | {SHARE_CARD, HOME_SCREEN_ICON}
            for name in sorted(required):
                self.assertTrue((payload / name).is_file(), f"payload missing {name}")

    def test_payload_comes_from_an_origin_main_snapshot_not_the_workdir(self):
        # The deploy contract: the payload and the verifier read a pristine
        # origin/main snapshot, so a publisher workdir left on a topic branch
        # (which previously stalled live delivery for days) cannot leak local
        # files into the deploy or block it on a branch gate.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("git fetch --quiet origin main", script)
        self.assertIn('ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"', script)
        self.assertIn("git archive --format=tar FETCH_HEAD", script)
        self.assertIn('--root "$SNAPSHOT_ROOT"', script)

    def test_deploy_refuses_to_roll_live_back_to_an_older_edition(self):
        # The freshness gate: the accepted edition may be older than today only
        # when it is still newer than what the live hostname serves (recovery
        # deploy); publishing content older than live must fail loudly. The old
        # "edition date must equal today" gate is gone because it blocked the
        # recovery deploy entirely.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn('LIVE_EDITION_DATE="$(curl -fsS --max-time 15 https://inish.in/latest.json | jq -er \'.date\')"', script)
        self.assertIn('[[ "$EDITION_DATE" < "$LIVE_EDITION_DATE" ]]', script)
        self.assertIn("Refusing to roll the live site back", script)
        self.assertNotIn("Refusing to publish stale edition", script)

    def test_fail_loudly_behaviour_is_kept(self):
        # A stale or mismatched live hostname still fails with a named stage,
        # no Telegram notification, and the accepted edition left untouched.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("the accepted edition failed live verification. Failing stage:", script)
        self.assertIn("it is NOT confirmed live.", script)


if __name__ == "__main__":
    unittest.main()
