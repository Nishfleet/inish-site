# Launch Venue Notes

Durable record of launch-venue decisions and submission kits for aiconverter.app.
Live-production claims only: everything below is grounded in live pages and
`/llms.txt` (verified 2026-08-09 for Product Hunt and BetaList, re-verified
2026-08-10; WeLikeTools and xix.ai verified 2026-08-10, re-verified
2026-08-11 and 2026-08-12; Toolbit.ai verified 2026-08-10 and re-verified 2026-08-11;
Toolify.ai verified 2026-08-11; Microlaunch verified 2026-08-11; Uneed
(uneed.best) verified 2026-08-11; Open-Launch verified 2026-08-11; SaaSHub
verified 2026-08-12).
Automated submission is blocked for all ten venues by the fleet venue policy
ledger (`agent-state/growth-loop/venue-policy.json` and the `venue-claim`
guard): Product Hunt is reviewed as prohibiting automation; BetaList,
WeLikeTools, xix.ai, Toolbit.ai, Toolify.ai, Microlaunch, uneed.best,
Open-Launch, and saashub.com are not yet reviewed
(`automation_disposition: unknown`). Uneed is
the first venue that publishes its own official agent-launch API
(`/launch.txt` + REST `/api/v1`) — strong positive evidence the venue research
desk should weigh when reviewing uneed.best. Account actions (and the xix.ai
$9.90, Toolify.ai $99, Microlaunch Pro Launch $39, Uneed Skip the Waiting Line
$29.99, and Open-Launch Premium Launch $12 spend decisions) stay with Nish.
The kits below make each manual submission a copy-paste job.

## Submission outcomes (2026-08-11)

As of 2026-08-11 no venue has a live aiconverter.app listing and no submission
was made from the fleet. Status per venue (the kits below remain the prepared
copy source):

- **Product Hunt — NEEDS_NISH_STEP.** Copy is prepared (kit below). Nish must
  choose/confirm the launch date and publish manually: Product Hunt prohibits
  automated access, so no agent action is possible on this venue.
- **BetaList — SKIPPED_PAID.** BetaList's official Support page (verified
  2026-08-11) now states all submissions are paid and no free option exists.
  This supersedes the stale prepared text below claiming the standard
  submission is free; the kit is retained as copy reference only.
- **WeLikeTools — NEEDS_NISH_STEP.** Free submission is available, but the
  submit page requires Google login/OAuth. Nish must approve/complete the
  Google sign-in, then the prepared copy can be submitted. (Lane attempt
  2026-08-12: NOT EXECUTED — venue still not allowlisted in the fleet venue
  policy, and the submit flow is Google-sign-in-gated; see the WeLikeTools
  section below.)
- **xix.ai — SKIPPED_PAID.** Current listing is paid only ($9.90); the spend
  was not made. (Lane attempt 2026-08-12: NOT EXECUTED — venue still not
  allowlisted in the fleet venue policy, and the $9.90 spend is a Nish-only
  decision; see the xix.ai section below.)
- **Toolbit.ai — NEEDS_NISH_STEP.** The free community listing requires an
  account and the Launch Badge, and the venue terms prohibit automated access.
  Nish must complete the manual login/submission and decide whether to install
  the badge. No submission is claimed for this venue. (Lane attempt 2026-08-12:
  NOT EXECUTED — venue still not allowlisted in the fleet venue policy, so the
  agent must not drive the submission; see the Toolbit.ai section below.)
- **Toolify.ai — SKIPPED_PAID.** Current listing is paid only ($99); the spend
  was not made. (Lane attempt 2026-08-12: NOT EXECUTED — venue still not
  allowlisted in the fleet venue policy, and the $99 spend is a Nish-only
  decision; see the Toolify.ai section below.)
- **Microlaunch — NEEDS_NISH_STEP.** A free regular submission exists, but
  sign-in (Google or X) is required. Nish must approve/complete the OAuth
  sign-in, then the prepared copy can be submitted. (Lane attempt 2026-08-12:
  NOT EXECUTED — venue still not allowlisted in the fleet venue policy, so the
  agent must not drive the submission; see the Microlaunch section below.)
- **Uneed — NEEDS_NISH_STEP.** A public preview for AI Converter was generated
  in Nish's browser (2026-08-11), but the venue scraped noncanonical copy —
  preview only, NOT a submission. The next step requires account
  creation/login; before scheduling the launch, replace the scraped
  description with the exact approved description in the Uneed kit below.
  (Lane attempt 2026-08-12: NOT EXECUTED — venue still not allowlisted in the
  fleet venue policy, and the free flow needs email-OTP sign-up, so the agent
  must not drive the submission; see the Uneed section below.)
- **Open-Launch — SKIPPED_PAID.** The current direct launch is paid ($12
  Premium Launch) and no usable free route exists now (free slots booked into
  2027); the spend was not made.
- **SaaSHub — NEEDS_NISH_STEP.** The free submission is available
  (https://www.saashub.com/services/submit, URL-only form, then SaaSHub
  crawls the site and an approval queue applies), but saashub.com is not in
  the fleet venue policy allowlist (`automation_disposition: unknown`), so
  the agent must not drive the submission. The optional paid promo (featured
  listing, $99/month recurring) is a Nish-only spend decision. Nish must
  complete the manual submission, then the prepared copy below can be
  submitted. (Lane attempt 2026-08-12: NOT EXECUTED — venue not allowlisted
  in the fleet venue policy; see the SaaSHub section below.)

## Status ledger (fleet re-verification 2026-08-10)

Both baseline venues are still NOT live as of 2026-08-10 — the decisions below
stand unchanged and both kits remain valid and copy-paste ready:

- Product Hunt search `q=aiconverter` (2026-08-10): still zero aiconverter.app
  result; unrelated tools only (Coval, Wingman City Guide, Sibyl AI, ...).
  Launches search `q=bank statement csv` shows exact-category competitors live
  (LedgerBox, BankStatementLab, Convert My Bank Statement, Docsumo) and still no
  AI Converter listing. The category is hosted; the listing is missing.
- BetaList search `q=aiconverter` (2026-08-10): still "No results found for
  aiconverter"; `Submit Startup` still redirects to `/sign_in` (account-gated).
- Kit reference pages all live HTTP 200 (2026-08-10): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` still returns 404, so the no-pricing-link note below still holds.
- **Blocked on a human account action:** Nish owns the manual submissions for
  both venues. After each submission, update this file with the public URL and
  flip the venue's status line to live.

### Fleet re-verification 2026-08-11 (WeLikeTools + xix.ai)

Both venue sections below were added on 2026-08-10 and re-verified live on
2026-08-11 — the decisions stand unchanged and both kits remain valid and
copy-paste ready:

- WeLikeTools search `q=aiconverter` (2026-08-11): still "Found 0 results / No
  tools found" — no duplicate, no aiconverter.app listing. The exact-category
  competitor Bank Statement Engine is still live
  (https://weliketools.com/tool/bankstatementengine, published 2026-07-12,
  Category: Business & Finance, Pricing: Free), so the venue hosts the category
  — only this product's listing is missing. `https://weliketools.com/submit`
  still gates behind Google sign-in ("Log in to Submit", free, no fee or paid
  tier mentioned).
- xix.ai site search `q=aiconverter` (2026-08-11): still "No results found in
  the search"; `https://xix.ai/tool/ai-converter.html` still 404. The
  exact-term category page is still live and still occupied by a competitor —
  "PDF Bank Statements Converter"
  (https://xix.ai/tool/pdf-bank-statements-converter.html, listed 2025-09-08,
  current tool aibankparser.com, tags pdf-csv-converter /
  bank-statement-parser / financial-data-processing-tool). `https://xix.ai/submit`
  still shows the $9.90 paid listing with "no queue, listed within 48 hours".
- Kit reference pages all live HTTP 200 (2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` and `/receipt-to-csv/` still return 404, so the no-pricing-link
  note below still holds and no kit claims those routes.
- **Blocked on a human account action (and one $9.90 spend decision):** Nish
  owns the WeLikeTools submission and the xix.ai paid/decline decision. After
  each action, update this file with the public URL and flip the venue's status
  line to live.

### Fleet re-verification 2026-08-11 (Toolbit.ai)

The Toolbit.ai section below was added on 2026-08-10 and re-verified live on
2026-08-11 — the decision stands unchanged and the kit remains valid and
copy-paste ready:

- Toolbit.ai search `q=aiconverter` (2026-08-11): still no aiconverter.app
  result — unrelated tools only (ConvertFiles.ai, ipic.ai, AICoverGen, and a
  different product named "AI Convert" under Creative Tools).
  `https://toolbit.ai/ai-tool/ai-converter` still 404. The exact-category
  competitors are still live — StatementSheet
  (https://toolbit.ai/ai-tool/statementsheet, "Convert PDF bank statements to
  Excel or CSV", Data Extraction, 9.5K monthly visits, Paid from $20) and
  Rocket Statements (https://toolbit.ai/ai-tool/rocketstatements, "Convert
  Bank Statements to Excel, CSV & JSON", Document Analysis / OCR, 4.8K monthly
  visits, Paid) — so the venue hosts the category; only this product's listing
  is missing. Note: Rocket Statements moved from `/ai-tool/rocket-statements`
  (now 404) to `/ai-tool/rocketstatements`; the kit uses the current URL.
- Plans (https://toolbit.ai/submit, re-verified 2026-08-11): paid **Launch
  Tool $29 / One-time** (listed within 24h, blue verified badge, sidebar
  featured 1 day, permanent directory listing, one X post) unchanged; FAQ
  still: "Free community listings require embedding our Launch Badge on your
  website and are reviewed in up to 3 days." `/submit/tool?plan=free` still
  renders the sign-in wall, and `/launch-badge` still 404 — the badge snippet
  stays account-gated.
- ToS (https://toolbit.ai/terms-and-conditions, last updated 2026-07-20,
  re-read live 2026-08-11): section 7 "Prohibited Uses" still prohibits "any
  robot, spider, or other automatic device, process, or means to access
  Service for any purpose" — same class of language as Product Hunt's
  prohibition; flag for the venue research desk.
- Kit reference pages all live HTTP 200 (2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` and `/receipt-to-csv/` still return 404, so the kit claims none
  of those routes.
- **Blocked on a human account action:** Nish owns the free submission and the
  $29 paid decision. After each action, update this file with the public URL
  and flip the venue's status line to live.

### Fleet re-verification 2026-08-11 (Toolify.ai)

The Toolify.ai section below was added on 2026-08-11 and verified live on
2026-08-11 — the decision stands as recorded and the kit remains valid and
copy-paste ready:

- Toolify search `q=aiconverter` (2026-08-11, JS-rendered): "Sorry, there are
  no tools containing your keywords at the moment" — no aiconverter.app
  result, no duplicate. `https://www.toolify.ai/tool/ai-converter` returns
  404.
- The exact-category tag pages are still competitor-occupied: "The best ai
  tools for Bank Statement to CSV are: LedgerBox"
  (https://www.toolify.ai/tag/Bank%20Statement%20to%20CSV, 2 AIs, updated
  2026-08-11) and the same verdict on /tag/Bank%20Statement%20to%20Excel —
  LedgerBox is live at https://www.toolify.ai/tool/ledgerbox ("AI-powered
  bank statement converter from PDF to Excel and CSV", added 2023-11-11). The
  venue hosts the category; only this product's listing is missing.
- Submit page (live 2026-08-11, matching Wayback capture 2026-07-04): paid
  path only — **$99 one-time**, "No queue, listed within 48 hours", "Pay
  $99". Form: Name + Website URL + content mode ("Generated by Toolify" —
  Toolify AI writes all copy and translations from the site; "Do it myself" —
  submitter provides English, Toolify translates). Benefits listed: listing
  and "Just Launched" within 48 hours, border highlight, no less than 6
  quality dofollow links, listing & traffic forever, Toolify AI Launch
  embeds + AI certification.
- Fulfillment Policy (https://www.toolify.ai/fulfillment-policy, last
  updated 2024-08-30, archived copy re-read 2026-07-02): one-time payment
  program; account registration required; "Toolify may reject your
  application for an Account for any reason, in our sole discretion"; **the
  payment fee is non-refundable** ("The payment fee is non-refundable, even
  if you cancel or do not use any of the benefits"). No robot/spider/
  automated-access prohibition found in the policy (unlike Product Hunt's ToS
  and Toolbit.ai's ToS §7) — no separate ToS page exists beyond Fulfillment
  Policy and Privacy Policy.
- Kit reference pages all live HTTP 200 (2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` and `/receipt-to-csv/` still return 404, so the kit claims none
  of those routes.
- **Blocked on a human account action and a $99 spend decision:** Nish owns
  the paid submission (account creation, payment, form). After the action,
  update this file with the public URL and flip the venue's status line to
  live.

### Fleet re-verification 2026-08-11 (Microlaunch)

The Microlaunch section below was added on 2026-08-11 and verified live on
2026-08-11 — the decision stands as recorded and the kit remains valid and
copy-paste ready:

- The two exact-category peers are live at their current slugs, both with
  launch records carrying `is_premium: false` (regular, non-paid launches):
  Bank Statement Converter (https://microlaunch.net/p/bankstatementconverter,
  launched 2026-02-08, market analytics, "Free product", mvp-wip) and
  Bankformats (https://microlaunch.net/p/bankformats, launched 2026-06-14,
  market accounting, Subscription, growing). The venue hosts the category;
  only this product's listing is missing.
- No aiconverter.app duplicate: the full launches API (5,660 products)
  contains no aiconverter / "AI Converter" codename or slug, and
  /p/aiconverter, /p/ai-converter, /p/ai-converter-app, /p/aiconverter-app
  all return no product.
- "+ New Launch" (nav) opens the "Pick your Launch" modal — Pro Launch card
  ($39, struck $49, code LAUNCH20, 40 spots/month, CTA "Go Pro Now!" →
  /premium#stats); /submit redirects to /premium#pricing; the premium page
  FAQ names a "Regular launch" tier and both peers' non-premium records
  confirm it exists.
- Sign-in gate: the header modal offers "Signup with Google" and "Signup
  with 𝕏" — account-gated.
- ToS (https://microlaunch.net/terms, "Last updated on 04/03/2023") is a
  generic template with no robot/spider/automated-access prohibition (unlike
  Product Hunt's ToS and Toolbit.ai's ToS §7) — flag for the venue research
  desk (the guard stays exit-4 either way).
- Kit reference pages all live HTTP 200 (2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` and `/receipt-to-csv/` still return 404, so the kit claims none
  of those routes.
- **Blocked on a human account action (and one $39 spend decision):** Nish
  owns the regular-launch submission and the Pro Launch paid/decline
  decision. After each action, update this file with the public URL and flip
  the venue's status line to live.

### Fleet re-verification 2026-08-11 (Uneed)

The Uneed section below was added on 2026-08-11 and verified live on
2026-08-11 — the decision stands as recorded and the kit remains valid and
copy-paste ready:

- The five exact-category peers are all live under Business, all with
  non-premium (`premium: false`) listings in the public search API —
  free-tier launches are real on this venue:
  - StatementSheet (https://www.uneed.best/tool/statementsheet, "Convert PDF
    Bank statements to Excel or CSV", launched 2025-11-16),
  - Bank PDF Converter (https://www.uneed.best/tool/bank-pdf-converter,
    "Convert Bank PDF Statements into Polished Excel, CSV, or JSON format.",
    launched 2024-06-27),
  - BankConv (https://www.uneed.best/tool/bankconv, "Convert PDF bank
    statements from 1000+ banks worldwide into Excel/CSV instantly.", launch
    records incl. 2026-08-08),
  - PdfBuddy (https://www.uneed.best/tool/pdfbuddy, "Convert bank statement
    and invoice PDFs to Excel or CSV files instantly.", launch records incl.
    2026-08-09),
  - BankScanPro (https://www.uneed.best/tool/bankscanpro, "Convert bank
    statements from PDF to CSV with AI accuracy.", launch records incl.
    2026-05-22).
  The venue hosts the category; only this product's listing is missing.
- No aiconverter.app duplicate (public search API, live 2026-08-11):
  `q=aiconverter` → no aiconverter.app result; `q=AI Converter` → unrelated
  converters only (Convert.ai, Heic Converter, SVG Converter, Convertology
  AI, AI Cover, TailConverter, ConvertHub, File Converter — Iconscout, ...).
  Slug probes /tool/ai-converter, /tool/aiconverter, /tool/ai-converter-app
  all 404.
- Free queue is long and honest about it: `GET /api/v1/launch-dates` (public,
  live 2026-08-11) returns `free_next_available: 2027-01-31` (173 days out)
  with Skip-the-Line dates bookable from 2026-08-13 — the ~5-month wait the
  launch guide warns about is now ~6 months.
- Agent path (the venue's own, official): https://www.uneed.best/launch.txt
  is an "Agent Launch Guide" — AI agents may submit and schedule a product
  launch end-to-end without a browser (email OTP auth, then a free queue
  launch or a paid Skip-the-Waiting-Line on a chosen date) via
  `POST /api/v1/auth/request-code` → `verify` → `POST /api/v1/products` →
  `POST /api/v1/launches` (`tier: "free"` or `"stwl"` + date). Free accounts
  may keep ONE product in the waiting line at a time
  (`waiting_line_limit_reached`, 429). A public read-only MCP server
  (https://mcp.uneed.best/mcp) and REST search API
  (https://mcp.uneed.best/v1/search?q=...) expose the same product data to
  agents. This is the first venue in this file with vendor-official agent
  submission support — flag for the venue research desk as positive evidence
  for a future `automation_disposition` review of uneed.best.
- ToS (https://www.uneed.best/terms-of-use, "Last Updated: July 31, 2025",
  Uneed Platform, Nantes, France): the prohibited-uses section targets
  automated engagement abuse — "using scripts to send comments or messages"
  and "bots, scripts, or automated tools to manipulate votes, rankings, or
  any other metrics" — not product submission, and no blanket
  robot/spider/crawl prohibition like Product Hunt's ToS or Toolbit.ai's ToS
  §7. Combined with the venue-published launch.txt agent flow, the ToS does
  not prohibit agent submission — still flag for the venue research desk
  (the guard stays exit-4 until the ledger is updated).
- **Blocked on a human account action (and one $29.99 spend decision):** the
  free flow needs an account (email OTP per launch.txt; the submit page says
  "No account needed to start — we'll scrape your page first, then ask you to
  sign up to save it"), and Skip the Waiting Line costs $29.99. Nish owns the
  sign-up and the free-queue launch (or the STWL spend call). After each
  action, update this file with the public URL and flip the venue's status
  line to live.

### Fleet re-verification 2026-08-11 (Open-Launch)

The Open-Launch section below was added on 2026-08-11 and verified live on
2026-08-11 — the decision stands as recorded and the kit remains valid and
copy-paste ready:

- Site search `q=aiconverter` and `q=ai converter` (the platform's own
  `/api/search`, same query the nav search box uses) both return zero results
  — no duplicate, no aiconverter.app listing. Slug probes
  `/projects/aiconverter`, `/projects/ai-converter`,
  `/projects/aiconverter-app`, `/projects/ai-converter-app` all 404.
- The exact-category is heavily hosted — 10+ bank-statement-converter peers
  live, all HTTP 200 (2026-08-11): AI Bank Statement
  (/projects/ai-bank-statement), bank-statementconverter.com
  (/projects/bank-statementconverter-com), BankScanPro | PDF to Excel/CSV
  (/projects/bankscanpro-pdf-to-excel-csv), Reconciliate Bank / Credit Card
  Statements with AI (/projects/reconciliate-bank-credit-card-statements-with-ai),
  Bank Statement Boss (/projects/bank-statement-boss), AIBankStatement
  (/projects/aibankstatement), Bank PDF Converter (/projects/bank-pdf-converter),
  StatementSheet (/projects/statementsheet), Bank Statement Converter AI
  (/projects/bank-statement-converter-ai), and Bank Statement Engine
  (/projects/bank-statement-engine — also listed in the live `finance-tech`
  category page). The venue hosts the category; only this product's listing
  is missing.
- Pricing page (live 2026-08-11): **Premium Launch $12 / launch** — "The only
  way to launch right now", "Launch Tomorrow - No Wait!", guaranteed dofollow
  backlink from a DR 71 domain, only 10 premium slots daily, immediate
  availability, featured on homepage; **Free Launch $0 fully booked into
  2027** ("Want free? We'll email you when it reopens — just start a
  launch."); SEO Growth Package $59 (was $199). FAQ (2026-08-11): all
  launches at 8:00 AM UTC; "Premium users get 10 dedicated priority slots
  daily"; "free launch slots are fully booked into 2027. Premium launches
  are open and let you launch as early as tomorrow, up to 60 days in
  advance."
- `/projects/submit` renders the sign-in wall (login with Google, login with
  GitHub, or email + password) — account-gated; the anonymous flow stops
  there. robots.txt disallows `/api/`, `/projects/submit`, `/sign-in`,
  `/payment/`, `/dashboard`.
- ToS (https://open-launch.com/legal/terms, "Last updated: August 11, 2026")
  is a generic template; section 2 Acceptable Use has **no
  robot/spider/automated-access prohibition** (unlike Product Hunt's ToS and
  Toolbit.ai's ToS §7) — flag for the venue research desk (the guard stays
  exit-4 either way). Section 11: all payments final and non-refundable.
  Platform is open source (github.com/openlaunch-org/Open-Launch, "The first
  complete open source alternative to Product Hunt"); source confirms
  LAUNCH_LIMITS.PREMIUM_DAILY_LIMIT = 10 and the 8:00 AM UTC launch hour,
  with payment via a Stripe-style `PREMIUM_PAYMENT_LINK` inside the
  signed-in flow.
- Kit reference pages all live HTTP 200 (2026-08-11): `/`, `/llms.txt`,
  `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
  `/pricing/` and `/receipt-to-csv/` still return 404, so the kit claims none
  of those routes.
- **Blocked on a human account action (and one $12 spend decision):** Nish
  owns the account creation (Google / GitHub / email sign-in) and the
  Premium Launch paid/decline decision. After the action, update this file
  with the public URL and flip the venue's status line to live.

## Product Hunt

### Decision (dated 2026-08-09)

- **Outcome: declined for automated submission. Manual kit prepared below.**
- Reason: Product Hunt ToS (reviewed live 2026-08-09 from
  https://www.producthunt.com/legal) prohibit crawling/scraping "through use of
  manual or automated means" and any "processes that run or are activated while
  you are not logged into the Services". Venue policy ledger marks
  `producthunt.com` as `automation_disposition: prohibited`; `venue-claim claim`
  exits 4 (policy block). An account already exists for the fleet
  (`nishant345+producthunt@gmail.com`, plus-address) but submission is a human
  account action.
- Live evidence (2026-08-09): Product Hunt search `q=aiconverter` returns no
  aiconverter.app result (unrelated tools only: Coval, Wingman City Guide, Sibyl
  AI, ...). Exact-category competitors are listed (receipt-ai, ledgerbox), so the
  venue hosts the category — the listing itself is missing.
- Next action: Nish submits manually using the kit below, then this file should
  be updated with the public product URL.

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline (55/60 chars): **Bank statement PDFs to CSV you can review before paying**
- Description (231/260 chars): **Turn bank statement PDFs into spreadsheet-ready
  CSV in your browser. Check sample rows free, then unlock the full extraction
  only when the preview looks right. OCR fallback for scans; low-confidence jobs
  fail closed with no charge.**
- Topics: Artificial Intelligence, Productivity, Finance
- Website: https://aiconverter.app
- First comment (maker story, draft):

  > I built AI Converter because bank statement cleanup was eating my
  > bookkeeping hours. It takes a bank statement PDF, parses it in the browser,
  > and shows you sample rows before you pay anything — you only unlock the full
  > CSV when the preview actually looks right. Scanned statements fall back to
  > OCR, and when confidence is too low the job fails closed instead of charging
  > you for garbage. No bank logins, no human review queue, and source files are
  > deleted after 24 hours. Preview first, pay only for what you can see.

- Key features (3-5 bullets for the listing):
  - Bank statement PDF to CSV with a built-in parser first, OCR fallback for scans.
  - Free preview: review sample rows and download a sample CSV before paying.
  - Fail-closed extraction: low-confidence conversions are not charged.
  - No bank login and no human review queue; source files deleted after 24 hours.
  - Paid jobs get one automatic stronger redo.

- Canonical links for the listing (all verified live HTTP 200 on 2026-08-09):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/

## BetaList

### Decision (dated 2026-08-09)

- **Decision: SUBMIT — manual submission by Nish.**
- Reason: BetaList is a free, live, category-relevant launch directory (AI Tools,
  Personal Finance, Productivity categories all fit; daily startup posts confirm
  activity). Search `q=aiconverter` returns "No results found", so there is no
  duplicate. aiconverter.app meets eligibility: working website on its own domain
  (own-domain rule satisfied; app-store/free-subdomain links are rejected).
- Constraint: `Submit Startup` redirects to `/sign_in` (account-gated). BetaList
  is not in the venue policy allowlist (`automation_disposition: unknown`), so
  `venue-claim claim` exits 4 — the agent must not drive a browser submission.
  Submission is a human account action, same as Product Hunt.
- **Superseded 2026-08-11:** the 2026-08-09 claim that the standard submission
  is free is stale — BetaList's official Support page now states all
  submissions are paid and no free option exists (outcome: SKIPPED_PAID, see
  the submission outcomes ledger above). The kit below is retained as copy
  reference only.
- Next action: Nish signs in and submits using the kit below, then this file
  should be updated with the public startup URL.

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline: **Bank statement PDFs to CSV you can review before paying**
- Description:

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Category suggestions: AI Tools, Personal Finance, Productivity
- Website: https://aiconverter.app

## WeLikeTools

### Decision (dated 2026-08-10, re-verified 2026-08-11 and 2026-08-12)

- **Decision: SUBMIT — manual submission by Nish (free, no fee).**
- Reason: WeLikeTools is a free, live, category-relevant tools directory with
  Business & Finance, Personal Finance, Productivity & Management, and AI
  Assistants categories that all fit. Search `q=aiconverter` returns "Found 0
  results" / "No tools found", so there is no duplicate. An exact-category
  competitor is already listed — Bank Statement Engine
  (https://weliketools.com/tool/bankstatementengine, published 2026-07-12,
  Category: Business & Finance, Pricing: Free) — so the venue hosts the
  category; only this product's listing is missing. No fee or paid tier is
  mentioned on either submission page.
- Constraint: https://weliketools.com/submit gates behind Google sign-in
  ("Log in to Submit" / "Log in to Get Started"). WeLikeTools is not in the
  venue policy allowlist (`automation_disposition: unknown`), so
  `venue-claim claim` exits 4 — the agent must not drive a browser submission.
  Submission is a human account action, same as BetaList.
- Next action: Nish signs in with Google and submits using the kit below, then
  this file should be updated with the public tool URL.

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline: **Bank statement PDFs to CSV you can review before paying**
- Description:

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Category suggestions: Business & Finance, Personal Finance, Productivity &
  Management
- Pricing: Free preview; paid per-page plans
- Website: https://aiconverter.app
- Key features (3-5 bullets for the listing):
  - Bank statement PDF to CSV with a built-in parser first, OCR fallback for scans.
  - Free preview: review sample rows and download a sample CSV before paying.
  - Fail-closed extraction: low-confidence conversions are not charged.
  - No bank login and no human review queue; source files deleted after 24 hours.
  - Paid jobs get one automatic stronger redo.

### Fleet lane attempt 2026-08-12 (WeLikeTools — NOT EXECUTED)

- Attempted by lane 1 (packet item c716f1de42: "List the product on the free
  WeLikeTools directory"). The listing was **not submitted**: the decision
  above still binds. `agent-state/growth-loop/venue-policy.json` (updated
  2026-08-08) has no weliketools.com entry — `automation_disposition: unknown`,
  not in the allowlist — so `venue-claim claim` exits 4 and the agent must not
  drive the browser submission. Submission also requires a human account
  action: `https://weliketools.com/submit` renders "Log in to Submit" /
  "Log in with Google" (re-verified live 2026-08-12), and Google OAuth stays
  with Nish. The `venue-claim` binary is not installed in the lane
  environment, but the policy JSON is the authoritative guard and is
  unchanged; this record is the honest NOT-EXECUTED lane outcome the packet
  requires.
- Live re-verification (2026-08-12, plain HTTP; the site is not
  Cloudflare-challenged for curl):
  - No duplicate: search `q=aiconverter`
    (https://weliketools.com/search?q=aiconverter) — "Found 0 results" /
    "No tools found" (HTTP 200), only the echoed query matches
    "aiconverter" in the page; no aiconverter.app listing anywhere.
  - Exact-category competitor still live and still free:
    https://weliketools.com/tool/bankstatementengine — HTTP 200, "Bank
    Statement Engine", `datePublished` 2026-07-12, Category: Business &
    Finance (also APIs, Dev Tools), "Pricing: Free" (free tier: no account,
    no credit card, 10 pages/day anonymous; free registered account
    unlimited — no paid subscriptions).
  - Submit page live, HTTP 200: https://weliketools.com/submit — "Log in to
    Submit" / "Log in with Google" gate; no fee or paid tier mentioned
    anywhere on the page.
  - robots.txt (live 2026-08-12) — `Disallow: /api/`, `Disallow: /auth/`:
    no public submission API exists; the auth/submit flows are explicitly
    disallowed for automated access.
  - Terms (https://weliketools.com/terms, HTTP 200, read live 2026-08-12):
    prohibited content includes "Using automated tools to scrape or harvest
    data from our website" — a scraping prohibition (same class of language
    as Product Hunt's ToS and Toolbit.ai's ToS §7, scoped to data
    scraping/harvesting rather than listing submission) — flag for the venue
    research desk; the guard stays exit-4 either way.
  - Kit reference pages all live HTTP 200: `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`;
    `/pricing/` and `/receipt-to-csv/` still 404 (unchanged; the kit claims
    none of those routes).
- Next action (unchanged): Nish signs in with Google and submits using the
  kit above. The only route to an agent-executed submission would be the
  venue research desk reviewing weliketools.com and adding it to the policy
  allowlist (and Nish providing an account or approving the flow). After the
  listing, confirm search `q=aiconverter` returns the tool and update this
  file with the public URL, then flip this venue's status line to live.

## xix.ai

### Decision (dated 2026-08-10, re-verified 2026-08-11 and 2026-08-12)

- **Decision: PAID listing at $9.90 recommended; declined for agent-executed
  submission. The $9.90 spend and the submission are Nish's human actions — the
  kit below is ready, and this line becomes SUBMITTED (or DECLINED) once Nish
  decides on the spend.**
- Reason: xix.ai hosts a dedicated, exact-term category page for this product's
  core job — "PDF Bank Statements Converter"
  (https://xix.ai/tool/pdf-bank-statements-converter.html, tool listed
  2025-09-08, currently occupied by competitor aibankparser.com, tagged
  pdf-csv-converter / bank-statement-parser / financial-data-processing-tool) —
  and aiconverter.app is absent (site search returns no hit;
  /tool/ai-converter.html is 404). The submit page (live 2026-08-10, re-verified
  2026-08-11) is payment-gated: "$9.90, no queue, listed within 48 hours",
  account sign-in required, graphic captcha at the payment step (scout-verified
  2026-08-09). At $9.90 with no queue and an exact-term page already indexed,
  the listing is cheap enough to be worth testing; if Nish declines the spend,
  this paragraph is the dated decline record.
- Money boundary: $9.90 is a spend decision only Nish can make; the agent
  cannot pay or create the account. xix.ai is not in the venue policy allowlist
  (`automation_disposition: unknown`), so `venue-claim claim` exits 4 — no
  agent-driven browser submission.
- Next action: Nish signs in, pays $9.90, and submits using the kit below, then
  this file should be updated with the public tool URL.

### Manual submission kit (copy-paste ready)

- Name (50 char max): **AI Converter**
- Website: https://aiconverter.app
- Description (rich-text, word-counted):

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Product type/category: pick the Finance/Productivity tool category in the
  form's category selector.
- Contact email: use the fleet plus-address for this venue.

### Fleet lane attempt 2026-08-12 (xix.ai — decision recorded, NOT EXECUTED)

- Attempted by lane 1 (packet item c716f1de42: "record a paid/decline
  decision for xix.ai"). The dated decision stands as recorded above: **PAID
  listing at $9.90 recommended for evaluation; declined for agent-executed
  submission** — the $9.90 spend and the account creation are Nish's human
  actions, and no spend authorization exists (`agent-state/authorizations/`
  holds only the sol-xhigh-worker-grant; the dispatch ledger has no xix.ai
  entry). `agent-state/growth-loop/venue-policy.json` (updated 2026-08-08)
  has no xix.ai entry — `automation_disposition: unknown`, not in the
  allowlist — so `venue-claim claim` exits 4 and the agent must not drive the
  browser submission. The `venue-claim` binary is not installed in the lane
  environment, but the policy JSON is the authoritative guard and is
  unchanged; this record is the honest NOT-EXECUTED lane outcome the packet
  requires (the dated decision line above flips to SUBMITTED or DECLINED only
  after Nish decides on the spend).
- Live re-verification (2026-08-12, plain HTTP):
  - No duplicate: site search `q=aiconverter`
    (https://xix.ai/search?q=aiconverter) — "No results found" (HTTP 200);
    https://xix.ai/tool/ai-converter.html — HTTP 404.
  - Exact-term category page still live and still competitor-occupied:
    https://xix.ai/tool/pdf-bank-statements-converter.html — HTTP 200,
    "PDF Bank Statements Converter", current tool aibankparser.com
    (unchanged from the 2026-08-11 record).
  - Submit page still payment-gated, HTTP 200: https://xix.ai/submit —
    "$9.90", "No queue, listed within 48 hours", sign-in required
    ("Sign In" ×8 on page), graphic captcha at the payment step
    ("captcha" ×9) — unchanged.
  - Kit reference pages all live HTTP 200: `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`;
    `/pricing/` and `/receipt-to-csv/` still 404 (unchanged; the kit claims
    none of those routes).
- Next action (unchanged): Nish decides on the $9.90 spend (SUBMITTED or
  DECLINED), signs in, and submits using the kit above. After the listing,
  confirm the tool appears on the "PDF Bank Statements Converter" category
  page and update this file with the public URL, then flip this venue's
  status line to live.

## Toolbit.ai

### Decision (dated 2026-08-10, re-verified 2026-08-11)

- **Decision: SUBMIT — free community listing first ("Launch Tool $0"),
  manual by Nish. Paid plan recorded and deferred.**
- Reason: Toolbit.ai is a live, category-relevant AI tools directory (homepage:
  "search 10,000+ AI tools") that already lists exact-category competitors:
  StatementSheet (https://toolbit.ai/ai-tool/statementsheet — "Convert PDF
  bank statements to Excel or CSV", Data Extraction, 9.5K monthly visits,
  paid) and Rocket Statements
  (https://toolbit.ai/ai-tool/rocketstatements — "Convert Bank Statements to
  Excel, CSV & JSON", Document Analysis / OCR, 4.8K monthly visits, paid).
  Search `q=aiconverter` returns no aiconverter.app result (unrelated tools
  only: ConvertFiles.ai, ipic.ai, AICoverGen, and a different product named
  "AI Convert" under Creative Tools), so there is no duplicate — the category
  is hosted, only this listing is missing.
- Free plan first (plans verified live on https://toolbit.ai/submit,
  2026-08-10, re-verified 2026-08-11): the free community listing is **Launch
  Tool $0 / Forever** — free with Launch Badge verification, do-follow SEO
  backlink, reviewed up to 3 days, permanent directory listing. FAQ (submit
  center, 2026-08-11): "Free community listings require embedding our Launch
  Badge on your website and are reviewed in up to 3 days."
- Paid option recorded (deferred): **Launch Tool $29 / One-time** — listed
  within 24h, blue verified badge, sidebar featured (1 day), permanent
  directory listing, one social media (X) post. ToS section 5: paid
  submissions are charged at checkout before review; full refund (minus
  processing fees) if rejected. Decision: the $29 paid launch is an optional
  commercial call by Nish, not required for the free listing.
- Verified requirement: the free listing's verification step is embedding
  Toolbit's Launch Badge on aiconverter.app. The badge snippet is
  account-gated (only revealed in the submission flow; /launch-badge, /badge
  and /submit/launch-badge all 404, re-verified 2026-08-11), so embedding is a
  follow-up owner action that needs a tiny deploy once Nish has the snippet.
- Constraint: `/submit/tool?plan=free` renders the sign-in wall
  (re-verified 2026-08-11; signup at /signup) — account-gated. toolbit.ai is
  not in the venue policy allowlist (`automation_disposition: unknown`, not
  yet reviewed in `venue-policy.json` as of 2026-08-11), so the agent must not
  drive a browser submission. ToS review lead
  (https://toolbit.ai/terms-and-conditions, last updated 2026-07-20, re-read
  live 2026-08-11): section 7 "Prohibited Uses" prohibits "any robot, spider,
  or other automatic device, process, or means to access Service for any
  purpose" — same class of language as Product Hunt's prohibition; flag for
  the venue research desk (the guard stays exit-4 either way). Submission
  (create account, submit via the account-gated flow, embed the Launch Badge)
  is a human account action, same as the other venues.
- Next action: Nish signs in (Google or email) and submits using the kit
  below, embeds the Launch Badge snippet on aiconverter.app (tiny deploy) to
  complete the free-verified listing, then this file should be updated with
  the public tool URL.

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline: **Bank statement PDFs to CSV you can review before paying**
- Description:

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Category suggestions: Data Extraction, Document Automation, OCR / Document
  Analysis (all live Toolbit categories 2026-08-10; exact-category peers sit
  under Data Extraction and Document Analysis).
- Pricing tag suggestion: Freemium (free preview + paid extraction, matching
  live checkout behavior).
- Website: https://aiconverter.app
- Canonical links for the listing (all verified live HTTP 200 on 2026-08-10
  and re-verified 2026-08-11):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/

### Fleet lane attempt 2026-08-12 (Toolbit.ai — NOT EXECUTED)

- Attempted by lane 1 (packet: "List the product on Toolbit.ai (free plan
  first; record paid/verified decision)"). The listing was **not submitted**:
  the decision above still binds. `agent-state/growth-loop/venue-policy.json`
  (updated 2026-08-08) has no toolbit.ai entry — `automation_disposition:
  unknown`, not in the allowlist — so `venue-claim claim` exits 4 and the
  agent must not drive the browser submission. The free flow is also a human
  account action (sign-in wall at `/submit/tool?plan=free`) and its
  verification step (embedding the Launch Badge) is account-gated too, and
  ToS section 7 prohibits automated access (same class of language as Product
  Hunt's prohibition). No spend authorization exists in `agent-state`
  (authorizations/ holds only the sol-xhigh worker grant; the dispatch
  ledger has no Toolbit entry). The `venue-claim` binary is not installed in
  the lane environment, but the policy JSON is the authoritative guard and is
  unchanged; this record is the honest NOT-EXECUTED lane outcome the packet
  requires.
- Live re-verification (2026-08-12, plain HTTPS GETs — toolbit.ai serves
  curl without a Cloudflare challenge):
  - No duplicate: site search `q=aiconverter`
    (https://toolbit.ai/search?q=aiconverter, "aiconverter - AI Tools
    Search") returns only the same unrelated tools as the 2026-08-11 record —
    ConvertFiles.ai (/ai-tool/convertfiles-ai), ipic.ai (/ai-tool/ipic-ai),
    AICoverGen (/ai-tool/ai-cover-generator), and "AI Convert"
    (/ai-tool/ai-to-human-text-converter) — and zero `aiconverter.app`
    mentions in the results.
    https://toolbit.ai/ai-tool/ai-converter still serves a soft-404 page
    (HTTP 200 shell, `<title>Page Not Found - 404 Error | Toolbit.ai</title>`).
  - Exact-category competitors still live: StatementSheet
    (https://toolbit.ai/ai-tool/statementsheet — "Convert PDF bank
    statements to Excel or CSV", Data Extraction, 9.5K monthly visits;
    `visits":9455` in the page data) and Rocket Statements
    (https://toolbit.ai/ai-tool/rocketstatements — "Convert Bank Statements
    to Excel, CSV & JSON", Document Analysis / OCR). The venue hosts the
    category; only this product's listing is missing.
  - Submit page live, HTTP 200: https://toolbit.ai/submit ("Submit Center") —
    FAQ still: "Free community listings require embedding our Launch Badge on
    your website and are reviewed in up to 3 days."; the paid **Launch Tool
    $29 / One-time** plan is still offered on the page.
  - `/submit/tool?plan=free` still renders the sign-in wall ("Sign In -
    Toolbit.ai"); `/launch-badge` still 404 — the badge snippet stays
    account-gated.
  - ToS (https://toolbit.ai/terms-and-conditions, "Last updated: July 20,
    2026", re-read live 2026-08-12): section 7 "Prohibited Uses" still
    prohibits "any robot, spider, or other automatic device, process, or
    means to access Service for any purpose, including monitoring or copying
    any of the material on Service" — same class of language as Product
    Hunt's prohibition; flag for the venue research desk.
  - Kit reference pages all live HTTP 200 (2026-08-12): `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
    `/pricing/` and `/receipt-to-csv/` still 404, so the kit claims none of
    those routes.
- Paid/verified decision (re-recorded 2026-08-12, unchanged): **free
  community listing first** — "Launch Tool $0 / Forever" with Launch Badge
  verification, reviewed in up to 3 days, permanent directory listing. The
  paid **Launch Tool $29 / One-time** (listed within 24h, blue verified
  badge, sidebar featured 1 day, one X post) stays deferred to Nish's spend
  call. The free listing's "verified" step — embedding Toolbit's Launch
  Badge snippet on aiconverter.app — is a follow-up owner action that needs
  a tiny deploy once Nish has the snippet from the submission flow (the
  snippet is account-gated and `/launch-badge` still 404).
- Next action (unchanged): Nish signs in (Google or email) and submits using
  the kit above, embeds the Launch Badge snippet on aiconverter.app (tiny
  deploy) to complete the free-verified listing, then this file should be
  updated with the public tool URL. The only route to an agent-executed
  submission would be the venue research desk reviewing toolbit.ai's ToS §7
  (which, like Product Hunt's, prohibits automated access) and adding the
  venue to the policy allowlist. After the listing, confirm the tool appears
  in search `q=aiconverter` on toolbit.ai and flip this venue's status line
  to live.

## Toolify.ai

### Decision (dated 2026-08-11)

- **Decision: PAID listing at $99 recommended for evaluation; declined for
  agent-executed submission. The $99 spend and the submission are Nish's
  human actions — the kit below is ready, and this line becomes SUBMITTED (or
  DECLINED) once Nish decides on the spend.**
- Reason: Toolify is a live, category-relevant AI tools directory (homepage:
  "30237 AIs and 459 categories", submit page claims 5.1M+ monthly visits)
  that already hosts the exact-category tag pages — "Bank Statement to CSV"
  and "Bank Statement to Excel" both lead with LedgerBox
  (https://www.toolify.ai/tool/ledgerbox, "AI-powered bank statement
  converter from PDF to Excel and CSV", added 2023-11-11) — while site search
  `q=aiconverter` returns no aiconverter.app result ("Sorry, there are no
  tools containing your keywords at the moment") and `/tool/ai-converter` is
  404. No duplicate exists; the category is hosted; only this listing is
  missing.
- The submit path is payment-gated (live 2026-08-11): "Total: $99", "No
  queue, listed within 48 hours", "Pay $99" — a one-time payment per the
  Fulfillment Policy, which also states the fee is non-refundable ("even if
  you cancel or do not use any of the benefits") and that Toolify "may reject
  your application for an Account for any reason, in our sole discretion".
  There is no free tier on the submit page. At $99 with no queue and an
  exact-term tag page already live and updated daily, the listing is a real
  but non-trivial spend; if Nish declines, this paragraph is the dated
  decline record.
- Money boundary: $99 is a spend decision only Nish can make; the agent
  cannot pay or create the account. toolify.ai is not in the venue policy
  allowlist (`automation_disposition: unknown`, not yet reviewed in
  `venue-policy.json` as of 2026-08-11), so `venue-claim claim` exits 4 — no
  agent-driven browser submission. Unlike Product Hunt's ToS and Toolbit.ai's
  ToS §7, the Fulfillment Policy contains no robot/spider/automated-access
  prohibition, but the guard stays exit-4 either way (policy not yet
  reviewed). Submission (create account, pay, submit the form) is a human
  account action, same as the other venues.
- Next action: Nish signs in, pays $99, and submits using the kit below, then
  this file should be updated with the public tool URL.

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Website URL: https://aiconverter.app
- Content mode: **"Do it myself"** (submitter provides English; Toolify
  translates) — with the description below. The alternative "Generated by
  Toolify" mode has Toolify AI write all copy and translations from the site
  and is the lower-effort option if the manual copy is declined.
- Description (English, for "Do it myself"):

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Tags to confirm after listing (the tags LedgerBox carries that surface the
  exact-category pages): Bank Statement to CSV, Bank Statement to Excel, PDF
  to CSV, Convert Documents, Document Processing.
- Canonical links for the listing (all verified live HTTP 200 on 2026-08-11):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/
- Post-listing check: confirm the tool appears on
  https://www.toolify.ai/tag/Bank%20Statement%20to%20CSV and that search
  `q=aiconverter` returns the listing; update this file with the public URL.

### Fleet lane attempt 2026-08-12 (Toolify.ai — NOT EXECUTED)

- Attempted by lane 2 (packet: "List the product on Toolify.ai (paid $99
  submit path)"). The listing was **not submitted and the $99 was not paid**:
  the decision above still binds. `agent-state/growth-loop/venue-policy.json`
  (updated 2026-08-08) has no toolify.ai entry — `automation_disposition:
  unknown`, not in the allowlist — so `venue-claim claim` exits 4 and the
  agent must not drive the browser submission. The $99 one-time fee is a
  spend decision only Nish can make ("Money boundary" above), and the
  Fulfillment Policy requires account registration (human account action).
  No spend authorization exists in `agent-state` (authorizations/ holds only
  the sol-xhigh worker grant; the dispatch ledger has no Toolify entry). The
  `venue-claim` binary is not installed in the lane environment, but the
  policy JSON is the authoritative guard and is unchanged; this record is the
  honest NOT-EXECUTED lane outcome the packet requires.
- Live re-verification (2026-08-12, headless Chromium JS-rendered; curl is
  Cloudflare-challenged):
  - Exact-category tag page live and updated today:
    https://www.toolify.ai/tag/Bank%20Statement%20to%20CSV — "Discover Best AI
    Tools for Bank Statement to CSV", "The best ai tools for Bank Statement to
    CSV are: LedgerBox.", "Number of Als: 2", "Updated time: August 12 2026".
    No AI Converter on the page.
  - Competitor listing live: https://www.toolify.ai/tool/ledgerbox — HTTP 200,
    "LedgerBox: AI-powered bank statement converter from PDF to Excel and CSV."
  - No duplicate: https://www.toolify.ai/tool/ai-converter → HTTP 404 "Page
    not found"; site search API (the autocomplete endpoint)
    `GET https://www.toolify.ai/self-api/v1/best-for-professions?search=aiconverter`
    → `{"total": 0, "data": []}`; `search=ai-converter` and
    `search=ai converter` → also total 0. The 2026-08-11 JS-rendered search
    record ("Sorry, there are no tools containing your keywords at the
    moment") still stands.
  - Submit page live, HTTP 200: https://www.toolify.ai/submit — "Total:
    $ 99", "Pay $ 99", "No queue, listed within 48 hours".
  - Fulfillment Policy live, HTTP 200: https://www.toolify.ai/fulfillment-policy
    — "Last updated on August 30, 2024"; "you must register for a paid
    one-time payment program"; "Toolify may reject your application for an
    Account for any reason, in our sole discretion"; fee non-refundable
    ("non-refundable, even if you cancel or do not use any of the benefits");
    no robot/spider/automated-access prohibition (unchanged from the
    2026-08-11 record).
  - Kit reference pages all live HTTP 200: `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`;
    `/pricing/` and `/receipt-to-csv/` still 404 (unchanged; the kit claims
    none of those routes).
- Next action (unchanged): Nish signs in, pays $99, and submits using the kit
  above; the only route to an agent-executed submission would be Nish's dated
  approval of the $99 spend AND the venue research desk reviewing toolify.ai
  (its Fulfillment Policy has no robot/spider/automated-access prohibition)
  and adding it to the policy allowlist. After the listing, confirm the tool
  appears on https://www.toolify.ai/tag/Bank%20Statement%20to%20CSV and that
  search `q=aiconverter` returns the listing, then flip this venue's status
  line to live.

## Microlaunch

### Decision (dated 2026-08-11)

- **Decision: SUBMIT — regular (free) launch first, manual by Nish. The paid
  Pro Launch ($39) is recorded and deferred to Nish's spend call.**
- Reason: Microlaunch is a live launch platform (homepage 2026-08-11: "The
  Launch Platform for World-Class Startups", "August '26 — 138 products,
  2001 daily visitors") that already hosts two exact-category peers — both
  launched without premium (`is_premium: false`), proving regular (free)
  launches work on this venue:
  - Bank Statement Converter
    (https://microlaunch.net/p/bankstatementconverter, launched 2026-02-08,
    market analytics, Saas, "Free product", mvp-wip): "Instantly transform
    PDF bank statements into clean, structured Excel, CSV, or JSON data".
  - Bankformats (https://microlaunch.net/p/bankformats, launched 2026-06-14,
    market accounting, Saas, Subscription, growing): "Bank Statement
    Converter — Convert to Excel & CSV. PDF bank statements from 1000+
    banks. EU servers, GDPR-compliant, first 3 pages free."
  - No duplicate: the full launches API (5,660 products) contains no
    aiconverter / "AI Converter" codename or slug; /p/aiconverter,
    /p/ai-converter, /p/ai-converter-app, /p/aiconverter-app all return no
    product. The category is hosted; only this listing is missing.
- Free option first (verified live 2026-08-11): the "+ New Launch" nav
  button opens a "Pick your Launch" modal that surfaces the **Pro Launch**
  card — $39 one-time (struck $49; extra −20% with code LAUNCH20; "OSS
  Projects & Students, get 50% OFF Now"), 40 spots/month, "Skip the Queue —
  Launch Anytime", featured spots / 2x boosts, auto distribution to 4+ SEO
  pages, marketplace spot, verified reviews & badge — with CTA "Go Pro
  Now!" → /premium#stats. /submit redirects to /premium#pricing. A
  **Regular launch** (the free tier) exists per the premium-page FAQ ("What's
  the difference between Pro and Regular launch?") and is confirmed by both
  peers' non-premium launch records; the anonymous UI shows Pro only, so the
  free flow is inside the signed-in account.
- Paid options recorded (deferred): **Pro Launch $39 / one-time** (above)
  and the **Expert Feedback** pack at $129 (was $149; product review +
  custom action plan, 2 startup slots/week, premium support). Decision: the
  $39 Pro Launch is an optional commercial call by Nish, not required for
  the free listing.
- Constraint: sign-in required (the header modal offers "Signup with Google"
  and "Signup with 𝕏"). microlaunch.net is not in the venue policy allowlist
  (`automation_disposition: unknown`, not yet reviewed in
  `venue-policy.json` as of 2026-08-11), so `venue-claim claim` exits 4 —
  the agent must not drive a browser submission. ToS
  (https://microlaunch.net/terms, "Last updated on 04/03/2023") is a generic
  template with no robot/spider/crawl prohibition (unlike Product Hunt's ToS
  and Toolbit.ai's ToS §7) — still flag for the venue research desk; the
  guard stays exit-4 either way. Submission (create account, launch via the
  account-gated flow, optionally upgrade to Pro at checkout) is a human
  account action, same as the other venues.
- Next action: Nish signs in (Google or 𝕏) and submits a Regular launch
  using the kit below (the Pro Launch upgrade at checkout is his spend
  call), then this file should be updated with the public product URL
  (microlaunch.net/p/{slug}).

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline: **Bank statement PDFs to CSV you can review before paying**
- Description:

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Category suggestions: the exact-category peers sit in **Analytics & Data**
  (https://microlaunch.net/category/analytics — Bank Statement Converter)
  and **Accounting Tools**
  (https://microlaunch.net/category/accounting — Bankformats); pick the
  market the form's selector offers that fits best (AI Tools also exists at
  /category/ai).
- Product type: Saas (Web App) — matching both peers.
- Offer type: Freemium (free preview + paid per-page extraction, matching
  live checkout behavior); the peers use "Free product" and "Subscription".
- Website: https://aiconverter.app
- Canonical links for the listing (all verified live HTTP 200 on 2026-08-11):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/
- Post-listing check: confirm the product page at microlaunch.net/p/{slug}
  returns 200 and appears in Microlaunch search, then update this file with
  the public URL.

### Fleet lane attempt 2026-08-12 (Microlaunch — NOT EXECUTED)

- Attempted by lane 3 (packet: "List the product on Microlaunch via + New
  Launch"). The listing was **not submitted**: the decision above still binds.
  `agent-state/growth-loop/venue-policy.json` (updated 2026-08-08) has no
  microlaunch.net entry — `automation_disposition: unknown`, not in the
  allowlist — so `venue-claim claim` exits 4 and the agent must not drive the
  browser submission. Submission also requires a human account action (the
  "Signup" gate is Google/𝕏 OAuth only), which stays with Nish per the
  decision above. The `venue-claim` binary is not installed in the lane
  environment, but the policy JSON is the authoritative guard and is
  unchanged; this record is the honest NOT-EXECUTED lane outcome the packet
  requires.
- Live re-verification (all HTTP 200 unless noted, checked 2026-08-12):
  - Homepage: "The Launch Platform for World-Class Startups"; August '26 —
    139 products, 1767 daily visitors; nav still shows "+ New Launch" and
    "Signup".
  - Both exact-category peers still live at their recorded slugs: Bank
    Statement Converter (https://microlaunch.net/p/bankstatementconverter,
    Analytics & Data, Saas, "Free product") and Bankformats
    (https://microlaunch.net/p/bankformats, Accounting Tools, Saas,
    Subscription).
  - No duplicate: the full launches/products API
    (https://api.microlaunch.net/api/launches, `authorized_mode: false`, 222
    launches + 222 products in the current slice) has zero hits for
    aiconverter / "AI Converter" / ai-converter across every field including
    `codename` and `slug`; /p/aiconverter, /p/ai-converter,
    /p/ai-converter-app, /p/aiconverter-app all return no product (500).
  - /submit still redirects to /premium#pricing; the premium page still names
    the "Regular launch" tier (FAQ) and "Pro Launch — Limited to 40 spots per
    month" with the LAUNCH20 code.
  - Kit reference pages all live HTTP 200: `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`.
- Next action (unchanged): Nish signs in (Google or 𝕏) and submits the
  Regular launch using the kit above; the Pro Launch $39 upgrade stays his
  spend call. The only route to an agent-executed submission would be the
  venue research desk reviewing microlaunch.net (its ToS has no
  robot/spider/automated-access prohibition) and adding it to the policy
  allowlist. After the listing, confirm microlaunch.net/p/{slug} returns 200
  and appears in Microlaunch search, then flip this venue's status line to
  live.
## Uneed

### Decision (dated 2026-08-11)

- **Decision: SUBMIT — free waiting-line launch ("Join the line") first,
  manual by Nish (email-OTP account). The paid Skip the Waiting Line
  ($29.99) is recorded and deferred to Nish's spend call.**
- Reason: Uneed (uneed.best, "Uneed — Launch. Get seen. Grow.", 10,000+
  digital tools ranked by community votes) is a live, category-relevant
  launch directory that already hosts five exact-category peers — all under
  Business, all with non-premium listings in the public search API, so free
  launches are real on this venue: StatementSheet
  (https://www.uneed.best/tool/statementsheet, launched 2025-11-16), Bank
  PDF Converter (https://www.uneed.best/tool/bank-pdf-converter, launched
  2024-06-27), BankConv (https://www.uneed.best/tool/bankconv, launch records
  incl. 2026-08-08), PdfBuddy (https://www.uneed.best/tool/pdfbuddy, launch
  records incl. 2026-08-09), and BankScanPro
  (https://www.uneed.best/tool/bankscanpro, launch records incl.
  2026-05-22). Search (public API, live 2026-08-11) returns no aiconverter.app
  and no "AI Converter" product; /tool/ai-converter, /tool/aiconverter and
  /tool/ai-converter-app all 404. The category is hosted; only this listing
  is missing.
- Free option first (pricing page live 2026-08-11): **New product — "Join
  the line" — FREE** — "Get an automatic launch date at the next available
  slot." The public `GET /api/v1/launch-dates` endpoint quotes the honest
  current wait: **next free slot 2027-01-31** (173 days out, ~6 months — the
  launch guide itself says "often ~5 months out"). One product per free
  account in the waiting line (`waiting_line_limit_reached`, 429).
- Paid options recorded (deferred): **Skip the line $29.99 / one-time** —
  "Launch a new product and choose your launch date" (STWL dates bookable
  from 2026-08-13; do-follow backlink from the 75-DR domain, daily-ranking
  spot, award eligibility — per the launch guide). Also on the pricing page:
  **Fast-track $14.99** ("we assign you a slot ~14 days out") and **Relaunch
  $15**. Uneed Pro (early bird $99/year) bundles **1 free Skip the Line per
  year (worth $29.99)**. Decision: the $29.99 STWL (or Pro's bundled credit)
  is an optional commercial call by Nish — worth it if a ~6-month wait for
  the free slot is too long — not required for the free listing.
- Agent path (venue-official, noted for the desk): Uneed publishes
  https://www.uneed.best/launch.txt, an Agent Launch Guide with a full REST
  flow (email OTP → bearer → create product → schedule launch, tier
  `free`/`stwl`) plus a read-only MCP server (https://mcp.uneed.best/mcp).
  This is the first venue in this file that explicitly supports agent
  submission — but uneed.best is not yet reviewed in the fleet venue policy
  ledger (`automation_disposition: unknown`; `venue-policy.json` updated
  2026-08-08 lists only producthunt.com as reviewed, allowlist empty), so
  `venue-claim claim` still exits 4 and the agent must not execute the flow.
  The ToS (https://www.uneed.best/terms-of-use, last updated 2025-07-31)
  prohibits automated vote/ranking/comment manipulation, not product
  submission, and has no blanket robot/spider/crawl ban — flag for the venue
  research desk as positive evidence for a future `allowed` review.
- Constraint: the free flow is account-gated (submit page: "No account
  needed to start — we'll scrape your page first, then ask you to sign up to
  save it"; launch.txt: email OTP auth). Account creation and spend stay with
  Nish per fleet policy; the agent cannot receive the OTP or pay.
- Next action: Nish signs up (email OTP), submits the free "Join the line"
  launch using the kit below (or picks a Skip-the-Line date at $29.99), then
  this file should be updated with the public tool URL
  (uneed.best/tool/{slug}).


### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Website: https://aiconverter.app (real landing page — satisfies Uneed's
  "no vercel.app / netlify.app" rule from the launch guide)
- Short description (one line; optional — Uneed auto-classifies category,
  tags, pricing and the rich description from name + URL):

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser, with a free preview you can review before paying.

- Tier choice (the form / API asks explicitly; free queue quoted live
  2026-08-11): **Free — "Join the line"** → next available slot 2027-01-31
  (auto-assigned). Alternative: **Skip the line $29.99** → pick a date from
  the STWL list (bookable from 2026-08-13); Fast-track $14.99 assigns a slot
  ~14 days out instead.
- Category: Business (where all five exact-category peers sit).
- Pricing tag: Freemium (free preview + paid per-page extraction, matching
  live checkout behavior).
- Post-listing check: confirm https://www.uneed.best/tool/{slug} returns 200
  and appears in Uneed search (`q=aiconverter`), then update this file with
  the public URL.

### Fleet lane attempt 2026-08-12 (Uneed — NOT EXECUTED)

- Attempted by lane 1 (packet: "List the product on Uneed via free
  waiting-line submit (record paid skip-the-line decision)"). The listing was
  **not submitted**: the decision above still binds. Two independent gates
  block the agent:
  1. **Venue policy ledger blocks agent submission.**
     `agent-state/growth-loop/venue-policy.json` (updated 2026-08-08) has no
     uneed.best entry — `automation_disposition: unknown`, not in the
     allowlist — so per the `venue-claim` contract, `claim` exits 4 and "A
     blocked exit means NO browser work." Repo runbook `ops/launch-venues.md`
     (2026-08-11) states explicitly: "uneed.best is not yet reviewed in the
     fleet venue policy ledger ... so `venue-claim claim` still exits 4 and
     the agent must not execute the flow." The `venue-claim` binary is not
     installed in the lane environment (same as the Toolify lane-2 and
     Microlaunch lane-3 attempts today), but the policy JSON is the
     authoritative guard and it has not been updated.
  2. **Email-OTP account gate (human account action).** The free flow
     requires email-OTP sign-up (launch.txt: `POST /api/v1/auth/request-code`
     → user pastes the code → verify). launch.txt is explicit: "Never guess,
     prefill, or reuse an email from context — ask, wait, accept what they
     type." No fleet inbox exists in this environment (the only email tooling
     is send-only `notify-email`), so the agent cannot receive or paste the
     OTP; account creation stays with Nish per the 2026-08-11 decision
     ("Nish signs up (email OTP)").
- Paid skip-the-line decision recorded (the packet's "record paid
  skip-the-line decision"): **Skip the Waiting Line $29.99 remains DEFERRED to
  Nish's spend call.** No spend authorization exists in `agent-state`
  (authorizations/ holds only the sol-xhigh worker grant; the dispatch ledger
  has no Uneed entry). The free tier costs nothing — the blocker is the
  account gate, not money — but STWL dates are bookable and the launch guide
  text is unchanged.
- Live re-verification 2026-08-12 (all grounded in live HTTP fetches; Uneed
  is curl-friendly, unlike Toolify):
  - `GET /api/v1/launch-dates` (public): `free_next_available: 2027-02-03`
    (175 days out — the honest wait is now ~6 months, up from 173 days /
    2027-01-31 on 2026-08-11); STWL dates bookable from 2026-08-14 (soonest).
  - No duplicate (public search API, live): `q=aiconverter` → no
    aiconverter.app result (unrelated converters only: TailConverter, Heic
    Converter, SVG Converter, Convertology AI, ...). Slug probes
    /tool/ai-converter, /tool/aiconverter, /tool/ai-converter-app → all 404.
  - All five exact-category peers still live, HTTP 200: StatementSheet
    (/tool/statementsheet), Bank PDF Converter (/tool/bank-pdf-converter),
    BankConv (/tool/bankconv), PdfBuddy (/tool/pdfbuddy), BankScanPro
    (/tool/bankscanpro).
  - https://www.uneed.best/launch.txt live, unchanged: official Agent Launch
    Guide (email OTP → bearer → `POST /api/v1/products` →
    `POST /api/v1/launches`, tier `free`/`stwl`; free accounts keep ONE
    product in the waiting line at a time). Still positive evidence for the
    venue research desk to review uneed.best; the guard stays exit-4 until
    the policy ledger is updated.
  - ToS (https://www.uneed.best/terms-of-use, "Last Updated: July 31, 2025")
    unchanged: the prohibited-uses section targets automated engagement abuse
    ("scripts to send comments or messages", "bots, scripts, or automated
    tools to manipulate votes, rankings, or any other metrics"), not product
    submission; no blanket robot/spider/crawl prohibition.
  - Submit page live, HTTP 200: https://www.uneed.best/submit-a-tool — "No
    account needed to start — we'll scrape your page first, then ask you to
    sign up to save it" (unchanged).
  - Kit reference pages all live HTTP 200: `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`;
    `/pricing/` and `/receipt-to-csv/` still 404 (unchanged; the kit claims
    none of those routes).
- Next action (unchanged): Nish signs up (email OTP) and submits the free
  "Join the line" launch using the kit above (or picks a Skip-the-Line date
  at $29.99 on his spend call), then this file should be updated with the
  public tool URL (uneed.best/tool/{slug}). The only route to an
  agent-executed submission would be the venue research desk reviewing
  uneed.best (its launch.txt is the venue's own official agent flow and its
  ToS has no blanket crawl ban) and adding it to the policy allowlist.

## Open-Launch

### Decision (dated 2026-08-11)

- **Decision: PAID listing at $12 (Premium Launch) recommended for
  evaluation; declined for agent-executed submission. The $12 spend, the
  account creation, and the form submission are Nish's human actions — the
  kit below is ready, and this line becomes SUBMITTED (or DECLINED) once
  Nish decides on the spend.**
- Reason: Open-Launch (https://open-launch.com, "Discover the Best Tech
  Products", open source — "The first complete open source alternative to
  Product Hunt") is a live launch/upvote platform that already hosts 10+
  exact-category competitors — AI Bank Statement, bank-statementconverter.com,
  BankScanPro, Bank Statement Boss, AIBankStatement, Bank PDF Converter,
  StatementSheet, Bank Statement Converter AI, Bank Statement Engine, and
  more — while site search `q=aiconverter` and `q=ai converter` return zero
  results and the four aiconverter slug probes 404. The category is hosted;
  only this listing is missing.
- No free path right now: the pricing page (live 2026-08-11) shows **Free
  Launch $0 fully booked into 2027** ("Want free? We'll email you when it
  reopens — just start a launch.") and **Premium Launch $12 / launch** as
  "The only way to launch right now" — launch as early as tomorrow (up to 60
  days ahead per the FAQ), 10 premium slots daily, guaranteed dofollow
  backlink from a DR 71 domain, featured on homepage. At $12 with immediate
  availability, the listing is cheap enough to be worth testing; if Nish
  declines the spend, this paragraph is the dated decline record.
- Money boundary: $12 is a spend decision only Nish can make; the agent
  cannot pay or create the account. open-launch.com is not in the venue
  policy allowlist (`automation_disposition: unknown`, not yet reviewed in
  `venue-policy.json` as of 2026-08-11), so `venue-claim claim` exits 4 —
  no agent-driven browser submission. ToS (live 2026-08-11, "Last updated:
  August 11, 2026") has no robot/spider/automated-access prohibition (unlike
  Product Hunt's ToS and Toolbit.ai's ToS §7), but the guard stays exit-4
  either way (policy not yet reviewed) — flag for the venue research desk.
  Section 11: all payments final and non-refundable. Submission (create
  account via Google / GitHub / email, pay $12 at the Stripe-style checkout
  inside the flow, fill the form) is a human account action, same as the
  other venues.
- Next action: Nish signs in, pays $12, and submits a Premium Launch using
  the kit below, then this file should be updated with the public product
  URL (open-launch.com/projects/{slug}).

### Manual submission kit (copy-paste ready)

- Name: **AI Converter**
- Tagline: **Bank statement PDFs to CSV you can review before paying**
- Description (rich text, from the existing kits):

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Category: **finance-tech** (live category at
  /categories?category=finance-tech; exact-category peers sit there, e.g.
  Bank Statement Engine).
- Platform: Web (the form offers web / mobile / desktop / api / other).
- Pricing: Freemium (the form offers free / freemium / paid; matches live
  checkout behavior: free preview + paid per-page extraction).
- Launch type: **Premium Launch ($12)** — the only available launch right
  now (free slots booked into 2027); pick the earliest date the date picker
  offers (all launches at 8:00 AM UTC, premium can schedule up to 60 days
  ahead per the FAQ).
- Website: https://aiconverter.app
- Canonical links for the listing (all verified live HTTP 200 on 2026-08-11):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/
- Post-listing check: confirm the product page at
  https://open-launch.com/projects/aiconverter returns 200 and that site
  search `q=aiconverter` returns the project, then update this file with the
  public URL.
- Uneed section verified live on 2026-08-11: the homepage ("Launch. Get
  seen. Grow."), `/llms.txt` (10,000+ tools, MCP/API pointers), the pricing
  page (free "Join the line" + Skip the line $29.99 / Fast-track $14.99 /
  Relaunch $15 / Pro $99/yr with 1 free Skip), the submit page ("no account
  needed to start..."), the public `GET /api/v1/launch-dates` (free slot
  2027-01-31, STWL from 2026-08-13), the public search API duplicate check
  (q=aiconverter and q=AI Converter — no aiconverter.app), the three slug
  probes (/tool/ai-converter, /tool/aiconverter, /tool/ai-converter-app —
  all 404), all five exact-category peer tool pages (StatementSheet, Bank
  PDF Converter, BankConv, PdfBuddy, BankScanPro — all HTTP 200 with
  `premium: false` search records and launch dates as recorded),
  `/launch.txt` (official Agent Launch Guide + REST `/api/v1` flow,
  one-product waiting-line limit), the ToS page (2025-07-31; automated
  vote/comment manipulation prohibited, no blanket crawl ban), and the four
  canonical product links (all HTTP 200 on 2026-08-11; /pricing/ and
  /receipt-to-csv/ remain 404 and are not claimed in the kit).
- Open-Launch section verified live on 2026-08-11: the homepage (trending
  launch/upvote platform), the site search API duplicate checks
  (`q=aiconverter`, `q=ai converter` → zero results; `q=bank`,
  `q=statement`, `q=converter` → peers), the four absent-slug probes
  (/projects/aiconverter, /projects/ai-converter, /projects/aiconverter-app,
  /projects/ai-converter-app — all 404), six live peer project pages (AI
  Bank Statement, Bank Statement Boss, Bank PDF Converter, StatementSheet,
  Bank Statement Engine, Bank Statement Converter AI — all HTTP 200), the
  `finance-tech` category page, the pricing page (Premium Launch $12, Free
  Launch fully booked into 2027, SEO Growth Package $59, FAQ answers), the
  account-gated /projects/submit page (Google / GitHub / email), robots.txt
  (/api/, /projects/submit, /payment/ disallowed), the ToS page ("Last
  updated: August 11, 2026", no automation prohibition, §11 non-refundable),
  the open-source repo (github.com/openlaunch-org/Open-Launch: 10 premium
  slots daily, 8:00 AM UTC launch hour, payment link inside the signed-in
  flow), and the four canonical product links (all HTTP 200 on 2026-08-11;
  /pricing/ and /receipt-to-csv/ remain 404 and are not claimed in the kit).
- Per fleet policy, submissions stay manual-only (account actions are human).

## SaaSHub

### Decision (dated 2026-08-12)

- **Decision: SUBMIT — free listing at https://www.saashub.com/services/submit,
  manual by Nish. The paid promo (featured listing at $99/month, recurring)
  is recorded and deferred to Nish's spend call — not required for the free
  listing.**
- Reason: SaaSHub (https://www.saashub.com, "an independent software
  marketplace... helping software professionals since 2014", ~564,000 page
  views/month per the featured-products page) is a live, category-relevant
  alternatives directory that already hosts the exact category — site search
  `q=bank statement to csv` returns 1,000+ results including BankScanPro
  (https://www.saashub.com/bankscanpro-alternatives), Bank Statement
  Converter (https://www.saashub.com/bank-statement-converter-alternatives),
  AI Bank Statement (https://www.saashub.com/ai-bank-statement-alternatives,
  "Convert your bank statements to CSV and Excel format instantly with AI"),
  Bank-Statement-Conversion, Convert My Bank Statement, Bank Statement Sheet,
  and Import Bank Statement — so the venue hosts the category; only this
  product's listing is missing. Search `q=aiconverter` returns "Top 20
  products relevant to aiconverter" (366+ results) with no aiconverter.app
  anywhere in the results, and slug probes /aiconverter, /aiconverter-app,
  /ai-converter-app, and /aiconverter-alternatives all 404 — no duplicate.
  (Note: /ai-converter redirects to /ai-converter-alternatives, a DIFFERENT
  product — a generic offline file converter "AI converter", File Management
  / File Converter categories, marked "Not approved" — not a duplicate of
  aiconverter.app.)
- Free option (verified live 2026-08-12): the submit page
  (https://www.saashub.com/services/submit, form action `/services/new`,
  GET) takes a single **Website URL** field — "Continue" makes SaaSHub crawl
  the site and create the listing draft; "all submitted products go through
  an approval process". Acceptance rules (same page): SaaS/IaaS/PaaS, most
  software products and apps, mobile apps with decent websites, niche leaders
  are accepted; dev agencies, email-form landing pages, unreleased products
  (rejected immediately), free-subdomain sites, and non-English products are
  not. aiconverter.app qualifies (own domain, released, English). Submission
  advice on the page: list a few relevant categories (check competitors'
  categories); list competitors ("The submission will be slowed down and put
  to the bottom of the queue if there are not listed competitors"); verify
  the product for higher priority ("You will need an email address on the
  product's domain"). A second free surface exists: the Startup Directory
  (https://www.saashub.com/startups — "List your product to our Startup
  Directory").
- Paid option recorded (deferred): **Featured listing — $99 / Month ·
  cancel anytime** ("Feature My Product", https://www.saashub.com/featured-products)
  — "Shown on your competitors' pages and in your exact categories",
  estimated 10–18 targeted referrals/month, live in minutes, cancel in one
  click, no contract, Stripe checkout, "Join 111+ products already featured".
  The page itself argues the ROI ("One new customer pays for months of
  featuring"). Decision: this recurring $99/month spend is an optional
  commercial call by Nish, not required for the free listing; the free
  submission is the primary action.
- Money boundary and constraint: saashub.com is not in the fleet venue policy
  allowlist (`automation_disposition: unknown`; `venue-policy.json` updated
  2026-08-08 lists only producthunt.com as reviewed, allowlist empty), so
  `venue-claim claim` exits 4 — the agent must not drive the browser
  submission, including not triggering the `/services/new` crawl with
  aiconverter.app's URL (this lane documented the flow from the public
  submit page only and did NOT start a submission). The optional verification
  step needs an email address on the product's domain (aiconverter.app) —
  Nish needs a mailbox on the domain or must skip verification (lower
  priority, slower queue). ToS (https://www.saashub.com/site/terms, latest
  update 2023-10-13, copyright New Atlantis Pty Ltd) is a short generic
  template: SaaSHub "reserves the right to edit or remove software and
  listings at our own discretion", estimates are not guarantees, alternatives
  lists are CC BY-SA 4.0 — **no robot/spider/automated-access prohibition**
  (unlike Product Hunt's ToS and Toolbit.ai's ToS §7); robots.txt (live
  2026-08-12) only disallows /do-not-crawl/ for Amazonbot and everything for
  MJ12bot, nothing else — flag for the venue research desk. SaaSHub also
  publishes a public API (footer "API", https://www.saashub.com/site/api)
  — positive evidence for a future `automation_disposition` review, like
  Uneed's launch.txt; the guard stays exit-4 until the ledger is updated.
  Submission (run the URL form, pick categories, list competitors, optional
  domain verification) is a human account action, same as the other venues.
- Next action: Nish opens https://www.saashub.com/services/submit, enters
  https://aiconverter.app, completes the follow-up steps (categories,
  competitors, optional verification) using the kit below, then this file
  should be updated with the public product URL
  (saashub.com/{slug}-alternatives) once the listing is approved.

### Manual submission kit (copy-paste ready)

- Website URL (the only first-step field): **https://aiconverter.app**
- Name: **AI Converter**
- Category suggestions (competitor categories checked 2026-08-12 — the
  exact-category peers sit under File Management / File Converter and
  Finance; the site's Finance menu has Personal Finance, Banking, Budgeting,
  Financial Reporting): **Finance → Banking, File Management → File
  Converter, Productivity** (pick what the form's selector offers; SaaSHub
  categories are curated, so choose the closest live ones).
- Competitors to list (the peers returned by `q=bank statement to csv` —
  listing them avoids the "bottom of the queue" slowdown): BankScanPro
  (https://www.saashub.com/bankscanpro-alternatives), Bank Statement
  Converter (https://www.saashub.com/bank-statement-converter-alternatives),
  AI Bank Statement (https://www.saashub.com/ai-bank-statement-alternatives),
  Convert My Bank Statement
  (https://www.saashub.com/convert-my-bank-statement-alternatives), Bank
  Statement Sheet (https://www.saashub.com/bank-statement-sheet-alternatives).
- Description (the crawler will mostly extract from the site; keep this for
  the review/claim step):

  > AI Converter turns bank statement PDFs into spreadsheet-ready CSV in your
  > browser. Review sample rows free, then unlock the full extraction only when
  > the preview looks right. OCR fallback handles scanned statements; low
  > confidence fails closed with no charge. No bank logins and no human review
  > queue; source files are deleted after 24 hours.

- Pricing tag suggestion: Freemium (free preview + paid per-page extraction,
  matching live checkout behavior).
- Verification (optional, higher priority): SaaSHub asks for an email address
  on the product's domain — use a mailbox on aiconverter.app if Nish has one,
  or skip (submission stays valid, just lower priority).
- Canonical links for the listing (all verified live HTTP 200 on 2026-08-12):
  - https://aiconverter.app/bank-statement-pdf-to-csv/
  - https://aiconverter.app/sample-csv/
  - https://aiconverter.app/trust/
  - https://aiconverter.app/formats/
- Post-listing check: confirm the product page at saashub.com/{slug} (and
  its `-alternatives` page) returns 200 and that search `q=aiconverter`
  returns the listing, then update this file with the public URL.

### Fleet lane attempt 2026-08-12 (SaaSHub — NOT EXECUTED)

- Attempted by lane 1 (packet: "List the product on the SaaSHub alternatives
  directory (free submission; paid promo optional) and record a decision").
  The listing was **not submitted**: the decision above still binds.
  `agent-state/growth-loop/venue-policy.json` (updated 2026-08-08) has no
  saashub.com entry — `automation_disposition: unknown`, not in the
  allowlist — so `venue-claim claim` exits 4 and the agent must not drive the
  submission, including not triggering the `/services/new` crawl with
  aiconverter.app's URL. The `venue-claim` binary is not installed in the
  lane environment, but the policy JSON is the authoritative guard and is
  unchanged; this record is the honest NOT-EXECUTED lane outcome the packet
  requires. The optional $99/month featured promo is a recurring spend
  decision only Nish can make ("Money boundary" above).
- Live re-verification (2026-08-12, plain HTTP; no JS needed for these
  pages):
  - Homepage and submit page live, HTTP 200: https://www.saashub.com/ and
    https://www.saashub.com/services/submit — "Submit a Product", single
    Website URL field, form action `/services/new` (GET), acceptance rules
    and submission advice as recorded above.
  - No duplicate: `GET /list?q=aiconverter` (HTTP 200, "Top 20 products
    relevant to aiconverter", "Showing 20 of 366+ results") contains zero
    aiconverter.app hits (the string `aiconverter` on the page is only the
    query echo); slug probes /aiconverter, /aiconverter-app, /ai-converter-app,
    /aiconverter-alternatives all 404. The unrelated generic product "AI
    converter" (/ai-converter-alternatives, "Not approved", File
    Management/File Converter) is a different tool, not a duplicate.
  - Category hosted: `GET /list?q=bank+statement+to+csv` (HTTP 200,
    "Showing 20 of 1,000+ results") leads with the exact-category peers
    recorded above; peer pages /bankscanpro-alternatives,
    /bank-statement-converter-alternatives, /ai-bank-statement-alternatives,
    /convert-my-bank-statement-alternatives,
    /bank-statement-sheet-alternatives all HTTP 200.
  - Paid promo live: https://www.saashub.com/featured-products (HTTP 200) —
    "$99 / Month · cancel anytime", "Promote my product", "Shown on your
    competitors' pages and in your exact categories", estimated 10–18
    referrals/month, Stripe checkout, 111+ products featured, "cancel at any
    time" (recurring — monthly, unlike the one-time fees on Toolify/Toolbit).
  - Startup Directory live: https://www.saashub.com/startups (HTTP 200) —
    "List your product to our Startup Directory" (second free surface).
  - ToS live: https://www.saashub.com/site/terms (HTTP 200, latest update
    2023-10-13) — no robot/spider/automated-access prohibition; robots.txt
    (HTTP 200) disallows only /do-not-crawl/ (Amazonbot) and all of /
    (MJ12bot); public API documented at https://www.saashub.com/site/api.
  - Kit reference pages all live HTTP 200 (2026-08-12): `/`, `/llms.txt`,
    `/bank-statement-pdf-to-csv/`, `/sample-csv/`, `/trust/`, `/formats/`;
    `/pricing/` still 404 (unchanged; the kit claims none of those routes).
- Next action (unchanged): Nish opens https://www.saashub.com/services/submit
  and submits using the kit above (free; optional $99/month featured promo
  stays his spend call). The only route to an agent-executed submission would
  be the venue research desk reviewing saashub.com (its ToS has no
  robot/spider/automated-access prohibition and it publishes a public API —
  positive evidence) and adding it to the policy allowlist. After the
  listing, confirm the product page returns 200 and search `q=aiconverter`
  returns the listing, then flip this venue's status line to live.
