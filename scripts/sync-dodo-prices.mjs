import { syncDodoProductPrices } from "../functions/lib/dodo.js";

const dryRun = process.argv.includes("--dry-run");
const result = await syncDodoProductPrices(process.env, { dryRun });

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  if (result.missing?.length) {
    console.error(`Missing required Dodo config: ${result.missing.join(", ")}`);
  }
  process.exit(1);
}
