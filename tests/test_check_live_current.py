import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK_SCRIPT = ROOT / "scripts" / "check_live_current.sh"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_daily.sh"


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


if __name__ == "__main__":
    unittest.main()
