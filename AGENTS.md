# Project AGENTS

Launch stage: 0 (day one). Next trigger: a sign-up or subscribe form on nish.sh (none planned), which brings stage 1.

Success: days in the last 30 with a new edition live (target 30 of 30). Baseline: 6 of 30 on 2026-10-15 (`data/editions/` holds 2026-09-28, 09-29 and 10-12 to 10-15 in that window). Measured by: `node -e 'const s=new Date(Date.now()-29*864e5).toISOString().slice(0,10);console.log(require("fs").readdirSync("data/editions").filter(f=>f>=s).length)'` on an up-to-date `main`. Whether Nish reads it has no counter yet.

- Read `MEMORY.md` before architectural, deploy, or positioning decisions; read `ERRORS.md` before retrying a failed approach.
- Keep the site lightweight: static HTML, CSS, JS, and the one Worker. No helper scripts.
- Work on `main`. Run `npm test` before pushing; the push deploys.
- Check visual changes in a browser at desktop and phone widths before pushing.
