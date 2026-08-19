# Database

AI Converter uses Cloudflare D1. Keep it.

## Why It Exists

D1 stores small workflow records, not uploaded files:

- job ID and token hash
- conversion status
- selected plan and estimated pages
- R2 source/result object keys
- row count and confidence
- Dodo payment, webhook, refund, and retry state
- rate-limit and same-file preview protection
- support requests

Uploaded files and generated CSV/JSON files live in private R2, not in D1.

## Live Database

- Database name: `aiconverter`
- Database ID: `376080eb-60f1-4bb8-aabb-06622acabb63`
- Bound as: `AICONVERTER_DB`

## Checks

List remote migration state:

```bash
npm run db:migrations:list
```

List remote tables:

```bash
npm run db:tables
```

Apply remote migrations:

```bash
SAFE_DEPLOY_APPROVED='d1 migrations apply aiconverter --remote' npm run db:migrate:remote
```

## Rule

Do not replace D1 with Supabase/Postgres until the app needs relational complexity D1 cannot comfortably handle. For the current preview-payment-redo workflow, D1 is the right size.
