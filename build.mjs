import { createHash } from "node:crypto";
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import Beasties from "beasties";

const source = "public";
const output = "dist";

await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });

const beasties = new Beasties({
  path: output,
  preload: "body",
  pruneSource: false,
  logLevel: "warn"
});

const rules = [];
for (const name of (await readdir(output)).filter((file) => file.endsWith(".html"))) {
  const file = `${output}/${name}`;
  const html = await beasties.process(await readFile(file, "utf8"));
  const blocks = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)];
  if (blocks.length === 0) throw new Error(`${name}: beasties inlined no critical CSS`);
  const hashes = blocks.map(
    ([, css]) => `'sha256-${createHash("sha256").update(css).digest("base64")}'`
  );
  await writeFile(file, html);
  rules.push(`/${name}\n  X-Style-Hashes: ${hashes.join(" ")}`);
}

await writeFile(`${output}/_headers`, `${rules.join("\n")}\n`);
