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
        # The default verify snapshot is $SNAPSHOT_ROOT; paused mode redirects
        # to $LAST_DIR via the VERIFY_SNAPSHOT variable.
        self.assertIn('VERIFY_SNAPSHOT="$SNAPSHOT_ROOT"', script)

    def test_check_runs_the_full_live_verifier_against_the_snapshot(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("scripts/verify_live.py", script)
        # The verify invocation uses VERIFY_DATE and VERIFY_COMMIT variables
        # that are set from $EDITION_DATE / $ACCEPTED_SHA in normal mode and
        # from $LIVE_EDITION_DATE / $LAST_COMMIT in paused mode.
        self.assertIn('--edition-date "$VERIFY_DATE"', script)
        self.assertIn('--commit "$VERIFY_COMMIT"', script)
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
        self.assertIn('commit=$VERIFY_COMMIT', script)

    def test_check_reads_live_edition_date_for_paused_detection(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("https://inish.in/latest.json", script)
        self.assertIn('LIVE_EDITION_DATE', script)
        self.assertIn("PAUSED_MODE", script)

    def test_check_in_paused_mode_verifies_against_last_deployed_edition(self):
        script = CHECK_SCRIPT.read_text()
        # In paused mode the script must resolve the commit that PUBLISHED the
        # edition live is serving (the same "daily: publish <date>" convention
        # deploy_daily.sh uses for its rollback snapshot) and snapshot that
        # full tree, not the latest origin/main.
        self.assertIn("git log --format='%H' --max-count=1 FETCH_HEAD", script)
        self.assertIn('--grep="^daily: publish', script)
        self.assertIn('LIVE_EDITION_DATE', script)
        self.assertIn('git archive --format=tar "$LAST_COMMIT"', script)
        self.assertIn('VERIFY_SNAPSHOT="$LAST_DIR"', script)
        self.assertIn('VERIFY_COMMIT="$LAST_COMMIT"', script)
        self.assertIn('VERIFY_DATE="$LIVE_EDITION_DATE"', script)

    def test_check_paused_mode_fails_if_last_deployed_commit_not_found(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("PAUSED_MODE_NO_PREVIOUS", script)
        self.assertIn("exit 1", script)

    def test_check_fails_if_live_is_ahead_of_accepted_edition(self):
        script = CHECK_SCRIPT.read_text()
        self.assertIn("LIVE_AHEAD", script)
        self.assertIn("exit 1", script)

    def test_check_failure_message_distinguishes_paused_mode_from_normal(self):
        script = CHECK_SCRIPT.read_text()
        # The LIVE_IS_STALE message must say "last deployed edition" in paused
        # mode and "origin/main" in normal mode, so a human reading the log
        # knows which snapshot was the expected one.
        self.assertIn("'the last deployed edition'", script)
        self.assertIn("'origin/main'", script)

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
