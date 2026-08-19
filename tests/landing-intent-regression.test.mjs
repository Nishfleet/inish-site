import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const converters = JSON.parse(readFileSync(new URL("../src/data/converters.json", import.meta.url), "utf8")).converters;

const LANDING_PAGES = {
  "bank-statement-pdf-to-csv": { converter: "bank", output: "csv" },
  "convert-bank-statement-to-csv": { converter: "bank", output: "csv" },
  "credit-card-statement-pdf-to-csv": { converter: "bank", output: "csv" },
  "receipt-to-csv": { converter: "receipt", output: "csv" },
  "scanned-bank-statement-to-excel": { converter: "bank", output: "csv" },
  "pdf-bank-statement-to-quickbooks-csv": { converter: "bank", output: "quickbooks-csv" },
  "pdf-bank-statement-to-wave-csv": { converter: "bank", output: "wave-csv" },
  "pdf-bank-statement-to-xero-csv": { converter: "bank", output: "xero-csv" },
  "bank-statement-converter-for-bookkeepers": { converter: "bank", output: "csv" }
};

function converterById(converterId) {
  return converters.find((converter) => converter.id === converterId) || null;
}

test("app reads landing-page converter intent from URL params", () => {
  assert.match(source, /function converterIntentFromUrl\(\)/);
  assert.match(source, /params\.get\("converter"\)/);
  assert.match(source, /params\.get\("output"\)/);
  assert.match(source, /isLiveConverter\(candidate\)/, "intent must only select live converters");
  assert.match(source, /capableOutputFormats\(converter, null\)/, "intent output must be validated against the converter");
  assert.match(source, /const urlIntent = useMemo\(\(\) => converterIntentFromUrl\(\), \[\]\)/);
  assert.match(source, /useState\(urlIntent\?\.converterId \|\| "bank"\)/, "app default stays bank without intent");
  assert.match(source, /useState\(urlIntent\?\.outputFormat \|\| "csv"\)/, "app default output stays csv without intent");
});

test("landing-page intent reaches the funnel page_view event", () => {
  assert.match(source, /intentConverter: urlIntent\.converterId/);
  assert.match(source, /intentOutput: urlIntent\.outputFormat/);
  assert.match(source, /trackFunnelEvent\("page_view"/);
});

test("preselected intent changes the upload target and console bar copy", () => {
  assert.match(source, /function uploadTargetCopyFor\(converter, outputFormat\)/);
  assert.match(source, /uploadTargetCopy\.title/);
  assert.match(source, /uploadTargetCopy\.detail/);
  assert.match(source, /selectedId === "bank" \? \(/);
  assert.match(source, /Bank statement → accounting CSV/, "bank default copy stays the existing CTA");
});

test("every converter landing page deep-links its intent into the app", () => {
  for (const [page, intent] of Object.entries(LANDING_PAGES)) {
    const html = readFileSync(new URL(`../public/${page}/index.html`, import.meta.url), "utf8");
    const link = html.match(/<a class="top-link" href="([^"]*)">Open converter<\/a>/)?.[1] || "";
    assert.match(link, /^\//, `${page} should keep the Open converter link on the app origin`);
    const params = new URL(`https://aiconverter.app${link.replaceAll("&amp;", "&")}`).searchParams;
    assert.equal(params.get("converter"), intent.converter, `${page} should carry converter=${intent.converter}`);
    assert.equal(params.get("output"), intent.output, `${page} should carry output=${intent.output}`);
  }
});

test("every carried intent maps to a live converter and a real output format", () => {
  for (const [page, intent] of Object.entries(LANDING_PAGES)) {
    const converter = converterById(intent.converter);
    assert.ok(converter, `${page} intent converter ${intent.converter} must exist`);
    assert.notEqual(converter.id, "email", `${page} must not point at the email monitor`);
    const formats = converter.outputFormats || [];
    assert.ok(
      formats.some((format) => format.id === intent.output) || intent.output === "csv",
      `${page} intent output ${intent.output} must be offered by ${converter.id} (or the csv fallback)`
    );
  }
});

test("receipt page inline CTA also carries the receipt intent", () => {
  const html = readFileSync(new URL("../public/receipt-to-csv/index.html", import.meta.url), "utf8");
  assert.match(html, /href="\/\?converter=receipt&amp;output=csv">try a real receipt in the converter/);
});
