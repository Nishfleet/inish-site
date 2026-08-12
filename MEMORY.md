# Project Memory

Use this file for durable project truth Codex cannot reliably infer from code alone.

## Decisions

- inish.in is the public home of Nish Daily. The feed itself is the root page.
- The daily deploy (`deploy_daily.sh`) takes the accepted edition from a pristine snapshot of `origin/main` fetched inside the script, never from the local workdir, so a checkout left on a topic branch cannot stall live delivery. Its only freshness gate is refusing to roll the live site back to an edition older than what the live hostname serves; whole live parity is enforced loudly by `verify_live.py`.
- The "deliver the merged edge head to live" item is an operational act, not a code change: merged commits reach inish.in only via `scripts/deploy_daily.sh` (or the daily publisher run). The deploy-free staleness check `scripts/check_live_current.sh` gets its scheduled caller from the `Live current check` workflow (`.github/workflows/live-current-check.yml`, merged 2026-08-11 in PR #51; runs hourly on the VPS self-hosted runner). Delivered 2026-08-12: merged head `d5d2b22` (#63 raster social card, #64 deploy rollback) was deployed and re-verified live (`verified_live_current commit=d5d2b22`); the item's close condition is met, so the lane should not re-dispatch it unless a later merged change again goes un-deployed (the hourly check reds `LIVE_IS_STALE` when that happens).
- The edition is gated on quality, not count. `build_daily.py` accepts 0-8 stories and a day where nothing survives being checked is a valid edition. Never pad to hit a number.
- Every story carries a `fact` (a checkable detail from the source), a first-person `take`, and a `caveat`. The builder enforces all three and refuses to render generic copy — that validator is the editorial policy, so weakening it to make a run pass defeats its whole purpose.
- Keep only the current feed plus its RSS, JSON, robots, sitemap, CSS, and JavaScript endpoints. Do not publish founder/product pages, LLM pages, or edition archives.
- Preserve old non-archive `/daily/*` links with permanent redirects to the root equivalents; archive URLs intentionally return 404.
- The site should stay static HTML, CSS, JavaScript, and Cloudflare Pages unless a stronger need is proven.
- The cross-repo "link inish.in back from product sites" item (backlog cd1a458ea0) is owned by the 0509 and tinystudio-io loops, not this repo: the footer attribution edits live in nish3451/0509 (`app/components/marketing-footer.tsx`, PR #599) and nish3451/TinyStudio.io (`public/index.html` footer, PR #70), both labeled "Nish's daily reads" → https://inish.in/. This repo has no code change for it; close the item when `curl -sL https://0509.io/` and `https://tinystudio.io/` both contain an href to `https://inish.in/`. siterep.net, seofixkit.com, and aiconverter.app stay out of scope until they gain attribution chrome.
- The public GitHub profile website field (`github.com/nish3451` → profile → website) is a manual account write, not a fleet action: the machine's gh token (scopes `gist`, `read:org`, `repo`, `workflow`) lacks the `user` scope, so `PATCH /user` fails with "This API operation needs the 'user' scope". Re-verified 2026-08-12 after a scout re-filed the item: `gh api user --jq .blog` still returns `""`. GraphQL is not an alternative route — the schema has no `updateUser` mutation, and `gh auth refresh -h github.com -s user` is an interactive device flow. The intended value is `https://inish.in/`; verify with `gh api users/nish3451 --jq .blog`. Do not re-dispatch this item until the field is set (github.com/settings/profile) or a `user`-scoped token exists. Prior record: PR #43 (open, same finding, 2026-08-11).

## Rejected Paths

- Banning filler words in the runbook. A wordlist (`useful`, `concrete`, `durable`, `lens`, `unlock`) was tried on 2026-08-03 and the writer simply rotated to `visible`, `bounded`, `trust`, `honest`. Structural constraints the builder can enforce work; vocabulary bans do not.
- Sourcing candidates from brand-new GitHub repositories. `created:>=7 days stars:>=15` returned projects whose only evidence was their own README, which is why six of eight stories in one edition were repo descriptions rewritten as news.

## Session Summaries

- 2026-06-01: Initialized the local `inish-site` folder as a Git repo, committed the current site baseline, added a redesign plan, ignored `.wrangler/`, and added this Codex handoff layer.
- 2026-08-03: Nish replaced the founder surface with the Nish Daily feed at `/` and explicitly removed public archives.
- 2026-08-03: Nish said the feed read as AI slop. Diagnosis was structural, not stylistic: the candidate pool favoured week-old repos with no external evidence, nothing forced the writer to open a source, and `why_it_matters` produced aphorisms true of any story. Replaced it with fact/take/caveat enforced by the builder, widened the pool (Lobsters, HN comment threads, older repos with real traction), and made the story count a consequence of the bar. Nish chose first-person opinions backed by facts, and approved rebuilding the live 2026-08-03 edition under the new rules.
