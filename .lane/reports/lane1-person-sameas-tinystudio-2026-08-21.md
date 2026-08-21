# Lane 1 report — inish-site — claim the studio the footer already links in the homepage `Person` data

## Item
Claim the studio the footer already links in the homepage `Person` data,
so machines see the identity edge readers.

## Why the change is correct
- The index.html footer already links `https://tinystudio.in/` as
  `Tiny Studio ↗ — Nish's studio.` (line 178 of index.html).
- The reciprocal link exists on tinystudio.in back to inish.in, so the
  edge is owned by Nish on both ends and is verified to belong to the
  Person.
- The JSON-LD `Person` node in the homepage head currently only lists
  `https://github.com/nish3451` in `sameAs`, so machine readers see the
  GitHub edge but miss the studio edge the human footer already shows.
- Adding `https://tinystudio.in/` to the same array closes that gap.
- Truth rules preserved: the Person still claims no `jobTitle`,
  `worksFor`, products, or biography — only the two public surfaces
  verified to belong to Nish.

## Change
- `index.html` (committed head JSON-LD): add `https://tinystudio.in/`
  to the `Person.sameAs` array, sitting alongside the existing
  `https://github.com/nish3451` entry.
- `scripts/build_daily.py`: keep `json_ld()` aligned with the committed
  head so the next edition regenerates the same `Person` node. The
  docstring's truth-rule text is updated to refer to "the surfaces
  verified to belong to Nish" and to name Tiny Studio's reciprocal
  link as the verification source.
- `tests/test_build_daily.py`: pin the assertion to the two-surface
  list and update the comment to name Tiny Studio as the second
  verified surface.

## Verification
- `python3 -m unittest discover tests` -> 112 tests OK.
- `python3 -m unittest tests.test_build_daily -v` -> 43 tests OK, all
  assertions on `Person.sameAs` pass.
- `node --test tests/test_middleware_deny.test.mjs` -> 17 tests pass.
- `node --test tests/test_worker_edge.test.mjs` -> 11 tests pass.
- Local rebuild via `python3 -m unittest tests.test_build_daily` shows
  the regenerated head carries the same `sameAs` list and the
  `Article` `author` still references Person by name and URL only.

## Branch / PR
- Branch: `lane1/person-sameas-tinystudio-2026-08-21`
  (from origin/main `5b270e4`, single commit `bffbae1`).
- Push: `lane1/person-sameas-tinystudio-2026-08-21` published to
  `origin/lane1/person-sameas-tinystudio-2026-08-21` after the local
  suite went green.
- PR: https://github.com/nish3451/inish-site/pull/101
  (head: `lane1/person-sameas-tinystudio-2026-08-21`, base: `main`).

## Files touched
- `index.html` -- `Person.sameAs` adds `https://tinystudio.in/`.
- `scripts/build_daily.py` -- `json_ld()` Person `sameAs` aligned with
  the head; docstring updated.
- `tests/test_build_daily.py` -- assertion pins the two-surface list.

## Notes
- A previous worker landed the same intent on the local branch
  `growth/person-sameas-tinystudio` (commit `5ee0da5`), pushed it to
  `origin/growth/person-sameas-tinystudio`, and the branch was never
  merged into `main`. This run creates a fresh branch from
  `origin/main` and re-applies the same diff so the item is actually
  closed against `main` this cycle.
- No ranking/citation claim is made. The change only mirrors onto the
  machine-readable surface what the human footer already shows.
