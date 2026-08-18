import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK_SCRIPT = ROOT / "scripts" / "check_live_current.sh"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"
RUNNER_SCRIPT = ROOT / "scripts" / "run_live_current_check.sh"
UNIT = ROOT / "install" / "live-current-check.service"
TIMER = ROOT / "install" / "live-current-check.timer"


class CheckLiveCurrentTests(unittest.TestCase):
    """The deploy-free staleness check must share deploy_daily.sh's snapshot
    machinery, run the full live verifier, and never deploy or read tokens —
    otherwise a scheduled check could claim parity against a dirty workdir or
    drift from the deploy contract it exists to catch."""

    def test_check_reads_a_pristine_origin_main_snapshot_not_the_workdir(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("git fetch --quiet origin main", script)
        self.assertIn('ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"', script)
        self.assertIn("git archive --format=tar FETCH_HEAD", script)
        self.assertIn('--root "$SNAPSHOT_ROOT"', script)

    def test_check_runs_the_full_live_verifier_against_the_snapshot(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("scripts/verify_live.py", script)
        self.assertIn('--edition-date "$EDITION_DATE"', script)
        self.assertIn('--commit "$ACCEPTED_SHA"', script)
        self.assertIn('EDITION_DATE="$(jq -er \'.date\' "$SNAPSHOT_ROOT/latest.json")"', script)

    def test_check_never_deploys_and_needs_no_cloudflare_token(self):
        script = CHECK_SCRIPT.read_text()
        self.assertNotIn("wrangler", script)
        self.assertNotIn("npx", script)
        self.assertNotIn("CLOUDFLARE_API_TOKEN", script)
        self.assertNotIn("hermes", script)
        self.assertNotIn("cf.env", script)
        self.assertNotIn("inish-cf-token", script)

    def test_check_fails_loudly_on_staleness_with_a_named_recovery_path(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("LIVE_IS_STALE", script)
        self.assertIn("exit 1", script)
        self.assertIn("deploy_daily.sh", script)

    def test_check_reports_a_greppable_success_receipt(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("verified_live_current", script)
        self.assertIn('commit=$ACCEPTED_SHA', script)

    def test_check_shares_the_deploy_snapshot_contract_verbatim(self):
        # The two scripts must stay honest with each other: same fetch, same
        # snapshot, same verifier invocation shape.
        check = CHECK_SCRIPT.read_text()
        deploy = DEPLOY_SCRIPT.read_text()
        for needle in (
            "git fetch --quiet origin main",
            'ACCEPTED_SHA="$(git rev-parse FETCH_HEAD)"',
            "git archive --format=tar FETCH_HEAD",
        ):
            self.assertIn(needle, check)
            self.assertIn(needle, deploy)

    def test_hourly_caller_is_committed_and_referenced_by_the_unit(self):
        # The resilience fix must be reproducible from this repo alone: the
        # timer payload script exists and the unit points at it.
        self.assertTrue(RUNNER_SCRIPT.exists())
        unit = UNIT.read_text()
        self.assertIn("ExecStart=/usr/local/sbin/run_live_current_check.sh", unit)

    def test_hourly_caller_runs_the_pinned_check_from_the_fetched_head(self):
        # The accepted main is the truth, never a hardcoded hash or an
        # installed copy: the wrapper fetches origin/main, derives the
        # accepted SHA from FETCH_HEAD, and runs that commit's check script.
        runner = RUNNER_SCRIPT.read_text()
        self.assertIn('git -C "$CLONE_DIR" fetch --quiet origin main', runner)
        self.assertIn('ACCEPTED_SHA="$(git -C "$CLONE_DIR" rev-parse FETCH_HEAD)"', runner)
        self.assertIn('git -C "$CLONE_DIR" show "$ACCEPTED_SHA:scripts/check_live_current.sh"', runner)
        self.assertIn("exec bash \"$CHECK_PATH\"", runner)

    def test_hourly_caller_never_deploys_and_needs_no_cloudflare_token(self):
        runner = RUNNER_SCRIPT.read_text()
        for needle in ("wrangler", "npx", "CLOUDFLARE_API_TOKEN", "cf.env", "deploy_daily.sh"):
            self.assertNotIn(needle, runner)

    def test_hourly_schedule_lives_on_the_vps_timer_not_the_workflow(self):
        # GitHub's `schedule` events stall for hours (the recurring failure
        # this fix exists to close), so the workflow must not carry a cron
        # and the hourly cadence must live in the committed VPS timer.
        workflow = (ROOT / ".github" / "workflows" / "live-current-check.yml").read_text()
        self.assertNotIn("schedule:", workflow)
        self.assertNotIn("cron:", workflow)
        timer = TIMER.read_text()
        self.assertIn("[Timer]", timer)
        self.assertIn("OnCalendar=", timer)
        self.assertIn("Persistent=true", timer)


if __name__ == "__main__":
    unittest.main()
