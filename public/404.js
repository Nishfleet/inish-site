(function () {
  const routeSource = Array.from(document.querySelectorAll("[data-primary-route]"));
  const routes = routeSource.map((link) => ({
    id: link.dataset.routeId,
    label: link.textContent.trim(),
    href: link.getAttribute("href"),
    intent: String(link.dataset.intent || "").split(/\s+/).filter(Boolean),
    reason: link.dataset.reason || "",
    keywords: link.dataset.keywords || ""
  }));

  const byId = new Map(routes.map((route) => [route.id, route]));
  const attemptedUrl = document.getElementById("attempted-url");
  const heroMatchLink = document.getElementById("hero-match-link");
  const matchLink = document.getElementById("match-link");
  const matchLabel = document.getElementById("match-label");
  const matchPath = document.getElementById("match-path");
  const reportLink = document.getElementById("report-link");
  const searchInput = document.getElementById("route-search-input");
  const routeResults = document.getElementById("route-results");
  const escapeRoutes = document.getElementById("escape-routes");
  const slider = document.getElementById("rescue-slider");
  const rescueScore = document.getElementById("rescue-score");
  const rowStatus = document.getElementById("row-status");
  const cellInput = document.getElementById("cell-input");
  const cellValidation = document.getElementById("cell-validation");
  const cellMapped = document.getElementById("cell-mapped");
  const cellOutput = document.getElementById("cell-output");
  const rescueNote = document.getElementById("rescue-note");
  const stageButtons = Array.from(document.querySelectorAll("[data-stage-button]"));
  const intentButtons = Array.from(document.querySelectorAll("[data-intent-button]"));
  const cells = Array.from(document.querySelectorAll(".cell"));

  const currentUrl = new URL(window.location.href);
  const attempted = decodeAttempt(currentUrl.pathname + currentUrl.search + currentUrl.hash);
  const allIntentIds = {
    statement: [
      "bank-statement-pdf-to-csv",
      "scanned-bank-statement-to-excel",
      "credit-card-statement-pdf-to-csv",
      "formats"
    ],
    accounting: [
      "pdf-bank-statement-to-quickbooks-csv",
      "pdf-bank-statement-to-xero-csv",
      "pdf-bank-statement-to-wave-csv",
      "bank-statement-pdf-to-csv",
      "formats"
    ],
    policy: ["security", "privacy", "data-retention", "refund", "formats"]
  };

  let selectedIntent = inferIntent(attempted);
  let currentStage = Number(slider.value || 0);

  if (attemptedUrl) attemptedUrl.textContent = attempted || "/";
  setIntent(selectedIntent);
  renderEscapeRoutes();
  renderSearch("");
  updateRecovery();

  slider.addEventListener("input", () => {
    currentStage = Number(slider.value || 0);
    updateRecovery();
  });

  stageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentStage = Number(button.dataset.stageButton || 0);
      slider.value = String(currentStage);
      updateRecovery();
    });
  });

  intentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setIntent(button.dataset.intentButton || "statement");
      renderSearch(searchInput.value);
      renderEscapeRoutes();
      updateRecovery();
    });
  });

  searchInput.addEventListener("input", () => renderSearch(searchInput.value));

  function decodeAttempt(value) {
    try {
      return decodeURIComponent(value || "/");
    } catch {
      return value || "/";
    }
  }

  function inferIntent(value) {
    const normalized = normalize(value);
    if (/\b(quickbook|quickbooks|xero|wave|accounting|import)\b/.test(normalized)) return "accounting";
    if (/\b(privacy|security|retention|refund|policy|delete|data)\b/.test(normalized)) return "policy";
    return "statement";
  }

  function setIntent(intent) {
    selectedIntent = allIntentIds[intent] ? intent : "statement";
    intentButtons.forEach((button) => {
      const active = button.dataset.intentButton === selectedIntent;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function updateRecovery() {
    const match = bestRoute(attempted, selectedIntent);
    const stage = stages(match)[currentStage];
    updateMatch(match);
    updateCells(stage, match);
    updateStageButtons(stage);
    updateReportLink(match);
  }

  function stages(match) {
    const shortAttempt = attempted && attempted !== "/" ? attempted : "/missing-page";
    return [
      {
        name: "Parse",
        score: "0% mapped",
        status: "Missing route",
        input: shortAttempt,
        validation: "Path found, page missing",
        mapped: "Waiting for route match",
        output: "No dead-end export",
        note: "Drag the row through the workflow. The lost path gets parsed, checked against real pages, then mapped to a live route."
      },
      {
        name: "Validate",
        score: "33% mapped",
        status: "Checking live pages",
        input: cleanPath(shortAttempt),
        validation: "Compared with verified routes only",
        mapped: "Closest match is being scored",
        output: "Preview still blocked",
        note: "This page only suggests routes that actually exist on AI Converter. A confident link to another dead page would be worse than no link."
      },
      {
        name: "Map",
        score: "66% mapped",
        status: "Closest route found",
        input: cleanPath(shortAttempt),
        validation: "Live route available",
        mapped: match.label,
        output: match.href,
        note: "Good news: the row was lost, not the route. The closest live page is ready below."
      },
      {
        name: "Export",
        score: "100% mapped",
        status: "Recovery ready",
        input: cleanPath(shortAttempt),
        validation: "Safe to leave the 404",
        mapped: match.label,
        output: "Open " + match.label,
        note: "Recovered. Open the suggested page, search another route, or report the broken link so this path can be cleaned up."
      }
    ];
  }

  function updateMatch(match) {
    if (!match) return;
    matchLink.href = match.href;
    matchLabel.textContent = match.label;
    matchPath.textContent = match.href;
    heroMatchLink.href = match.href;
    heroMatchLink.textContent = "Open " + match.label;
  }

  function updateCells(stage) {
    rescueScore.textContent = stage.score;
    rowStatus.textContent = stage.status;
    cellInput.textContent = stage.input;
    cellValidation.textContent = stage.validation;
    cellMapped.textContent = stage.mapped;
    cellOutput.textContent = stage.output;
    rescueNote.textContent = stage.note;
    slider.setAttribute("aria-valuetext", stage.name + " stage");
    cells.forEach((cell, index) => {
      cell.classList.toggle("is-hot", index === currentStage);
    });
  }

  function updateStageButtons(stage) {
    stageButtons.forEach((button) => {
      const active = Number(button.dataset.stageButton || 0) === currentStage;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.documentElement.style.setProperty("--rescue-stage", String(currentStage));
    if (stage && stage.name) {
      slider.setAttribute("aria-label", "Recovery stage: " + stage.name);
    }
  }

  function updateReportLink(match) {
    const supportUrl = new URL("/support/", window.location.origin);
    const message = [
      "Broken link report",
      "",
      "Attempted URL: " + window.location.href,
      "Suggested route: " + (match ? match.label + " (" + new URL(match.href, window.location.origin).href + ")" : "none"),
      "",
      "What I clicked before landing here:"
    ].join("\n");
    supportUrl.searchParams.set("category", "other");
    supportUrl.searchParams.set("message", message);
    reportLink.href = supportUrl.pathname + supportUrl.search;
  }

  function renderSearch(query) {
    const normalizedQuery = normalize(query);
    const scored = routes
      .map((route) => ({
        route,
        score: normalizedQuery ? routeScore(normalizedQuery, route, selectedIntent) : intentScore(route, selectedIntent)
      }))
      .filter((entry) => !normalizedQuery || entry.score > 0.04)
      .sort((a, b) => b.score - a.score || a.route.label.localeCompare(b.route.label))
      .slice(0, normalizedQuery ? 8 : 11);

    routeResults.replaceChildren();
    if (!scored.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No real route matched that search. Try a product name like Xero or a policy word like refund.";
      routeResults.append(empty);
      return;
    }

    scored.forEach(({ route }) => {
      routeResults.append(routeCard(route));
    });
  }

  function renderEscapeRoutes() {
    const ids = allIntentIds[selectedIntent] || allIntentIds.statement;
    const selected = ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 4);
    escapeRoutes.replaceChildren();
    selected.forEach((route) => escapeRoutes.append(routeCard(route)));
  }

  function routeCard(route) {
    const card = document.createElement("a");
    card.className = "route-card";
    card.href = route.href;

    const title = document.createElement("strong");
    title.textContent = route.label;

    const action = document.createElement("span");
    action.textContent = "Open";
    title.append(action);

    const reason = document.createElement("span");
    reason.textContent = route.reason || route.href;

    card.append(title, reason);
    return card;
  }

  function bestRoute(value, intent) {
    const normalized = normalize(value);
    const pool = routes.filter((route) => route.intent.includes(intent));
    const candidates = pool.length ? pool : routes;
    return candidates
      .map((route) => ({ route, score: routeScore(normalized, route, intent) }))
      .sort((a, b) => b.score - a.score || a.route.label.localeCompare(b.route.label))[0].route;
  }

  function routeScore(normalizedNeedle, route, intent) {
    const haystack = normalize([route.label, route.href, route.keywords, route.reason].join(" "));
    const routePath = normalize(route.href);
    const tokens = normalizedNeedle.split(" ").filter((token) => token.length > 1);
    const routeTokens = new Set(haystack.split(" ").filter(Boolean));
    const overlap = tokens.reduce((count, token) => count + (routeTokens.has(token) ? 1 : 0), 0);
    const contains = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
    const intentBoost = route.intent.includes(intent) ? 0.28 : 0;
    const directPathBoost = normalizedNeedle && routePath.includes(normalizedNeedle.replace(/\s+/g, " ")) ? 0.45 : 0;
    const distance = similarity(normalizedNeedle, routePath);
    return intentBoost + directPathBoost + overlap * 0.22 + contains * 0.08 + distance;
  }

  function intentScore(route, intent) {
    if (route.intent.includes(intent)) return 1;
    if (route.id === "formats") return 0.8;
    return 0.2;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/[^/]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cleanPath(value) {
    const clean = String(value || "/").replace(/\s+/g, " ").trim();
    return clean || "/";
  }

  function similarity(a, b) {
    const left = a.slice(0, 80);
    const right = b.slice(0, 80);
    if (!left || !right) return 0;
    const maxLength = Math.max(left.length, right.length);
    return Math.max(0, 1 - levenshtein(left, right) / maxLength) * 0.34;
  }

  function levenshtein(a, b) {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const insert = current[j - 1] + 1;
        const remove = previous[j] + 1;
        const replace = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
        current[j] = Math.min(insert, remove, replace);
      }
      for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
    }
    return previous[b.length];
  }
})();
