import re
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"
BUILD_SCRIPT = ROOT / "scripts" / "build_daily.py"
WORKER = ROOT / "worker.js"
MIDDLEWARE = ROOT / "functions" / "_middleware.js"
WRANGLER = ROOT / "wrangler.jsonc"

# Root static assets referenced by the generated head: the raster social share
# card (og:image / twitter:image), its legacy SVG source, and the iOS
# home-screen icon. All are pinned at the repo root and must ride in every
# temporary deploy payload.
SHARE_CARD = "og-image.svg"
RASTER_SHARE_CARD = "og-image.png"
HOME_SCREEN_ICON = "apple-touch-icon.png"

# The deploy script copies the root files into the payload from SNAPSHOT_ROOT
# on lines ending with "$PUBLIC_DIR/". The line may wrap with trailing
# backslashes, and the directory copies (`cp -R`) are separate lines.
ROOT_COPY_LINE = re.compile(
    r'^cp (?:\"\$SNAPSHOT_ROOT/([A-Za-z0-9._-]+)\"\s+)+\"\$PUBLIC_DIR/\"$',
    re.MULTILINE,
)

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
    return re.findall(r'\"\$SNAPSHOT_ROOT/([A-Za-z0-9._-]+)\"', matches[0].group(0))


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

    def test_payload_explicitly_carries_the_share_cards_and_home_screen_icon(self):
        payload = payload_root_files()
        for name in (SHARE_CARD, RASTER_SHARE_CARD, HOME_SCREEN_ICON):
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
        # cannot leak local files into the deploy or block it on a branch gate.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("git fetch --quiet origin main", script)
        self.assertIn('ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"', script)
        self.assertIn("git archive --format=tar FETCH_HEAD", script)
        self.assertIn('--root "$SNAPSHOT_ROOT"', script)
        # Every static root file must be copied from the snapshot path, never CWD.
        self.assertIn('"$SNAPSHOT_ROOT/index.html"', script)
        self.assertIn('"$SNAPSHOT_ROOT/latest.json"', script)
        self.assertNotRegex(
            script,
            r'^cp (?!.*\$SNAPSHOT_ROOT)(?!-R ).*index\.html',
            msg="root copy must not fall back to workdir-relative paths",
        )

    def test_deploy_uses_workers_not_pages(self):
        # Pages:Edit is unavailable on the fleet token; Workers deploy is the
        # path that can actually put origin/main on inish.in.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("wrangler deploy", script)
        self.assertNotIn("pages deploy", script)
        self.assertTrue(WORKER.is_file(), "worker.js must exist at the repo root")
        self.assertTrue(WRANGLER.is_file(), "wrangler.jsonc must exist at the repo root")
        wrangler = WRANGLER.read_text()
        self.assertIn('"inish.in"', wrangler)
        self.assertIn('"inish.in/*"', wrangler)
        self.assertIn('"ASSETS"', wrangler)

    def test_worker_and_pages_middleware_share_the_route_contract(self):
        # Keep the two edge sources honest: allowlist, redirects, HSTS string.
        worker = WORKER.read_text()
        middleware = MIDDLEWARE.read_text()
        for needle in (
            '"/og-image.svg"',
            '"/og-image.png"',
            '"/apple-touch-icon.png"',
            'max-age=31536000; includeSubDomains',
            "!publicPaths.has(url.pathname) && !fontPath.test(url.pathname)",
            '["/daily", "/"]',
        ):
            self.assertIn(needle, worker)
            self.assertIn(needle, middleware)

    def test_deploy_loads_fleet_token_when_env_is_empty(self):
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("/home/nish/.config/fleet-console/cf.env", script)
        self.assertIn("CLOUDFLARE_API_TOKEN", script)

    def test_deploy_refuses_to_roll_live_back_to_an_older_edition(self):
        # The freshness gate: the accepted edition may be older than today only
        # when it is still newer than what the live hostname serves (recovery
        # deploy); publishing content older than live must fail loudly.
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

    def test_deploy_relocates_caches_away_from_read_only_home_dirs(self):
        # The VPS hits recurring read-only-FS episodes where ~/.npm and
        # ~/.wrangler/logs return EROFS; a deploy that cannot write its own
        # caches strands the accepted edition until the next run. The wrapper
        # must fall back to per-run temp locations before invoking wrangler.
        script = DEPLOY_SCRIPT.read_text()
        deploy_pos = script.index("wrangler deploy")
        for env, fallback in (
            ("npm_config_cache", "$WORK_DIR/npm-cache"),
            ("WRANGLER_LOG_PATH", "$WORK_DIR/wrangler-logs"),
        ):
            self.assertIn(env, script)
            self.assertIn(fallback, script)
            self.assertLess(script.index(env), deploy_pos, f"{env} must be set before the deploy")
            self.assertLess(script.index(fallback), deploy_pos, f"{fallback} must be staged before the deploy")

    def test_deploy_retries_transient_failures(self):
        # A failed deploy is not otherwise retried until the next daily run, so
        # the accepted edition waits a day on a transient failure. The wrapper
        # must retry the same payload a bounded number of times before failing
        # loudly, and the freshness gate must still reject rollbacks.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("DEPLOY_ATTEMPTS=3", script)
        self.assertIn("wrangler deploy", script)
        self.assertIn("retrying in 20 seconds", script)
        self.assertIn("sleep 20", script)
        self.assertIn('[[ "$EDITION_DATE" < "$LIVE_EDITION_DATE" ]]', script)
        self.assertIn("Refusing to roll the live site back", script)

    # The deploy loop line is "npx --yes wrangler deploy \" + newline; the
    # plain substring "wrangler deploy" also prefixes "wrangler deployments
    # list", so the loop position must use the backslash-newline form.
    DEPLOY_LOOP_LINE = 'wrangler deploy \\\n'

    def test_verification_failure_rolls_back_to_the_captured_predeploy_version(self):
        # A successful-but-bad publish (wrong bytes, wrong identity, broken
        # routing) is not protected by the deploy retry loop: the wrapper must
        # capture the version serving 100% of traffic BEFORE deploying, then on
        # exhausted live verification restore exactly that version with
        # `wrangler rollback <VERSION_ID> --name inish-site`.
        script = DEPLOY_SCRIPT.read_text()
        self.assertIn("wrangler deployments list --name inish-site --json", script)
        self.assertIn('PRE_DEPLOY_VERSION="$(', script)
        capture_pos = script.index("wrangler deployments list")
        deploy_pos = script.index(self.DEPLOY_LOOP_LINE)
        self.assertLess(
            capture_pos, deploy_pos,
            "the pre-deploy version must be captured before wrangler deploy runs",
        )
        # The rollback must target the exact captured version id, never a
        # literal or a different variable.
        self.assertIn(
            'npx --yes wrangler rollback "$PRE_DEPLOY_VERSION" --name inish-site',
            script,
        )
        rollback_pos = script.index("npx --yes wrangler rollback")
        self.assertLess(
            deploy_pos, rollback_pos,
            "rollback must come after the deploy",
        )
        self.assertLess(
            script.index("failed live verification"), rollback_pos,
            "rollback must be the response to the twelve-attempt verification loop exhausting",
        )

    def test_restored_live_identity_is_reverified_after_rollback(self):
        # The rollback must prove the restoration with the same verification
        # path the deploy uses (verify_live.py), pointed at the pre-deploy
        # identity — never a lighter second probe — and report the restored
        # outcome in the output.
        script = DEPLOY_SCRIPT.read_text()
        verify_count = script.count("python3 scripts/verify_live.py")
        self.assertGreaterEqual(
            verify_count, 2,
            "the restored identity must be re-verified with the same verification path",
        )
        rollback_pos = script.index('npx --yes wrangler rollback "$PRE_DEPLOY_VERSION"')
        self.assertLess(
            rollback_pos, script.rfind("python3 scripts/verify_live.py"),
            "the restored live identity must be re-verified after the rollback",
        )
        # The re-verification targets the pre-deploy edition (the date that was
        # live before publishing and the commit that published it), not the
        # accepted edition.
        self.assertIn('--edition-date "$LIVE_EDITION_DATE"', script)
        self.assertIn('--commit "$PRE_DEPLOY_COMMIT"', script)
        self.assertIn("rollback_restored", script)

    def test_deploy_is_not_attempted_when_the_predeploy_version_cannot_be_captured(self):
        # An unreversible deploy must not start: if the version currently
        # serving inish-site cannot be determined, the script fails loudly
        # BEFORE wrangler deploy runs, never publishing without a rollback
        # target.
        script = DEPLOY_SCRIPT.read_text()
        guard = "cannot determine the pre-deploy version of worker inish-site"
        self.assertIn(guard, script)
        self.assertIn('if [[ -z "$PRE_DEPLOY_VERSION" ]]', script)
        guard_pos = script.index(guard)
        deploy_pos = script.index(self.DEPLOY_LOOP_LINE)
        self.assertLess(
            guard_pos, deploy_pos,
            "the capture guard must fail before wrangler deploy runs",
        )


if __name__ == "__main__":
    unittest.main()
