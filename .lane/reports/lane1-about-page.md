# Lane 1 evidence — canonical `/about` identity surface

**Branch:** `lane1-about-page`  
**PR:** https://github.com/nish3451/inish-site/pull/125  
**Commit:** `fd75bb4`

## What shipped

- New static `about.html` with masthead, footer, JSON-LD Person/Organization graph, and canonical meta.
- Route contract: `/about.html` in `publicPaths`; `/about` → `/about.html` redirect in `public-paths.json`, `_redirects`, and edge policy (via contract import).
- Builder: sitemap includes About URL; generated `index.html` footer links About.
- `llms.txt` lists About under Essential links; `MEMORY.md` notes `/about.html` supersedes the no-founder-pages rule.
- CSS block for `.about-main` / `.about-section` prose layout.

## Verification (local)

```text
node --test tests/test_middleware_deny.test.mjs  → 18 pass, 0 fail
node --test tests/test_worker_edge.test.mjs      → 19 pass, 0 fail
python3 -m unittest discover -s tests -v         → Ran 122 tests, OK
node -e "import { decide } from './functions/policy.js'; ..." → redirect static
grep About index.html / about loc sitemap.xml   → present
public-paths.json /about.html + /about redirect → True /about.html
```

Note: spec acceptance line `from functions.policy import decide` has no Python module in this repo; policy lives in `functions/policy.js` and the node one-liner above is equivalent.

## Post-merge deploy

Live checks (after deploy):

- `curl -sI https://inish.in/about` → 301 to `/about.html` with HSTS
- `curl -sL https://inish.in/about.html` → committed bytes
