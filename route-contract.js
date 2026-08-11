// Single source of truth for the edge route contract of inish.in.
//
// Both live edge implementations import this file and define no literals of
// their own:
//   - worker.js (Workers + assets, the production path) imports "./route-contract.js"
//   - functions/_middleware.js (the Pages mirror) imports "../route-contract.js"
//
// Tests extract the allowlist, font pattern, redirects, and HSTS value from
// this one file, and cross-check the deploy payload and the live verifier
// against it, so a path addition is a single edit here plus the asset file —
// never a hunt through mirrored literals.
//
// The file is not shipped as a static asset: deploy_daily.sh copies it beside
// worker.js in the deploy root (the Workers assets payload is ./public only),
// so it can never be fetched from the live hostname.
export const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/apple-touch-icon.png", // iOS home-screen icon, referenced by the generated head
  "/og-image.svg", // social share card, referenced by the generated head
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml"
]);

// Self-hosted webfonts. Kept as a narrow pattern rather than an exact list so a
// future face does not need a contract edit, and tight enough that it cannot
// serve anything but a woff2 from this one directory.
export const fontPath = /^\/fonts\/[a-z0-9-]+\.woff2$/;

export const redirects = new Map([
  ["/index.html", "/"],
  ["/daily", "/"],
  ["/daily/", "/"],
  ["/daily/index.html", "/"],
  ["/daily/app.js", "/app.js"],
  ["/daily/styles.css", "/styles.css"],
  ["/daily/latest.json", "/latest.json"],
  ["/daily/feed.xml", "/feed.xml"],
  ["/daily/sitemap.xml", "/sitemap.xml"]
]);

// The site is HTTPS-only, so every response from the middleware can carry HSTS.
// No subdomains exist yet; includeSubDomains keeps any future one under the
// same policy. Preload is deliberately not claimed: it is a permanent public
// commitment and nothing in the repository justifies it.
export const hstsHeader = "max-age=31536000; includeSubDomains";
