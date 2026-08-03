# Project Memory

Use this file for durable project truth Codex cannot reliably infer from code alone.

## Decisions

- inish.in is the public home of Nish Daily. The feed itself is the root page.
- Keep only the current feed plus its RSS, JSON, robots, sitemap, CSS, and JavaScript endpoints. Do not publish founder/product pages, LLM pages, or edition archives.
- Preserve old non-archive `/daily/*` links with permanent redirects to the root equivalents; archive URLs intentionally return 404.
- The site should stay static HTML, CSS, JavaScript, and Cloudflare Pages unless a stronger need is proven.

## Rejected Paths

- _No rejected paths logged yet._

## Session Summaries

- 2026-06-01: Initialized the local `inish-site` folder as a Git repo, committed the current site baseline, added a redesign plan, ignored `.wrangler/`, and added this Codex handoff layer.
- 2026-08-03: Nish replaced the founder surface with the Nish Daily feed at `/` and explicitly removed public archives.
