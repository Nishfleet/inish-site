const baseUrl = process.env.AICONVERTER_STRESS_URL || "https://aiconverter.app";
const rounds = Number(process.env.STRESS_ROUNDS || 12);
const paths = [
  "/",
  "/formats",
  "/api/config",
  "/api/health",
  "/llms.txt",
  "/about",
  "/security",
  "/privacy",
  "/data-retention"
];

const timings = [];
const failures = [];
const started = Date.now();

for (let round = 0; round < rounds; round += 1) {
  for (const path of paths) {
    const url = new URL(path, baseUrl).toString();
    const requestStarted = Date.now();
    try {
      const response = await fetch(url, {
        headers: path === "/" ? { Accept: "text/html" } : {}
      });
      const body = await response.text();
      const elapsed = Date.now() - requestStarted;
      timings.push(elapsed);
      if (!response.ok) failures.push({ url, status: response.status, elapsed });
      if (path === "/" && !body.includes("AI Converter")) failures.push({ url, status: "missing-brand", elapsed });
      if (path === "/formats") {
        if (!body.includes("AI Converter")) failures.push({ url, status: "missing-formats-shell", elapsed });
        // First-paint structure, kept in step with tests/seo-static-regression.test.mjs:
        // the deployed page must inline critical styles and must not keep a
        // render-blocking stylesheet in the head. Catches stale deploys where
        // the page would render blank until /legal.css arrives.
        const head = body.slice(0, body.indexOf("</head>"));
        if (!/<style>[\s\S]*?<\/style>/.test(body) || /rel="stylesheet"/.test(head)) {
          failures.push({ url, status: "formats-blank-first-paint", elapsed });
        }
      }
      if (path === "/api/health") {
        const health = JSON.parse(body);
        if (!health.ok) failures.push({ url, status: "health-not-ready", missing: health.missing || [], elapsed });
      }
      if (path === "/llms.txt" && !body.includes("Audio transcript")) failures.push({ url, status: "stale-llms", elapsed });
    } catch (error) {
      failures.push({ url, status: error?.message || "fetch failed" });
    }
  }
}

const negativeChecks = [
  fetch(new URL("/api/convert", baseUrl), { method: "POST" }).then(async (response) => ({
    name: "empty convert",
    status: response.status,
    ok: response.status === 400 || response.status === 403 || response.status === 429,
    body: await response.text()
  })),
  fetch(new URL("/api/download", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  }).then(async (response) => ({
    name: "empty download",
    status: response.status,
    ok: response.status === 400,
    body: await response.text()
  }))
];

const negative = await Promise.all(negativeChecks);
negative.forEach((check) => {
  if (!check.ok) failures.push(check);
});

const sorted = timings.slice().sort((a, b) => a - b);
const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0;
const max = sorted[sorted.length - 1] || 0;

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      baseUrl,
      requests: timings.length,
      negative,
      p95_ms: p95,
      max_ms: max,
      elapsed_ms: Date.now() - started,
      failures
    },
    null,
    2
  )
);

if (failures.length) process.exitCode = 1;
