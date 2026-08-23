# Lane 1 evidence — close superseded conflicting PRs #88, #95, #102, #103

**Branch:** `lane1/close-superseded-prs-2026-08-23`
**Item ID:** `ea743165c3`
**Worktree:** `/home/nish/workspaces/agent-worktrees/inish-site-lane1-20260823-122532`

## PR #88 — scout: audit inish-site for revenue-impact items (2026-08-20)
- **Before:** `state: OPEN`, `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`, branch `scout/2026-08-20-inish-site-revenue-audit`
- **Verification command:**
  ```
  gh -R nish3451/inish-site pr view 88 --json number,state,mergeable,mergeStateStatus,headRefName
  ```
  **Output:** {"headRefName":"scout/2026-08-20-inish-site-revenue-audit","mergeStateStatus":"DIRTY","mergeable":"CONFLICTING","number":88,"state":"OPEN"}
- **Supersession check:**
  ```
  git log --oneline -1 6e33d3c
  git log --oneline -1 main -- var/scout/AUDIT-2026-08-21-inish-site.md
  ```
  **Output:**
  ```
  6e33d3c Merge pull request #110 from nish3451/scout/2026-08-21-inish-site-revenue-audit
  fbd79ac scout: audit inish-site for revenue-impact items (2026-08-21)
  ```
- **Close comment used:** "Superseded by PR #110 (commit 6e33d3c / branch scout/2026-08-21-inish-site-revenue-audit), which already merged the 2026-08-21 revenue audit into main. This branch also has merge conflicts with main and would revert later changes, so it is being closed without deletion."
- **After:** {"state":"CLOSED"}

## PR #95 — docs: record the RSS-carry-edition item as already done (re-verified 2026-08-20)
- **Before:** `state: OPEN`, `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`, branch `lane1/rss-item-carries-edition-redispatch-2026-08-20`
- **Verification command:**
  ```
  gh -R nish3451/inish-site pr view 95 --json number,state,mergeable,mergeStateStatus,headRefName
  ```
  **Output:** {"headRefName":"lane1/rss-item-carries-edition-redispatch-2026-08-20","mergeStateStatus":"DIRTY","mergeable":"CONFLICTING","number":95,"state":"OPEN"}
- **Supersession check:**
  ```
  git merge-base --is-ancestor a4cbaff main; echo "exit=$?"
  git log --oneline -1 a4cbaff
  ```
  **Output:**
  ```
  exit=0
  a4cbaff feat: carry the full edition inside each RSS item (#77)
  ```
- **Close comment used:** "Superseded by PR #77 (commit a4cbaff), which already delivers the RSS item carrying its edition on main. This docs-only redispatch is now stale and conflicts with current MEMORY.md, so it is being closed without deletion."
- **After:** {"state":"CLOSED"}

## PR #102 — feat: enrich the Person schema with knowsAbout so AI answer engines can match Nish to topic queries
- **Before:** `state: OPEN`, `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`, branch `lane1/enrich-person-knows-about-2026-08-21`
- **Verification command:**
  ```
  gh -R nish3451/inish-site pr view 102 --json number,state,mergeable,mergeStateStatus,headRefName
  ```
  **Output:** {"headRefName":"lane1/enrich-person-knows-about-2026-08-21","mergeStateStatus":"DIRTY","mergeable":"CONFLICTING","number":102,"state":"OPEN"}
- **Supersession checks:**
  ```
  grep -n 'knowsAbout' scripts/build_daily.py
  git log --oneline -1 c385367
  git merge-base --is-ancestor c385367 main; echo "exit=$?"
  ```
  **Output:**
  ```
  382:    formal employment relationship. The `knowsAbout` list is the page's
  426:        "knowsAbout": sorted(SECTIONS - {"Wildcard"}),
  c385367 Merge pull request #120 from nish3451/lane1/person-knows-about
  exit=0
  ```
- **Close comment used:** "Superseded by PR #120 (commit c385367 / branch lane1/person-knows-about), which already merged Person `knowsAbout` into main. This branch is an older competing implementation with merge conflicts that would revert later JSON-LD additions, so it is being closed without deletion."
- **After:** {"state":"CLOSED"}

## PR #103 — feat: stamp the sitemap entry with the edition date as lastmod
- **Before:** `state: OPEN`, `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`, branch `lane1/sitemap-lastmod-freshness-2026-08-21`
- **Verification command:**
  ```
  gh -R nish3451/inish-site pr view 103 --json number,state,mergeable,mergeStateStatus,headRefName
  ```
  **Output:** {"headRefName":"lane1/sitemap-lastmod-freshness-2026-08-21","mergeStateStatus":"DIRTY","mergeable":"CONFLICTING","number":103,"state":"OPEN"}
- **Supersession checks:**
  ```
  grep -n 'lastmod' scripts/build_daily.py
  grep -n '<lastmod>' sitemap.xml
  git log --oneline -1 6749db9
  git merge-base --is-ancestor 6749db9 main; echo "exit=$?"
  ```
  **Output:**
  ```
  645:    body = f'<url><loc>https://inish.in/</loc><lastmod>{date}</lastmod></url><url><loc>https://inish.in/about.html</loc><lastmod>{date}</lastmod></url>'
  2:<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://inish.in/</loc><lastmod>2026-08-22</lastmod></url><url><loc>https://inish.in/about.html</loc><lastmod>2026-08-22</lastmod></url></urlset>
  6749db9 Merge pull request #116 from nish3451/growth/sitemap-lastmod-20260822
  exit=0
  ```
- **Close comment used:** "Superseded by PR #116 (commit 6749db9 / branch growth/sitemap-lastmod-20260822), which already merged sitemap `<lastmod>` into main. This branch is an older competing implementation with merge conflicts that would revert later changes, so it is being closed without deletion."
- **After:** {"state":"CLOSED"}

PACKET COMPLETE
