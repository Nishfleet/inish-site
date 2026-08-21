# Error Log

Use this file only when an approach takes more than two attempts, or when a setup/build/deploy failure is likely to recur.

## Known Failures

- **Do not kill `scripts/deploy_daily.sh` during its post-deploy verification loop (observed 2026-08-21).** After `wrangler deploy` succeeds, the script verifies whole-live parity up to 12 times and only rolls back to the captured pre-deploy version if all attempts fail. Killing the script mid-loop (e.g. a too-short command timeout) skips the rollback path and leaves a possibly-bad publish serving 100% of traffic. That day the published worker crashed on every `/fonts/*.woff2` request (error 1101) until the fix in PR #113 was deployed. Give the script a generous timeout (10+ minutes) or monitor it to completion.

- **GitHub Actions jobs fail in 2-3s with zero steps and no logs (since 2026-08-09 ~20:25Z).** Every PR check (`test`, `classify`) on any branch fails instantly. The check-run annotation says: "The job was not started because recent account payments have failed or your spending limit needs to be increased." This is account billing, not repository code: the full unittest suite (76 tests) passes locally on the affected branch. Fix is on the account owner's side (Billing & plans), then re-run the failed jobs. Do not re-diagnose from scratch; do not push code changes expecting CI to go green.
