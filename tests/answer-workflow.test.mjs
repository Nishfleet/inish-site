import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");

test("the answer workflow watches CI by the name the CI workflow gives itself", () => {
  const name = workflow("ci.yml").match(/^name:[ \t]*([^#\n]+)/m)[1].trim();
  const watched = [...workflow("answer.yml").matchAll(/^[ \t]*workflows:[ \t]*\[([^\]]*)\]/gm)]
    .flatMap((match) => match[1].split(",").map((entry) => entry.trim().replace(/^["']|["']$/g, "")));
  assert.ok(watched.includes(name), `the answer workflow must watch ${name}`);
});
