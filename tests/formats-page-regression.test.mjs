import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("formats page renders a zero-result state with a reset action", () => {
  assert.match(source, /const noFormatsMatch = visiblePairs\.length === 0/);
  assert.match(source, /className="formats-empty"/);
  assert.match(source, /role="status"/);
  assert.match(source, /No formats match your search/);
  assert.match(source, /No formats in this category yet/);
  assert.match(source, /const visiblePairs = useMemo\(/);
  assert.match(source, /visiblePairs\.map\(\(pair\) => \(/);
});

test("formats empty state gives a keyboard-accessible reset button", () => {
  assert.match(source, /function resetFormatsFilters\(\) \{/);
  assert.match(source, /setQuery\(""\);/);
  assert.match(source, /setCategory\("Available"\);/);
  assert.match(source, /searchInputRef\.current\?\.focus\(\)/);
  assert.match(source, /type="button" className="secondary-button" onClick=\{resetFormatsFilters\}/);
  assert.match(source, /Clear search and filters/);
  assert.match(source, /ref=\{searchInputRef\}/);
});
