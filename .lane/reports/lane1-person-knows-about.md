# Lane 1 evidence — Person schema `knowsAbout`

**Branch:** `lane1/person-knows-about`
**Commit:** `aca824c`
**Item ID:** `f8595847f8`

## What changed

Added `knowsAbout` to the Person JSON-LD node so AI answer engines can match Nish to topic queries, not just resolve the entity.

- `scripts/build_daily.py` — `knowsAbout: sorted(SECTIONS - {"Wildcard"})` on the Person dict; docstring updated.
- `tests/test_build_daily.py` — assertion that `person["knowsAbout"]` equals `sorted(builder.SECTIONS - {"Wildcard"})`.
- `index.html` — regenerated via `python3 scripts/build_daily.py`.

## Verification

```
$ python3 -m unittest discover -s tests -v
Ran 120 tests in 0.879s
OK

$ python3 -c "import json, re; ..."
['AI', 'Demand signals', 'Product ideas', 'Tools']

$ git diff --name-only
index.html
scripts/build_daily.py
tests/test_build_daily.py
```

Only the three intended files changed.
