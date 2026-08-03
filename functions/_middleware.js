const publicPaths = new Set([
  "/",
  "/app.js",
  "/styles.css",
  "/latest.json",
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml"
]);

const redirects = new Map([
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

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = redirects.get(url.pathname);
  if (target) {
    const destination = new URL(target, url.origin);
    destination.search = url.search;
    return Response.redirect(destination, 301);
  }
  if (!publicPaths.has(url.pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }
  return context.next();
}
