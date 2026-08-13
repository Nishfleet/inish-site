import json
import os
import re
import shutil
import subprocess
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


# ---- Behavioral rollback fixture --------------------------------------------
# The exhausted-live-verification rollback test runs the real deploy_daily.sh
# against a hermetic git fixture with every external command stubbed on PATH,
# then asserts on the ordered command log the script actually executes.
ACCEPTED_EDITION = "2026-08-13"  # the edition this deploy publishes
LIVE_EDITION = "2026-08-12"  # the edition live before the deploy
PRE_DEPLOY_VERSION_ID = "v-9f8e7d6c5b4a3210"  # the version serving 100% pre-deploy

# Every payload file deploy_daily.sh copies from the snapshot (plus the fonts
# directory, worker.js and wrangler.jsonc), minimal but real enough for the
# script's own preflight to run.
FIXTURE_PAYLOAD_FILES = (
    "index.html", "404.html", "app.js", "styles.css",
    "og-image.svg", "og-image.png", "apple-touch-icon.png", "latest.json", "feed.xml",
    "robots.txt", "sitemap.xml", "_redirects",
)

NPX_STUB = """#!/usr/bin/env bash
# Stub npx: the script always invokes "npx --yes <cmd> ..."; drop the flag and
# exec the wrapped command straight from PATH so the wrangler stub executes.
if [[ "${1:-}" == "--yes" ]]; then
  shift
fi
exec "$@"
"""

WRANGLER_STUB = """#!/usr/bin/env bash
# Stub wrangler: record every invocation, then answer deterministically:
# deployments list reports the pre-deploy version at 100%; deploy and rollback
# succeed. Any other subcommand fails loudly so drift surfaces in the log.
printf 'cmd:wrangler %s\\n' "$*" >>"$COMMAND_LOG"
case "${1:-}" in
  deployments)
    printf '%s\\n' '[{"id":"deploy-1","versions":[{"percentage":100,"version_id":"__PRE_DEPLOY_VERSION_ID__"}]}]'
    exit 0
    ;;
  deploy)
    exit 0
    ;;
  rollback)
    exit 0
    ;;
  *)
    printf 'unexpected wrangler invocation: %s\\n' "$*" >>"$COMMAND_LOG"
    exit 1
    ;;
esac
"""

CURL_STUB = """#!/usr/bin/env bash
# Stub curl: the freshness gate reads the live edition from a fixture file.
cat "$LIVE_LATEST_JSON"
exit 0
"""

SLEEP_STUB = """#!/usr/bin/env bash
# Stub sleep: the verification loop keeps its real twelve-attempt exhaustion
# and the deploy retry keeps its real bounds, but no test wall-clock time is
# spent on the 5s/20s pacing sleeps.
exit 0
"""

HERMES_STUB = """#!/usr/bin/env bash
# Stub hermes: record any success notification. The rollback path must never
# send one, so the test asserts the log has no hermes line.
printf 'cmd:hermes %s\\n' "$*" >>"$COMMAND_LOG"
exit 0
"""

VERIFY_STUB = '''#!/usr/bin/env python3
"""Stub scripts/verify_live.py for the behavioral rollback test.

The deployed (accepted) edition never becomes live, so every verification
attempt for it fails and the loop exhausts; the pre-deploy identity alone
verifies, so the post-rollback re-verification of the restored version
succeeds. Every call is recorded in the shared command log.
"""
import argparse
import os
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--root")
parser.add_argument("--edition-date")
parser.add_argument("--commit")
args = parser.parse_args()

with open(os.environ["COMMAND_LOG"], "a") as log:
    log.write("cmd:verify_live edition=%s commit=%s\\n" % (args.edition_date, args.commit))

if args.edition_date == os.environ["LIVE_EDITION_DATE"]:
    print("verified live edition %s (commit %s)" % (args.edition_date, args.commit))
    sys.exit(0)
print("verify_live stage: edition %s (commit %s) is not live" % (args.edition_date, args.commit))
sys.exit(1)
'''


def _git(cwd: Path, *args: str) -> str:
    """Run git in a fixture repo with a fixed identity; return stdout."""
    result = subprocess.run(
        ["git", "-C", str(cwd), "-c", "user.name=Fixture", "-c", "user.email=fixture@inish.in", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def fixture_payload(tree: Path, edition: str, story_count: int) -> None:
    """Write the minimal origin/main tree deploy_daily.sh needs to publish."""
    for name in FIXTURE_PAYLOAD_FILES:
        (tree / name).write_text(f"{name} fixture for edition {edition}\n")
    fonts = tree / "fonts"
    fonts.mkdir(exist_ok=True)
    (fonts / "fixture.woff2").write_text("fixture font\n")
    (tree / "worker.js").write_text('export default { async fetch() { return new Response("fixture"); } };\n')
    (tree / "wrangler.jsonc").write_text('{ "name": "inish-site" }\n')
    (tree / "latest.json").write_text(
        json.dumps({"date": edition, "stories": [{"title": f"story {i}"} for i in range(story_count)]}, indent=2) + "\n"
    )


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

    def test_exhausted_verification_rolls_back_exactly_once_and_reverifies(self):
        # Behavioral replacement for the former source-string rollback tests:
        # run the real deploy_daily.sh against a hermetic fixture where the
        # provider is fully stubbed, and assert on the ordered command log the
        # exhausted-live-verification path actually executes. Short-circuiting
        # or deleting the rollback (or the twelve-attempt exhaustion) makes
        # this test red.
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            stubbin = tmp / "stubbin"
            origin = tmp / "origin.git"
            work = tmp / "work"
            run = tmp / "run"
            command_log = tmp / "commands.log"
            live_feed = tmp / "live-latest.json"

            # A hermetic origin/main: the accepted edition on top of the live
            # edition, published with the exact commit message the script's
            # pre-deploy commit lookup greps for.
            _git(tmp, "init", "--bare", "-b", "main", str(origin))
            _git(tmp, "clone", str(origin), str(work))
            fixture_payload(work, LIVE_EDITION, 2)
            _git(work, "add", "-A")
            _git(work, "commit", "-m", f"daily: publish {LIVE_EDITION}")
            pre_deploy_commit = _git(work, "rev-parse", "HEAD").strip()
            fixture_payload(work, ACCEPTED_EDITION, 3)
            _git(work, "add", "-A")
            _git(work, "commit", "-m", f"daily: publish {ACCEPTED_EDITION}")
            accepted_commit = _git(work, "rev-parse", "HEAD").strip()
            _git(work, "push", "-u", "origin", "main")

            # The run checkout carries the real deploy script plus the verify
            # stub that only the pre-deploy identity can satisfy.
            _git(tmp, "clone", str(origin), str(run))
            (run / "scripts").mkdir()
            shutil.copyfile(DEPLOY_SCRIPT, run / "scripts" / "deploy_daily.sh")
            (run / "scripts" / "deploy_daily.sh").chmod(0o755)
            (run / "scripts" / "verify_live.py").write_text(VERIFY_STUB)

            # Stub every external command the script can reach.
            stubbin.mkdir()
            for name, body in {
                "npx": NPX_STUB,
                "wrangler": WRANGLER_STUB.replace("__PRE_DEPLOY_VERSION_ID__", PRE_DEPLOY_VERSION_ID),
                "curl": CURL_STUB,
                "sleep": SLEEP_STUB,
                "hermes": HERMES_STUB,
            }.items():
                stub = stubbin / name
                stub.write_text(body)
                stub.chmod(0o755)

            # The live hostname serves the pre-deploy edition: a newer live
            # edition would trip the freshness gate before the deploy starts.
            live_feed.write_text(
                json.dumps({"date": LIVE_EDITION, "stories": [{"title": "live"}]}) + "\n"
            )

            env = os.environ.copy()
            env["PATH"] = f"{stubbin}:{env['PATH']}"
            env["CLOUDFLARE_API_TOKEN"] = "fixture-token; provider is stubbed"
            env["COMMAND_LOG"] = str(command_log)
            env["LIVE_LATEST_JSON"] = str(live_feed)
            env["LIVE_EDITION_DATE"] = LIVE_EDITION
            result = subprocess.run(
                [str(run / "scripts" / "deploy_daily.sh")],
                cwd=str(run),
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
            )

            output = result.stdout + result.stderr
            self.assertEqual(result.returncode, 1, output)
            commands = command_log.read_text().splitlines()

            captures = [c for c in commands if c.startswith("cmd:wrangler deployments ")]
            deploys = [c for c in commands if c.startswith("cmd:wrangler deploy ")]
            exhausted = [
                c for c in commands
                if c == f"cmd:verify_live edition={ACCEPTED_EDITION} commit={accepted_commit}"
            ]
            rollbacks = [
                c for c in commands
                if c == f"cmd:wrangler rollback {PRE_DEPLOY_VERSION_ID} --name inish-site"
            ]
            restored = [
                c for c in commands
                if c == f"cmd:verify_live edition={LIVE_EDITION} commit={pre_deploy_commit}"
            ]

            self.assertEqual(len(captures), 1, commands)
            self.assertEqual(len(deploys), 1, commands)
            self.assertEqual(len(exhausted), 12, commands)
            self.assertEqual(len(rollbacks), 1, commands)
            self.assertEqual(len(restored), 1, commands)
            # Order: pre-deploy capture -> deploy -> all twelve exhausted
            # verifications -> exactly one rollback -> restored-identity
            # re-verification. No success notification may be sent.
            self.assertLess(commands.index(captures[0]), commands.index(deploys[0]))
            self.assertLess(commands.index(deploys[0]), commands.index(exhausted[0]))
            self.assertLess(commands.index(exhausted[-1]), commands.index(rollbacks[0]))
            self.assertLess(commands.index(rollbacks[0]), commands.index(restored[0]))
            self.assertEqual([c for c in commands if c.startswith("cmd:hermes")], [])
            for needle in (
                f"rollback_target: version {PRE_DEPLOY_VERSION_ID} currently serves worker inish-site",
                "rolled_back: worker inish-site restored to version",
                "rollback_restored: worker inish-site is verified live on version",
                "it is NOT confirmed live.",
            ):
                self.assertIn(needle, output)

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
