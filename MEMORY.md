# Project Memory

Use this file for durable project truth Codex cannot reliably infer from code alone.

## Decisions

- inish.in is the public home of Nish Daily. The feed itself is the root page.
- The daily deploy (`deploy_daily.sh`) takes the accepted edition from a pristine snapshot of `origin/main` fetched inside the script, never from the local workdir, so a checkout left on a topic branch cannot stall live delivery. Its only freshness gate is refusing to roll the live site back to an edition older than what the live hostname serves; whole live parity is enforced loudly by `verify_live.py`.
- The edition is gated on quality, not count. `build_daily.py` accepts 0-8 stories and a day where nothing survives being checked is a valid edition. Never pad to hit a number.
- Every story carries a `fact` (a checkable detail from the source), a first-person `take`, and a `caveat`. The builder enforces all three and refuses to render generic copy — that validator is the editorial policy, so weakening it to make a run pass defeats its whole purpose.
- Keep only the current feed plus its RSS, JSON, robots, sitemap, CSS, and JavaScript endpoints. Do not publish founder/product pages, LLM pages, or edition archives.
- Preserve old non-archive `/daily/*` links with permanent redirects to the root equivalents; archive URLs intentionally return 404.
- The site should stay static HTML, CSS, JavaScript, and Cloudflare Pages unless a stronger need is proven.

## Rejected Paths

- Banning filler words in the runbook. A wordlist (`useful`, `concrete`, `durable`, `lens`, `unlock`) was tried on 2026-08-03 and the writer simply rotated to `visible`, `bounded`, `trust`, `honest`. Structural constraints the builder can enforce work; vocabulary bans do not.
- Sourcing candidates from brand-new GitHub repositories. `created:>=7 days stars:>=15` returned projects whose only evidence was their own README, which is why six of eight stories in one edition were repo descriptions rewritten as news.

## Session Summaries

- 2026-06-01: Initialized the local `inish-site` folder as a Git repo, committed the current site baseline, added a redesign plan, ignored `.wrangler/`, and added this Codex handoff layer.
- 2026-08-03: Nish replaced the founder surface with the Nish Daily feed at `/` and explicitly removed public archives.
- 2026-08-03: Nish said the feed read as AI slop. Diagnosis was structural, not stylistic: the candidate pool favoured week-old repos with no external evidence, nothing forced the writer to open a source, and `why_it_matters` produced aphorisms true of any story. Replaced it with fact/take/caveat enforced by the builder, widened the pool (Lobsters, HN comment threads, older repos with real traction), and made the story count a consequence of the bar. Nish chose first-person opinions backed by facts, and approved rebuilding the live 2026-08-03 edition under the new rules.
