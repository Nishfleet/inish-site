# AI Converter Agent Notes

This repo is the durable local home for `aiconverter.app`.

## Guardrails

- Keep customer-facing copy and agent-readable Markdown truthful to live behavior.
- Do not commit secrets, API keys, `.env`, `.dev.vars`, `.wrangler`, `dist`, or `node_modules`.
- Treat Cloudflare D1, R2, Pages, and Dodo changes as live production work.
- Production DNS is authoritative at Porkbun and points to Cloudflare Pages; do not move `aiconverter.app` back to Cloudflare nameservers unless Cloudflare DNS Write/Zone Write access is present and the zone has been activated. See `ops/dns.md`.
- Keep D1 as the workflow database unless a real scale/feature need appears; see `ops/database.md`.
- Run pricing, tests, audit, and build before deploy when possible.
- Treat Dodo checkout creation, real payment webhook, paid finalize, download, redo, and refund proof as separate checks; checkout creation alone is not full paid-path proof.

## Checks

```bash
npm run check:pricing
node --test tests/*.test.mjs
npm audit --audit-level=moderate
npm run build
npm run stress:converters
npm run stress:live
npm run stress:checkout
npm run readiness:live
```

## Deploy

```bash
SAFE_DEPLOY_APPROVED='pages deploy dist --project-name aiconverter --branch main' wrangler pages deploy dist --project-name aiconverter --branch main
```

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
