const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateStatementRows(rows, modelConfidence = 0, options = {}) {
  const normalized = normalizeRows(rows);
  const rowCount = normalized.length;

  if (rowCount < 1) {
    return fail("No transaction rows were found.", {
      confidence: 0,
      rowCount: 0,
      warnings: [],
      checks: emptyChecks()
    });
  }

  const checks = {
    dateCoverage: dateCoverage(normalized),
    amountCoverage: amountCoverage(normalized),
    oneSidedMoney: oneSidedMoney(normalized),
    runningBalance: runningBalanceContinuity(normalized),
    duplicates: duplicateCheck(normalized),
    pageCoverage: pageCoverage(normalized, options),
    rowConfidence: average(normalized.map((row) => row.confidence))
  };

  const warnings = validationWarnings(checks, rowCount, options);
  const structuralScore =
    0.22 * checks.dateCoverage.score +
    0.18 * checks.amountCoverage.score +
    0.16 * checks.oneSidedMoney.score +
    0.2 * checks.runningBalance.score +
    0.1 * checks.duplicates.score +
    0.08 * checks.pageCoverage.score +
    0.06 * checks.rowConfidence;
  const sourceScore = clamp(Number(modelConfidence || 0), 0, 1);
  const blendedScore = 0.82 * structuralScore + 0.18 * sourceScore;
  const confidence = clamp(sourceScore > 0 ? Math.min(blendedScore, sourceScore + 0.12) : structuralScore, 0, 1);

  if (checks.dateCoverage.ratio < 0.8) {
    return fail("Too many rows are missing valid dates.", { confidence: Math.min(confidence, 0.54), rowCount, warnings, checks });
  }
  if (checks.amountCoverage.ratio < 0.8) {
    return fail("Too many rows are missing transaction amounts.", { confidence: Math.min(confidence, 0.54), rowCount, warnings, checks });
  }
  if (checks.oneSidedMoney.ratio < 0.9) {
    return fail("Too many rows put values in both money columns.", { confidence: Math.min(confidence, 0.54), rowCount, warnings, checks });
  }
  if (checks.runningBalance.checked >= 3 && checks.runningBalance.ratio < 0.5) {
    return fail("Running balances do not line up with transaction amounts.", { confidence: Math.min(confidence, 0.54), rowCount, warnings, checks });
  }
  if (confidence < 0.55) {
    return fail("The trust score was too low for a paid export.", { confidence, rowCount, warnings, checks });
  }

  return {
    ok: true,
    message: "",
    confidence,
    trustScore: confidence,
    rowCount,
    warnings,
    checks
  };
}

function validationWarnings(checks, rowCount, options) {
  const warnings = [];
  if (checks.runningBalance.checked >= 2 && checks.runningBalance.ratio < 0.85) {
    warnings.push(
      `Running balance continuity is weak: ${checks.runningBalance.matched}/${checks.runningBalance.checked} checked rows matched.`
    );
  }
  if (checks.oneSidedMoney.bothColumns > 0) {
    warnings.push(`${checks.oneSidedMoney.bothColumns} row${plural(checks.oneSidedMoney.bothColumns)} had both money_in and money_out.`);
  }
  if (checks.duplicates.count > 0) {
    warnings.push(`${checks.duplicates.count} possible duplicate transaction row${plural(checks.duplicates.count)} found.`);
  }
  if (checks.dateCoverage.ratio < 0.95) {
    warnings.push(`${rowCount - checks.dateCoverage.valid} row${plural(rowCount - checks.dateCoverage.valid)} had missing or non-ISO dates.`);
  }
  if (checks.dateCoverage.valid >= 2 && checks.dateCoverage.spanDays > 400) {
    warnings.push(`Date coverage spans ${checks.dateCoverage.spanDays} days, which is unusual for one statement.`);
  }
  if (checks.pageCoverage.numberedRatio < 0.5) {
    warnings.push("Page coverage is weak because most rows did not include a page number.");
  }
  if (!options.previewPages && checks.pageCoverage.expectedPages > 1 && checks.pageCoverage.coveredPages < checks.pageCoverage.expectedPages) {
    warnings.push(`Rows cover ${checks.pageCoverage.coveredPages} of ${checks.pageCoverage.expectedPages} expected pages.`);
  }
  return warnings;
}

function dateCoverage(rows) {
  const dates = rows
    .map((row) => row.date)
    .filter((date) => ISO_DATE_PATTERN.test(date))
    .map((date) => Date.parse(`${date}T00:00:00.000Z`))
    .filter(Number.isFinite);
  const valid = dates.length;
  const ratio = valid / rows.length;
  const spanDays = dates.length >= 2 ? Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) : 0;
  return {
    valid,
    ratio,
    spanDays,
    score: clamp(ratio - (spanDays > 400 ? 0.12 : 0), 0, 1)
  };
}

function amountCoverage(rows) {
  const valid = rows.filter((row) => hasNumber(row.money_in) || hasNumber(row.money_out)).length;
  const ratio = valid / rows.length;
  return { valid, ratio, score: ratio };
}

function oneSidedMoney(rows) {
  const bothColumns = rows.filter((row) => hasNumber(row.money_in) && hasNumber(row.money_out)).length;
  const ratio = (rows.length - bothColumns) / rows.length;
  return { bothColumns, ratio, score: ratio };
}

function runningBalanceContinuity(rows) {
  const chronological = continuityForOrder(rows);
  const reverse = continuityForOrder(rows.slice().reverse());
  const best = chronological.score >= reverse.score ? chronological : reverse;
  return {
    ...best,
    direction: best === chronological ? "forward" : "reverse"
  };
}

function continuityForOrder(rows) {
  let checked = 0;
  let matched = 0;
  let previous = rows[0];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!hasNumber(previous?.balance) || !hasNumber(row.balance)) {
      previous = row;
      continue;
    }

    const signedAmount = signedTransactionAmount(row);
    if (!hasNumber(signedAmount)) {
      previous = row;
      continue;
    }

    checked += 1;
    const expected = roundMoney(Number(previous.balance) + Number(signedAmount));
    if (Math.abs(expected - Number(row.balance)) <= 0.03) matched += 1;
    previous = row;
  }

  if (!checked) return { checked: 0, matched: 0, ratio: 1, score: 0.72 };
  const ratio = matched / checked;
  return { checked, matched, ratio, score: clamp(0.25 + 0.75 * ratio, 0, 1) };
}

function duplicateCheck(rows) {
  const seen = new Set();
  let count = 0;
  rows.forEach((row) => {
    const key = [
      row.date,
      normalizeKey(row.description),
      moneyKey(row.money_in),
      moneyKey(row.money_out),
      moneyKey(row.balance)
    ].join("|");
    if (seen.has(key)) count += 1;
    else seen.add(key);
  });
  const ratio = count / rows.length;
  return { count, ratio, score: clamp(1 - ratio * 2, 0, 1) };
}

function pageCoverage(rows, options) {
  const pages = rows.map((row) => Number(row.page)).filter((page) => Number.isInteger(page) && page > 0);
  const uniquePages = new Set(pages);
  const numberedRatio = pages.length / rows.length;
  const expectedPages = Math.max(
    0,
    Number(options.parsedPages || 0),
    Number(options.totalPages || 0),
    Number(options.estimatedPages || 0)
  );
  const previewPages = Math.max(0, Number(options.previewPages || 0));
  const expectedForScore = previewPages ? Math.min(expectedPages || previewPages, previewPages) : expectedPages;
  const coveredPages = uniquePages.size;
  const coverageRatio = expectedForScore > 0 ? Math.min(1, coveredPages / expectedForScore) : 1;
  const score = clamp(0.65 * numberedRatio + 0.35 * coverageRatio, 0, 1);
  return {
    numberedRows: pages.length,
    numberedRatio,
    coveredPages,
    expectedPages,
    score
  };
}

function signedTransactionAmount(row) {
  const moneyIn = hasNumber(row.money_in) ? Number(row.money_in) : 0;
  const moneyOut = hasNumber(row.money_out) ? Number(row.money_out) : 0;
  if (moneyIn && moneyOut) return "";
  if (moneyIn) return Math.abs(moneyIn);
  if (moneyOut) return -Math.abs(moneyOut);
  return "";
}

function fail(message, result) {
  return {
    ok: false,
    message,
    confidence: result.confidence,
    trustScore: result.confidence,
    rowCount: result.rowCount,
    warnings: result.warnings || [],
    checks: result.checks || emptyChecks()
  };
}

function emptyChecks() {
  return {
    dateCoverage: { valid: 0, ratio: 0, spanDays: 0, score: 0 },
    amountCoverage: { valid: 0, ratio: 0, score: 0 },
    oneSidedMoney: { bothColumns: 0, ratio: 0, score: 0 },
    runningBalance: { checked: 0, matched: 0, ratio: 0, score: 0 },
    duplicates: { count: 0, ratio: 0, score: 0 },
    pageCoverage: { numberedRows: 0, numberedRatio: 0, coveredPages: 0, expectedPages: 0, score: 0 },
    rowConfidence: 0
  };
}

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      date: normalizeDate(row.date),
      description: String(row.description || "").trim().slice(0, 220),
      money_in: normalizeNumber(row.money_in),
      money_out: normalizeNumber(row.money_out),
      balance: normalizeNumber(row.balance),
      page: row.page === null || row.page === undefined ? "" : Number(row.page) || "",
      confidence: clamp(Number(row.confidence || 0), 0, 1)
    }))
    .filter((row) => row.date || row.description || hasNumber(row.money_in) || hasNumber(row.money_out));
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return text.slice(0, 10);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object" && Number.isFinite(Number(value.amount))) return Number(value.amount);
  const text = String(value);
  const negative = /^\(.*\)$/.test(text) || /-\s*\$?/.test(text);
  const number = Number(text.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return "";
  return negative ? -number : number;
}

function moneyKey(value) {
  return hasNumber(value) ? roundMoney(value).toFixed(2) : "";
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function plural(count) {
  return count === 1 ? "" : "s";
}
