# Lane 1 report: GitHub profile website field (2026-08-15)

## Item

- [ ] add inish.in as Nish's public GitHub profile website after the closed identity-link owner [scout 2026-08-10, risk: ...]

## Verdict

Blocked on credentials — a manual account write, not a fleet action. This is a re-file of the item already recorded in `MEMORY.md` (line 16, recorded 2026-08-10 via PR #43, re-verified 2026-08-12 via PR #62).

## Live re-verification (2026-08-15)

- `gh api users/nish3451 --jq .blog` → empty string (field still unset).
- `gh api user --jq .blog` → empty string.
- `gh api -X PATCH user -f blog=https://inish.in/` → HTTP 404, "This API operation needs the 'user' scope".
- Machine token scopes: `gist`, `read:org`, `repo`, `workflow` — no `user` scope.
- GraphQL schema has no `updateUser` mutation (`__type(name: "Mutation")` field list).
- `gh auth refresh -h github.com -s user` is an interactive device flow (cannot run headless).
- PR #43 (docs record, 2026-08-10) is closed, not merged; #62 (re-verification) is merged.

## Change

- `MEMORY.md`: refreshed the re-verification date to 2026-08-15 with today's evidence and the prior-record chain.

## What closes the item (either action by Nish)

1. Manual: set the website field to `https://inish.in/` at https://github.com/settings/profile, then verify with `gh api users/nish3451 --jq .blog`.
2. Or grant a token with the `user` scope; then the lane can `PATCH /user`.

Do not re-dispatch until one of those happens.

## Verification

- `gh api users/nish3451 --jq .blog` still returns `""` (unchanged — no account fields modified).
- Docs-only change; no product code, content, or production settings touched.
