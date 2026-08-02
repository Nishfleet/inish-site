# Hermes daily publishing contract

Run this only on `hostinger-kvm4` in `/home/nish/workspaces/products/inish-site`.

## Goal

Publish one useful, source-backed edition to `https://inish.in/daily/`, then send Nish the live link on Telegram.

## Steps

1. Pull `origin/main` with fast-forward only. Stop if the checkout is dirty or diverged.
2. Run `python3 scripts/fetch_candidates.py --date YYYY-MM-DD` using today's Asia/Kolkata date.
3. Read the candidate JSON. Select 8-12 items useful to Nish's current work across:
   - AI and coding agents
   - practical building and open-source tools
   - product, UI, and UX
   - founder operations, distribution, and business
4. Write `data/editions/YYYY-MM-DD.json` using the schema below.
5. Run `python3 scripts/build_daily.py` and `python3 -m unittest discover -s tests -v`.
6. Review the rendered page for empty copy, duplicates, unsupported claims, and broken source URLs.
7. Commit only the edition and generated daily files with `daily: publish YYYY-MM-DD`, then push `main`.
8. Wait for `https://inish.in/daily/latest.json` to report today's date. If it does not update, report the deploy failure and do not claim success.
9. Telegram Nish: edition date, the live link, story count, and the three strongest headlines. Keep it concise.

## Editorial rules

- Prefer usefulness over hype or raw popularity.
- Summaries must be original, factual, and understandable without opening the source.
- `why_it_matters` must connect the item to Nish's products, workflows, design, agents, or business.
- Link to the primary source whenever one exists.
- Never publish private notes, repository contents, credentials, customer data, rumors, or personal agent memory.
- Do not invent numbers, quotes, capabilities, or outcomes.
- Do not edit site code, configuration, or previous editions during a normal daily run.

## Edition schema

```json
{
  "date": "YYYY-MM-DD",
  "editor_note": "One short paragraph explaining today's signal.",
  "stories": [
    {
      "title": "Clear headline",
      "url": "https://primary-source.example/item",
      "source": "Source name",
      "section": "AI & agents | Build & ship | Design & product | Business & growth",
      "summary": "What happened, in plain English.",
      "why_it_matters": "Why Nish should care."
    }
  ]
}
```
