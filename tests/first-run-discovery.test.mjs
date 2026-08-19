import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("first upload surface presents bank and other conversions as two honest choices", () => {
  assert.match(source, /Bank statement → accounting CSV/);
  assert.match(source, /Other file conversions/);
  assert.match(source, /<label className="upload-target">/);
});

test("other conversions choice links to the formats catalog and stays pair-conditional", () => {
  assert.match(source, /<a className="other-conversions-card" href="\/formats\/">/);
  assert.match(source, /availability\s*depends on the exact input and output pair/);
});

test("non-bank examples match families the catalog or public formats copy supports", () => {
  assert.match(source, /Receipts, invoices, screenshots, audio, documents, images, video, and archives/);
});

test("bank upload input survives the two-choice redesign", () => {
  const labelStart = source.indexOf('<label className="upload-target">');
  const labelBlock = source.slice(labelStart, source.indexOf("</label>", labelStart));
  const helperStart = source.indexOf("function uploadTargetCopyFor(");
  const helperEnd = source.indexOf("function selectedRouteTitle(", helperStart);
  const helperBlock = source.slice(helperStart, helperEnd);
  assert.match(helperBlock, /private preview/, "bank upload CTA copy must keep the private preview promise");
  assert.match(labelBlock, /<input/);
  assert.match(labelBlock, /type="file"/);
  assert.match(labelBlock, /accept=\{allAcceptedTypes\(selectableConverters\)\}/);
  assert.match(labelBlock, /onChange=\{handleFileChange\}/);
  assert.match(labelBlock, /ref=\{fileInputRef\}/);
});

test("other conversions card pins a visible keyboard focus rule", () => {
  const ruleStart = styles.indexOf(".other-conversions-card:focus-visible");
  assert.notEqual(ruleStart, -1, "expected .other-conversions-card:focus-visible rule in styles.css");
  const ruleBlock = styles.slice(ruleStart, styles.indexOf("}", ruleStart) + 1);
  assert.match(ruleBlock, /outline\s*:/);
  assert.match(ruleBlock, /outline-offset\s*:/);
});
