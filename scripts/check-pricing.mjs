import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import data from "../src/data/converters.json" with { type: "json" };
import { PLANS } from "../functions/lib/jobs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicTexts = await Promise.all([
  readFile(path.join(root, "functions/_middleware.js"), "utf8"),
  readFile(path.join(root, "public/llms.txt"), "utf8"),
  readFile(path.join(root, "ops/pricing-strategy.md"), "utf8")
]);

const failures = [];

for (const plan of data.pricing) {
  const backend = PLANS[plan.id];
  if (!backend) {
    failures.push(`Missing backend plan for ${plan.id}.`);
    continue;
  }
  if (backend.price !== plan.price || backend.amount !== plan.amount || backend.pages !== plan.pages) {
    failures.push(`Pricing mismatch for ${plan.id}: frontend ${plan.price}/${plan.amount}/${plan.pages}, backend ${backend.price}/${backend.amount}/${backend.pages}.`);
  }

  const expected = `${plan.price} for ${plan.pages} pages`;
  publicTexts.forEach((text, index) => {
    if (!text.includes(expected)) {
      failures.push(`Public pricing text ${index + 1} is missing "${expected}".`);
    }
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Pricing is consistent.");
