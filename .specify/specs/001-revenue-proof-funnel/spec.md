# Revenue Proof Funnel

## User Outcome

Users who upload a supported file can download the generated preview CSV for free before checkout. Paid checkout remains required for the full export unless the production free-download flag is deliberately enabled.

## Non-Goals

- Do not make full exports free by default.
- Do not change Dodo products, live prices, or Cloudflare bindings.
- Do not claim guaranteed accounting imports, official platform support, or certified compliance.

## Acceptance Checks

- A preview-ready job can download its stored preview file with the same job token.
- A user cannot download another job's preview without the token.
- Existing full-download payment checks still block unpaid full exports.
- Funnel telemetry records page view, preview, sample download, checkout, finalize, and download milestones without storing file names or row content.
- Repo pricing, Node tests, audit, and build pass.

## Data Touched

- Client UI state and event telemetry.
- Existing `preview_funnel_events` D1 table.
- Existing R2 preview objects under `jobs/<jobId>/preview.csv`.

## Runtime Boundaries

- Browser calls only public app API routes.
- Server API authorizes preview downloads through the existing job token path.
- No client access to D1, R2, Dodo secrets, Cloudflare admin APIs, or model-provider secrets.

## Rollback

Remove the preview-download button/client call and delete `/api/preview-download`. The existing paid checkout, finalize, and download flow remains unchanged.
