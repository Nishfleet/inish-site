# inish.in Agent Surface Plan

## Goal

Make Nish's personal founder surface carry the applied-AI operating principle in a lightweight, agent-readable way: all serious projects should move toward self-serve, agent-assisted workflows with clear context, safe tools, model routing, and explicit human approval gates.

## Constraints

- Keep the site static and personal.
- Do not add infrastructure, dependencies, or new product claims.
- Keep the public copy grounded in operating principles, not unproven capabilities.
- Update the human page and the machine-readable surfaces together.

## Scope

- Add a short `Agent brief` section to `index.html`.
- Add the principle to `llms.txt`.
- Mirror the same truth in the markdown response from `functions/_middleware.js`.
- Verify the static assets and run the installed review gate before commit.

## Out Of Scope

- Intake forms, CRM workflows, automations, customer support systems, or model integrations.
- Public launch claims about any product using agents in production.
- Visual redesign of the personal site.

## Verification

- Static syntax checks for the Cloudflare middleware.
- Diff whitespace check.
- Installed autoreview helper on the final diff.
