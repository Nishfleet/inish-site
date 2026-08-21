# Lane 1 report: gitignore the fleet-desk data.json snapshot (2026-08-20 redispatch)

## Item

- [ ] gitignore (or remove) the untracked fleet-desk `data.json` snapshot at the
  repo root so internal ops state can't be committed.

## Verdict

**Already done on `origin/main` — no code change needed.** The item was
resolved by PR #80 (commit `887eeb7`, merged 2026-08-15), which root-anchored
`/data.json` in `.gitignore` with the comment "Fleet-desk snapshot dropped at
the repo root; not site content".

## Evidence

- `origin/main` `.gitignore` (HEAD = `5b270e4`) contains the anchored entry
  `/data.json` plus `data/candidates/`; `data/editions/*.json` remains tracked
  (the anchor was chosen so site content JSON is not ignored).
- `git merge-base --is-ancestor 887eeb7 origin/main` → true. The fix commit is
  an ancestor of current `main`; `git show 887eeb7 --stat` shows exactly
  `.gitignore | 2 ++`.
- Working tree is clean: `git status --porcelain` is empty, and no
  `data.json` file exists at the repo root (`ls` → no such file).
- The only `data.json` reference in the whole tree is the `.gitignore:4`
  entry itself (`grep -n data.json` across the repo).
- Historical leak the ignore now prevents: commit `facdd15` on a stray
  repo-sync branch captured a one-line `data.json` ops snapshot plus
  `.pytest_cache` junk in an untracked stash. Root-anchoring `/data.json`
  keeps any future fleet-desk drop out of `git status` and `git add -A`.
- Precedent for this exact situation: the 2026-08-15 lane-1 triage report
  (`.lane/reports/lane1-2026-08-15-cluster-triage.md`) documents the same
  already-resolved verdict pattern for a cluster of items.

## What was done in this run

- No code changes (nothing to change; the fix is already merged).
- This lane-unique report written and delivered via PR, matching the
  established triage-report delivery pattern.

## Recommendation

Close the item as done. Do not re-dispatch; any further dispatch of this item
is a duplicate of PR #80.
