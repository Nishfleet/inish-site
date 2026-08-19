import test from "node:test";
import assert from "node:assert/strict";
import { validateStatementRows } from "../functions/lib/validate-statement.js";
import {
  balanceMismatchRows,
  cleanStatementRows,
  duplicateRows,
  twoSidedRows,
  weakCoverageRows
} from "./fixtures/statement-rows.mjs";

test("scores a clean statement with strong trust and no quality warnings", () => {
  const result = validateStatementRows(cleanStatementRows, 0.93, {
    totalPages: 2,
    parsedPages: 2
  });

  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 4);
  assert.ok(result.trustScore >= 0.85);
  assert.equal(result.checks.runningBalance.matched, 3);
  assert.deepEqual(result.warnings, []);
});

test("warns and lowers trust when running balances do not reconcile", () => {
  const clean = validateStatementRows(cleanStatementRows, 0.93, { totalPages: 2, parsedPages: 2 });
  const mismatched = validateStatementRows(balanceMismatchRows, 0.93, { totalPages: 2, parsedPages: 2 });

  assert.equal(mismatched.ok, true);
  assert.ok(mismatched.trustScore < clean.trustScore);
  assert.ok(mismatched.checks.runningBalance.ratio < 0.85);
  assert.ok(mismatched.warnings.some((warning) => warning.includes("Running balance continuity")));
});

test("fails when too many rows use both money columns", () => {
  const result = validateStatementRows(twoSidedRows, 0.91, {
    totalPages: 2,
    parsedPages: 2
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /both money columns/);
  assert.ok(result.warnings.some((warning) => warning.includes("money_in and money_out")));
});

test("warns on possible duplicate transaction rows", () => {
  const result = validateStatementRows(duplicateRows, 0.91, {
    totalPages: 2,
    parsedPages: 2
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.duplicates.count, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("possible duplicate")));
});

test("fails weak date and amount coverage before paid export", () => {
  const result = validateStatementRows(weakCoverageRows, 0.9, {
    estimatedPages: 3
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /valid dates/);
  assert.ok(result.warnings.some((warning) => warning.includes("Page coverage")));
});
