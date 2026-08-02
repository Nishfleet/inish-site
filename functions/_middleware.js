const markdown = `---
title: inish.in
description: The founder surface behind Tiny Studio. Products first, current bets early, context after that.
---

# inish.in

I keep building products that start calm and get more serious.

## Positioning

- Products first.
- The sharper one first.
- Current bets early.
- Context after that.
- Builder surface, not a personal-brand page.

## Current product emphasis

- 0509 / Five to Nine: proof-backed competitor monitoring and change alerts.
- Tiny Studio: the calmer operating product and company surface.
- Promptly and Drishti: app/product lanes under Tiny Studio.

## Applied AI operating principle

- All serious projects should move toward self-serve, agent-assisted workflows.
- Useful agents need workflow-specific context, safe tools, model routing, and clear human approval gates.
- Customer service, onboarding, fulfillment, reporting, growth, and proof surfaces should become easier to run without founder-led explanation.
- Approval stays explicit for money, private data, security, legal exposure, public claims, and deploys.

## Contact

Email: me@inish.in

## Nish Daily

The daily signal newspaper at /daily/ curates useful developments in AI, building, design, product, and business. Each item links to its original source.

## Product truth

inish.in should stay a clear founder/product surface. It should not make product, security, compliance, traction, or capability claims beyond what the linked products can prove.
`;

function wantsMarkdown(request) {
  const accept = request.headers.get("Accept") || "";
  return accept.toLowerCase().includes("text/markdown");
}

function isFounderPage(url) {
  return url.pathname === "/" || url.pathname === "/index.html";
}

function robotsText(origin) {
  return [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Sitemap: ${origin}/daily/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapXml(origin) {
  const paths = ["/", "/daily/", "/daily/archive/", "/daily/feed.xml", "/llms.txt"];
  const urls = paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
    return new Response(request.method === "HEAD" ? null : robotsText(url.origin), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
    return new Response(request.method === "HEAD" ? null : sitemapXml(url.origin), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8"
      }
    });
  }

  if ((request.method === "GET" || request.method === "HEAD") && wantsMarkdown(request) && isFounderPage(url)) {
    return new Response(request.method === "HEAD" ? null : markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Vary": "Accept",
        "Content-Signal": "search=yes, ai-input=yes"
      }
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.append("Vary", "Accept");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
