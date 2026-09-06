# Lane 1 — rollback target identity

Item `14dd306cad`. Branch `lane1-rollback-target-identity-20260823`. PR https://github.com/nish3451/inish-site/pull/128

## Defect

On a same-date republish, `scripts/deploy_daily.sh` resolved `PRE_DEPLOY_COMMIT` after rollback with `git log --max-count=1 FETCH_HEAD --grep="^daily: publish $LIVE_EDITION_DATE$"`. That returns the just-published commit. Re-verify then checked the restored site against the wrong snapshot.

Not hypothetical: `main` already has `cc5f235 daily: publish 2026-08-23` (PR #127). Another same-date fix while that edition is live would hit this path.

## Fix

Bind `PRE_DEPLOY_COMMIT` at capture time, before publish, as the newest matching commit excluding `ACCEPTED_SHA`. Rollback consumes that stored value. Empty is still legal; rollback still fires first, then fail-loud.

Candidates (ii) transient/bad-publish discrimination and (iii) concurrent-publisher staleness were not built.

## Proof

Red (tests edited, script not yet): `AssertionError: 0 != 1` on `test_same_date_republish_reverifies_the_pre_deploy_commit_not_the_just_published_one`. Post-rollback verify used the accepted commit.

Green after the script edit:

- `bash -n scripts/deploy_daily.sh` — exit 0
- `python3 -m unittest tests.test_deploy_daily -v` — Ran 17 tests, OK
- `python3 -m unittest discover -s tests -v` — Ran 124 tests, OK (ERRORS.md's 76/78 figure is stale)
- `node --test tests/**/*.test.mjs` — 37 pass, 0 fail
- `git diff origin/main --stat` — only `scripts/deploy_daily.sh` and `tests/test_deploy_daily.py`

Commits: `dc6a58d` (tests), `fbf77fb` (script). Head `fbf77fb`.

This report is not in the PR diff.
