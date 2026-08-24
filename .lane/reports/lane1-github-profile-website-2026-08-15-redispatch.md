# Lane 1 report: GitHub profile website field — re-dispatch (2026-08-15)

## Item

- [ ] add inish.in as Nish's public GitHub profile website after the closed identity-link owner [scout 2026-08-10, risk: ...]

## Verdict

BLOCKED — external account write; cannot be done by this lane with available credentials. Third same-day re-dispatch of the identical finding (earlier lane runs 2026-08-15; PR #74 merged the docs record). No repo change can set `github.com/nish3451` → profile → website.

## Fresh live re-verification (2026-08-15, this run)

- `gh api users/nish3451 --jq .blog` → `""` (field still unset; `gh api user --jq .blog` → `""`).
- `gh api -X PATCH /user -f blog=https://inish.in/` → HTTP 404, `This API operation needs the "user" scope`.
- Machine token scopes: `gist`, `read:org`, `repo`, `workflow` — no `user` scope. Only credential on host (`/home/nish/.config/gh/hosts.yml`, one nish3451 entry; no GITHUB_TOKEN/GH_TOKEN env).
- `gh auth refresh -h github.com -s user` is an interactive device flow (needs a human), per prior runs.
- Browser path re-checked this run (Camoufox): `github.com/settings/profile` redirects to the login page; Google account chooser shows Nish's personal Gmail as **Signed out**. No usable browser session exists for the account write.

## What closes the item (either action by Nish)

1. Manual: set the website field to `https://inish.in/` at https://github.com/settings/profile, then verify `gh api users/nish3451 --jq .blog` → `https://inish.in/`.
2. Or provide/grant a nish3451 token with the `user` scope; then this lane can `PATCH /user`.

Do not re-dispatch until one of those happens. Prior records: MEMORY.md decision line 16 (PR #43 closed, #62 merged, #74 merged — all the same blocker).

## Verification

- `gh api users/nish3451 --jq .blog` still returns `""` (unchanged — no account fields modified).
- Docs/report-only change; no product code, content, or production settings touched.
