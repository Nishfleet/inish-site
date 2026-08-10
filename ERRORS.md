# Error Log

Use this file only when an approach takes more than two attempts, or when a setup/build/deploy failure is likely to recur.

## Known Failures

- **GitHub Actions jobs fail in 2-3s with zero steps and no logs (since 2026-08-09 ~20:25Z).** Every PR check (`test`, `classify`) on any branch fails instantly. The check-run annotation says: "The job was not started because recent account payments have failed or your spending limit needs to be increased." This is account billing, not repository code: the full unittest suite (76 tests) passes locally on the affected branch. Fix is on the account owner's side (Billing & plans), then re-run the failed jobs. Do not re-diagnose from scratch; do not push code changes expecting CI to go green.
