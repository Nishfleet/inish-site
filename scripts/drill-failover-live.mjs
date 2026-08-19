import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadLocalMonitorEnv();

const baseUrl = process.env.AICONVERTER_MONITOR_URL || process.env.AICONVERTER_STRESS_URL || "https://aiconverter.app";
const adminToken =
  process.env.AICONVERTER_MONITOR_ADMIN_TOKEN || process.env.AICONVERTER_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
const failures = [];
const started = Date.now();
let printed = false;

if (!adminToken) {
  failures.push({ check: "admin-token", message: "Set AICONVERTER_ADMIN_TOKEN or add it to .monitor.env." });
} else {
  const response = await fetch(new URL("/api/admin/failover-drill", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ waitSeconds: Number(process.env.AICONVERTER_FAILOVER_WAIT_SECONDS || 20) })
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok || body.ok !== true) {
    failures.push({ check: "failover-drill", status: response.status, body });
  } else if (body.provider !== "convertio") {
    failures.push({ check: "failover-provider", provider: body.provider || "", body });
  } else if (!["converting_full", "complete"].includes(body.status)) {
    failures.push({ check: "failover-status", status: body.status || "", body });
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        baseUrl,
        elapsedMs: Date.now() - started,
        drill: redact(body),
        failures
      },
      null,
      2
    )
  );
  printed = true;
}

if (failures.length && !printed) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        baseUrl,
        elapsedMs: Date.now() - started,
        failures
      },
      null,
      2
    )
  );
}

if (failures.length) process.exit(1);

function loadLocalMonitorEnv() {
  const envPath = resolve(process.cwd(), ".monitor.env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name]) continue;
    process.env[name] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

function redact(value) {
  if (!value || typeof value !== "object") return value;
  const clone = structuredClone(value);
  delete clone.token;
  return clone;
}
