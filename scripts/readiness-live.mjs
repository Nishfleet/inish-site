const baseUrl = process.env.AICONVERTER_STRESS_URL || "https://aiconverter.app";
const failures = [];

await checkHealth();
await checkHeaders();
await checkMarkdown();
await checkAdminAuth();

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      baseUrl,
      failures
    },
    null,
    2
  )
);

if (failures.length) process.exit(1);

async function checkHealth() {
  const response = await fetch(new URL("/api/health", baseUrl));
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true || body.status !== "ready" || !Array.isArray(body.missing) || body.missing.length) {
    failures.push({ check: "health", status: response.status, body });
  }
}

async function checkHeaders() {
  const response = await fetch(new URL("/", baseUrl), { method: "HEAD" });
  const required = {
    "content-security-policy": "default-src 'self'",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  };
  for (const [header, expected] of Object.entries(required)) {
    const actual = response.headers.get(header) || "";
    if (!actual.includes(expected)) failures.push({ check: "headers", header, actual });
  }
}

async function checkMarkdown() {
  const response = await fetch(new URL("/", baseUrl), {
    headers: { Accept: "text/markdown" }
  });
  const text = await response.text();
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/markdown")) {
    failures.push({ check: "markdown", status: response.status, contentType: response.headers.get("content-type") });
  }
  for (const phrase of ["Audio transcript", "Document Markdown", "does not claim"]) {
    if (!text.includes(phrase)) failures.push({ check: "markdown", missing: phrase });
  }
}

async function checkAdminAuth() {
  const response = await fetch(new URL("/api/admin/overview", baseUrl));
  if (response.status !== 401) failures.push({ check: "admin-auth", status: response.status });
}
