# Custom 404 Page

## User Outcome

Visitors who land on a missing AI Converter URL see a real 404 page that feels native to the site, explains the problem without blame, shows the attempted URL, suggests the closest real route, lets them search valid routes, and gives them a way to report the broken link.

## Non-Goals

- Do not add new conversion routes.
- Do not invent navigation paths, accounting integrations, pricing claims, or support promises.
- Do not change payment, upload, D1, R2, Dodo, or converter behavior.
- Do not auto-redirect missing URLs to the homepage.

## Required Behavior

- Serve `/404.html` as the Cloudflare Pages custom 404 fallback with HTTP 404 status.
- Include `<meta name="robots" content="noindex, follow">`.
- Keep the page mobile-first and fully responsive at 360px wide.
- Use the detected AI Converter design system: HK Grotesk, warm grid background, compact product UI, lime/green/blue accents, and existing logo assets.
- Header and footer navigation must use only the verified route list from the 404 request brief.
- The did-you-mean matcher, search results, and curated escape routes must only link to verified routes from that same list.
- The signature centrepiece must be interactive by touch, mouse, and keyboard, and must respect `prefers-reduced-motion`.
- The report action should open the real support form with the broken URL prefilled in the support message.

## Verified Routes

- `/bank-statement-pdf-to-csv/`
- `/pdf-bank-statement-to-quickbooks-csv/`
- `/pdf-bank-statement-to-xero-csv/`
- `/pdf-bank-statement-to-wave-csv/`
- `/scanned-bank-statement-to-excel/`
- `/credit-card-statement-pdf-to-csv/`
- `/formats/`
- `/privacy/`
- `/security/`
- `/data-retention/`
- `/refund/`

## Acceptance Checks

- Static regression test confirms the 404 page has noindex/follow, viewport metadata, attempted-URL UI, the interactive stage slider, search, report link, and only verified recovery routes.
- Routing regression test confirms `_redirects` no longer rewrites every path to `/index.html 200`.
- Build succeeds and copies `404.html` and `404.js` into `dist`.
- Browser check covers mobile and desktop, including slider interaction and search filtering.

## Data And Platform Touch

- Client only: static 404 HTML/CSS and vanilla JS.
- Support page client helper: reads a `message` query parameter to prefill the existing support form.
- Cloudflare Pages routing: remove the SPA soft-404 redirect so Cloudflare can serve the custom 404 with status 404.
- No secrets, database writes, billing paths, Cloudflare admin APIs, D1, R2, or payment provider calls are added.

## Rollback

- Revert `public/404.html`, `public/404.js`, the 404 test, and the `_redirects` change.
- If emergency SPA fallback is needed, restore `/* /index.html 200`, accepting that this brings back soft 404 behavior.
