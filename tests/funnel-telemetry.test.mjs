import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeFunnelEvent, recordFunnelEvent } from "../functions/lib/funnel-telemetry.js";
import { onRequestPost as funnelEvent } from "../functions/api/funnel-event.js";

test("funnel beacon uses sendBeacon so rendered page loads reach network idle", () => {
  const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const beacon = source.slice(source.indexOf("function trackFunnelEvent"), source.indexOf("async function readJsonSafe"));
  assert.match(beacon, /navigator\.sendBeacon\("\/api\/funnel-event", new Blob\(\[payload\], \{ type: "application\/json" \}\)/);
  assert.doesNotMatch(beacon, /keepalive/, "the funnel beacon must not use a keepalive fetch() POST, which Chromium never reports as finished on the Cloudflare edge and blocks network idle");
  assert.match(beacon, /payload\.length < 1200/, "oversized or unsupported payloads still fall back to a plain fetch() POST");
});

test("funnel telemetry accepts only safe event fields", () => {
  const sanitized = sanitizeFunnelEvent({
    eventType: "preview_error",
    sessionId: "session_123",
    jobId: "job_123",
    converterId: "bank",
    outputFormat: "quickbooks-csv",
    inputKind: "pdf",
    fileSizeBucket: "1_5mb",
    pageBucket: "6_25",
    fileCount: 3,
    turnstileState: "error",
    errorCode: "http_403",
    routePath: "/",
    fileName: "private-bank-statement.pdf",
    content: "private row data"
  });

  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.event.eventType, "preview_error");
  assert.equal(sanitized.event.converterId, "bank");
  assert.equal(sanitized.event.fileName, undefined);
  assert.equal(sanitized.event.content, undefined);
});

test("funnel telemetry rejects unknown events", () => {
  const sanitized = sanitizeFunnelEvent({ eventType: "filename_uploaded" });
  assert.equal(sanitized.ok, false);
});

test("funnel telemetry preserves UI crash error code without storing private data", () => {
  const sanitized = sanitizeFunnelEvent({
    eventType: "preview_error",
    errorCode: "ui_crash",
    routePath: "/convert",
    content: "private statement text"
  });

  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.event.errorCode, "ui_crash");
  assert.equal(sanitized.event.content, undefined);
});

test("funnel telemetry accepts revenue funnel milestones", () => {
  for (const eventType of ["page_view", "free_sample_download", "checkout_click", "checkout_redirect", "finalize_success", "download_success"]) {
    const sanitized = sanitizeFunnelEvent({ eventType, sessionId: "session_123", jobId: "job_123" });
    assert.equal(sanitized.ok, true);
    assert.equal(sanitized.event.eventType, eventType);
  }
});

test("funnel event API writes a sanitized event to D1", async () => {
  const writes = [];
  const response = await funnelEvent({
    env: fakeEnv(writes),
    request: new Request("https://aiconverter.app/api/funnel-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "Funnel test"
      },
      body: JSON.stringify({
        eventType: "file_selected",
        sessionId: "session_abc",
        converterId: "bank",
        outputFormat: "quickbooks-csv",
        inputKind: "pdf",
        fileSizeBucket: "under_1mb",
        fileName: "do-not-store.pdf"
      })
    })
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  const insert = writes.find((item) => item.sql.includes("INSERT INTO preview_funnel_events"));
  assert.ok(insert, "insert should be recorded");
  assert.equal(insert.values[1], "session_abc");
  assert.equal(insert.values[3], "file_selected");
  assert.equal(insert.values[4], "bank");
  assert.equal(insert.values.includes("do-not-store.pdf"), false);
});

test("recordFunnelEvent degrades without throwing when the table is missing", async () => {
  const result = await recordFunnelEvent(
    {
      RATE_LIMIT_SALT: "a-long-private-test-salt-value",
      AICONVERTER_DB: {
        prepare() {
          return {
            bind() {
              return {
                async run() {
                  throw new Error("no such table: preview_funnel_events");
                }
              };
            }
          };
        }
      }
    },
    new Request("https://aiconverter.app/api/funnel-event"),
    { eventType: "preview_click" }
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /preview_funnel_events/);
});

function fakeEnv(writes) {
  return {
    RATE_LIMIT_SALT: "a-long-private-test-salt-value",
    AICONVERTER_DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async run() {
                writes.push({ sql, values });
                return { success: true };
              }
            };
          }
        };
      }
    }
  };
}
