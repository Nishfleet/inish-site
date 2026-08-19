# Private Corpus Fixtures

Keep real customer-like files in `.private-corpus/`, not in this directory.

This directory documents the contract only:

- `.private-corpus/manifest.json` lists private files and expected checks.
- `.private-corpus/files/` holds anonymized PDFs, images, documents, and audio.
- `.private-corpus/.env` may hold local-only provider keys for corpus runs.

Run `npm run corpus:private` before serious deploys.
