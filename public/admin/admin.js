const form = document.getElementById("admin-form");
const tokenInput = document.getElementById("admin-token");
const output = document.getElementById("admin-output");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.innerHTML = '<div class="admin-empty">Loading live status...</div>';

  try {
    const response = await fetch("/api/admin/overview", {
      headers: {
        Authorization: `Bearer ${tokenInput.value.trim()}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Admin overview failed.");
    output.innerHTML = renderOverview(payload);
  } catch (error) {
    output.innerHTML = `<div class="admin-error">${escapeHtml(error?.message || "Admin overview failed.")}</div>`;
  }
});

function renderOverview(payload) {
  const health = payload.health || {};
  return [
    renderAlerts(payload.alerts || []),
    renderOperationalQueues(payload.operationalQueues || {}),
    renderHealth(health, payload.generatedAt),
    renderCloudConvert(payload.cloudConvert || {}),
    renderUsage(payload.usage24h || {}),
    renderFunnel(payload.previewFunnel || []),
    renderStatusCounts(payload.jobStatus || []),
    renderTable("Preview funnel by output", payload.previewFunnelByRoute || [], ["converter_id", "output_format", "event_type", "count"]),
    renderTable("Preview funnel issues", payload.previewFunnelIssues || [], ["event_type", "converter_id", "output_format", "input_kind", "file_size_bucket", "page_bucket", "turnstile_state", "error_code", "route_path", "created_at"]),
    renderTable("Watchlist", payload.watchlist || [], ["id", "status", "converter_id", "plan_id", "row_count", "confidence", "refund_status", "error", "updated_at"]),
    renderTable("Provider failures", payload.providerFailures || [], ["id", "status", "converter_id", "plan_id", "external_provider", "external_status", "error", "updated_at"]),
    renderTable("Stuck provider jobs", payload.stuckProvider || [], ["id", "status", "converter_id", "plan_id", "external_provider", "external_status", "updated_at"]),
    renderTable("Open support", payload.support || [], ["id", "job_id", "email", "category", "status", "message_excerpt", "created_at"]),
    renderTable("Dodo payments", payload.payments || [], ["event_type", "job_id", "payment_id", "plan_id", "status", "amount", "currency", "match_status", "created_at"]),
    renderTable("Dodo checkout handoffs", payload.checkoutHandoffs || [], ["id", "status", "converter_id", "plan_id", "checkout_session_id", "payment_id", "email", "updated_at"]),
    renderTable("Unmatched Dodo payments", payload.unmatchedPayments || [], ["event_type", "job_id", "payment_id", "checkout_session_id", "plan_id", "status", "amount", "match_status", "created_at"]),
    renderTable("Refunds", payload.refunds || [], ["job_id", "payment_id", "refund_id", "status", "reason", "error", "created_at"]),
    renderTable("Refund or credit due", payload.refundDue || [], ["id", "payment_id", "refund_status", "refund_id", "error", "refund_error", "updated_at"]),
    renderTable("Webhook failures", payload.webhookFailures || [], ["webhook_id", "event_type", "status", "received_count", "error", "updated_at"]),
    renderTable("Webhooks", payload.webhooks || [], ["webhook_id", "event_type", "status", "received_count", "error", "updated_at"])
  ].join("");
}

function renderAlerts(alerts) {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Alerts</h2>
          <p>Health, spend, provider, and payment checks</p>
        </div>
      </div>
      <div class="admin-alert-list">
        ${
          alerts.length
            ? alerts.map((alert) => `
                <article class="admin-alert ${severityClass(alert.severity)}">
                  <strong>${escapeHtml(alert.title || "Alert")}</strong>
                  <span>${escapeHtml(alert.detail || "")}</span>
                </article>
              `).join("")
            : '<div class="admin-empty">No alerts returned.</div>'
        }
      </div>
    </section>
  `;
}

function renderOperationalQueues(queues) {
  const rows = [
    ["Failed jobs", queues.failedJobs || 0],
    ["Stuck provider", queues.stuckProvider || 0],
    ["Payment handoffs", queues.paymentHandoffs || 0],
    ["Stale handoffs", queues.stalePaymentHandoffs || 0],
    ["Unmatched payments", queues.unmatchedPayments || 0],
    ["Refund/credit due", queues.refundDue || 0],
    ["Open support", queues.openSupport || 0],
    ["Webhook failures", queues.webhookFailures || 0],
    ["Preview errors", queues.previewErrors || 0],
    ["Human-check failures", queues.turnstileFailures || 0]
  ];
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Action queues</h2>
          <p>Fast scan for the work that can block customers or money</p>
        </div>
      </div>
      <div class="admin-metric-grid">
        ${rows.map(([label, value]) => metricCard(label, value)).join("")}
      </div>
    </section>
  `;
}

function renderHealth(health, generatedAt) {
  const missing = health.missing || [];
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Runtime health</h2>
          <p>Generated ${escapeHtml(generatedAt || "")}</p>
        </div>
        <span class="admin-badge ${missing.length ? "is-attention" : "is-ready"}">
          ${missing.length ? "Needs attention" : "Ready"}
        </span>
      </div>
      <div class="admin-health-grid">
        ${healthCard("Storage", health.storageConfigured ? "Configured" : "Missing")}
        ${healthCard("Payments", `${health.payments?.provider || "dodo"} · ${health.payments?.mode || "live"}`)}
        ${healthCard("Mistral", health.extraction?.mistral ? "Configured" : "Missing")}
        ${healthCard("Turnstile", health.protection?.turnstile ? "Configured" : "Not active")}
      </div>
      ${
        missing.length
          ? `<div class="admin-missing"><strong>Missing:</strong> ${missing.map(escapeHtml).join(", ")}</div>`
          : ""
      }
    </section>
  `;
}

function healthCard(label, value) {
  return `
    <div class="admin-health-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCloudConvert(provider) {
  const usage = provider.usageToday || {};
  const account = provider.account || {};
  const backup = provider.backup || {};
  const accountLabel = account.ok ? "Connected" : provider.configured ? "Check failed" : "Missing";
  const credits = account.ok && account.credits !== null && account.credits !== undefined ? account.credits : "Unknown";
  const remaining = usage.remaining === null || usage.remaining === undefined ? "Unlimited" : usage.remaining;

  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>CloudConvert guardrails</h2>
          <p>Daily cap, credit reserve, and account status</p>
        </div>
        <span class="admin-badge ${account.ok && provider.configured ? "is-ready" : "is-attention"}">${escapeHtml(accountLabel)}</span>
      </div>
      <div class="admin-metric-grid">
        ${metricCard("Credits", credits)}
        ${metricCard("Minimum reserve", provider.minCredits ?? "-")}
        ${metricCard("Started today", `${usage.started || 0}/${provider.dailyLimit || "off"}`)}
        ${metricCard("Remaining today", remaining)}
        ${metricCard("Completed today", usage.complete || 0)}
        ${metricCard("Failed today", usage.failed || 0)}
        ${metricCard("Still converting", usage.converting || 0)}
        ${metricCard("Credit guard", provider.requireCreditCheck ? "Required" : "Advisory")}
        ${metricCard("Backup provider", backup.configured ? "Convertio on" : "Convertio off")}
        ${metricCard("Backup daily cap", backup.dailyLimit ?? "-")}
      </div>
      ${
        account.message
          ? `<div class="admin-missing"><strong>Provider note:</strong> ${escapeHtml(account.message)}</div>`
          : ""
      }
    </section>
  `;
}

function renderUsage(usage) {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Usage dashboard</h2>
          <p>Last 24 hours</p>
        </div>
      </div>
      <div class="admin-metric-grid">
        ${metricCard("All jobs", usage.total || 0)}
        ${metricCard("Preview ready", usage.preview_ready || 0)}
        ${metricCard("Complete", usage.complete || 0)}
        ${metricCard("Failed", usage.failed || 0)}
        ${metricCard("Converting", usage.converting || 0)}
        ${metricCard("Provider jobs", usage.provider_total || 0)}
        ${metricCard("Provider complete", usage.provider_complete || 0)}
        ${metricCard("Provider failed", usage.provider_failed || 0)}
        ${metricCard("CloudConvert jobs", usage.cloudconvert_total || 0)}
        ${metricCard("Convertio jobs", usage.convertio_total || 0)}
      </div>
    </section>
  `;
}

function renderFunnel(rows) {
  const counts = Object.fromEntries((rows || []).map((row) => [row.event_type, row.count]));
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Preview funnel</h2>
          <p>Last 24 hours, privacy-safe events only</p>
        </div>
      </div>
      <div class="admin-metric-grid">
        ${metricCard("Files selected", counts.file_selected || 0)}
        ${metricCard("Outputs selected", counts.output_selected || 0)}
        ${metricCard("Human check loaded", counts.turnstile_loaded || 0)}
        ${metricCard("Human check passed", counts.turnstile_pass || 0)}
        ${metricCard("Human check failed", counts.turnstile_fail || 0)}
        ${metricCard("Preview clicks", counts.preview_click || 0)}
        ${metricCard("Preview ready", counts.preview_success || 0)}
        ${metricCard("Preview errors", counts.preview_error || 0)}
      </div>
    </section>
  `;
}

function metricCard(label, value) {
  return `
    <div class="admin-metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderStatusCounts(rows) {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>Jobs</h2>
          <p>Current status counts</p>
        </div>
      </div>
      <div class="admin-counts">
        ${
          rows.length
            ? rows.map((row) => `<div><strong>${escapeHtml(row.count)}</strong><span>${escapeHtml(row.status)}</span></div>`).join("")
            : '<div><strong>0</strong><span>No jobs yet</span></div>'
        }
      </div>
    </section>
  `;
}

function renderTable(title, rows, columns) {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${rows.length} record${rows.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      ${
        rows.length
          ? `<div class="admin-table-wrap"><table class="admin-table">
              <thead><tr>${columns.map((column) => `<th>${escapeHtml(labelFor(column))}</th>`).join("")}</tr></thead>
              <tbody>
                ${rows
                  .map(
                    (row) =>
                      `<tr>${columns.map((column) => `<td>${formatCell(row[column], column)}</td>`).join("")}</tr>`
                  )
                  .join("")}
              </tbody>
            </table></div>`
          : '<div class="admin-empty">Nothing to show.</div>'
      }
    </section>
  `;
}

function formatCell(value, column) {
  if (value === null || value === undefined || value === "") return '<span class="admin-muted">-</span>';
  if (column === "confidence") return `${Math.round(Number(value || 0) * 100)}%`;
  if (column === "amount") return Number(value || 0) ? `$${(Number(value) / 100).toFixed(2)}` : "-";
  return escapeHtml(String(value));
}

function severityClass(severity) {
  if (severity === "critical") return "is-critical";
  if (severity === "warning") return "is-warning";
  return "is-ready";
}

function labelFor(value) {
  return String(value).replaceAll("_", " ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
