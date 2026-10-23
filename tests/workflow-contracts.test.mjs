import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS_DIR = path.join(REPO_ROOT, ".github", "workflows");
const OFF_SWITCH_HEADING = "## Automation Off-Switches";
const FULL_SHA = /^[0-9a-f]{40}$/;
const TRIGGER_ALIAS = new Map([
  ["push", /push|merge/i],
  ["pull_request", /pull request(?!-? event)|\bpr\b/i],
  ["pull_request_target", /pull-?request event/i],
  ["pull_request_review", /review submitted|pull-request review/i],
  ["workflow_dispatch", /manual|dispatch/i],
  ["deployment_status", /after a successful .*deploy|successful production deploy/i],
  ["schedule", /utc|schedule|cron|daily|weekly|hour/i],
  ["workflow_run", /completed .*run|after .*ci run/i],
  ["workflow_call", /called by another workflow|reusable/i],
  ["issues", /issue/i],
  ["issue_comment", /comment/i],
  ["label", /label event|labeled event/i],
  ["create", /tag pushed|branch pushed|new tag/i],
  ["delete", /branch or tag deleted/i],
  ["release", /release published/i],
  ["discussion", /discussion/i],
  ["merge_group", /merge queue/i]
]);

function triggerBlock(name) {
  const source = readFileSync(path.join(WORKFLOWS_DIR, name), "utf8");
  const start = source.search(/^on:/m);
  assert.notEqual(start, -1, `${name} declares no top-level on: block`);
  const rest = source.slice(start);
  const end = rest.search(/^(permissions|concurrency|env|defaults|jobs):/m);
  assert.notEqual(end, -1, `${name} on: block has no top-level terminator`);
  return rest.slice(0, end);
}

function triggerNames(name) {
  return [...triggerBlock(name).matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
}

function workflowNames() {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

function workflowSource(name) {
  return readFileSync(path.join(WORKFLOWS_DIR, name), "utf8");
}

function offSwitchRows() {
  const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
  const heading = readme.indexOf(OFF_SWITCH_HEADING);
  assert.notEqual(heading, -1, `README.md carries no "${OFF_SWITCH_HEADING}" section`);
  const sectionEnd = readme.indexOf("\n## ", heading + OFF_SWITCH_HEADING.length);
  const section =
    sectionEnd === -1 ? readme.slice(heading) : readme.slice(heading, sectionEnd);
  return section
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

test("every workflow file has a README off-switch row", () => {
  const documented = new Set(offSwitchRows().map((cells) => cells[0].replace(/`/g, "")));
  for (const name of workflowNames()) {
    assert.ok(documented.has(name), `README.md documents no off-switch for ${name}`);
  }
});

test("each off-switch row names what fires the workflow and one way to stop it", () => {
  const rows = offSwitchRows();
  assert.ok(rows.length > 0, "the off-switch table has no rows");
  for (const cells of rows) {
    assert.ok(cells.length >= 3, `off-switch row "${cells[0]}" is missing a column`);
    const [file, fires, offSwitch] = cells;
    const declared = triggerNames(file.replace(/`/g, ""));
    assert.ok(declared.length > 0, `off-switch row "${cells[0]}" names no real workflow file`);
    const claimed = [...TRIGGER_ALIAS]
      .filter(([, alias]) => alias.test(fires))
      .map(([trigger]) => trigger);
    assert.deepEqual(
      claimed.slice().sort(),
      declared.slice().sort(),
      `off-switch row "${file}" describes ${claimed.join(", ") || "no trigger"}, ` +
        `but the file declares ${declared.join(", ")}`
    );
    assert.ok(offSwitch.length > 20, `off-switch row "${cells[0]}" does not say how to stop it`);
    assert.match(
      offSwitch,
      /delete|remove/i,
      `off-switch row "${cells[0]}" names no delete or remove step`
    );
  }
});

test("the off-switch table names every workflow file it documents", () => {
  const documented = new Set(offSwitchRows().map((cells) => cells[0].replace(/`/g, "")));
  for (const name of workflowNames()) {
    assert.ok(documented.has(name), `README.md documents no off-switch for ${name}`);
  }
  for (const name of documented) {
    assert.ok(
      workflowNames().includes(name),
      `README.md documents an off-switch for "${name}", which is not a workflow file`
    );
  }
});

test("ci.yml deploys only from main and never from a pull request", () => {
  const source = workflowSource("ci.yml");
  assert.match(triggerBlock("ci.yml"), /^ {2}pull_request:$/m);
  assert.match(triggerBlock("ci.yml"), /^ {2}push:$/m);
  assert.match(
    triggerBlock("ci.yml"),
    /^ {4}branches: \[main\]$/m,
    "the push trigger must be limited to main, so a branch push never deploys"
  );
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /needs: \[test\]/);
});

test("agent-dispatch.yml stays a trigger stub that delegates to the fleet-ops dispatcher", () => {
  const source = workflowSource("agent-dispatch.yml");
  assert.match(
    source,
    /uses:\s*Nishfleet\/fleet-ops\/\.github\/workflows\/agent-dispatch\.yml@\S+/
  );
  assert.doesNotMatch(source, /runs-on:/, "the stub grew a runner job instead of delegating");
  assert.match(
    triggerBlock("agent-dispatch.yml"),
    /schedule:/,
    "the 6-hour sweep is what drains the labelled issue queue"
  );
});

test("lighthouse.yml audits the live page through the fleet-ops workflow", () => {
  const source = workflowSource("lighthouse.yml");
  const calls = [...source.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
  assert.ok(calls.length > 0, "lighthouse.yml calls no reusable workflow");
  for (const call of calls) {
    const parts = call.match(/^(\S+)@(\S+)$/);
    assert.ok(parts, `lighthouse.yml calls "${call}" without a ref`);
    const [, ref] = parts;
    assert.ok(
      ref.startsWith("Nishfleet/fleet-ops/.github/workflows/"),
      `lighthouse.yml calls an unexpected reusable workflow: ${ref}`
    );
  }
  assert.match(source, /urls:\s*\|\s*\n\s+https:\/\/nish\.sh\/daily/);
});

test("the pinact config keeps the fleet-ops callee on main, and says why", () => {
  const pinact = readFileSync(path.join(REPO_ROOT, ".pinact.yaml"), "utf8");
  assert.match(pinact, /Nishfleet\/fleet-ops\/\.github\/workflows\/\.\*/);
  assert.match(pinact, /ref: main/);
  const workflow = workflowSource("agent-dispatch.yml");
  const call = workflow.match(/agent-dispatch\.yml@(\S+)/);
  assert.ok(call, "agent-dispatch.yml calls no fleet-ops workflow");
  assert.equal(call[1], "main", "the callee must stay on main while pinact exempts it");
});

test("the reusable workflow refs are the only ones left unpinned, and pinact exempts them", () => {
  const exempt = /Nishfleet\/fleet-ops\/\.github\/workflows\/\.\*/;
  for (const name of workflowNames()) {
    const source = workflowSource(name);
    for (const call of source.matchAll(/uses:\s*(\S+)@(\S+)/g)) {
      const [, ref, version] = call;
      if (!ref.startsWith("Nishfleet/fleet-ops/.github/workflows/")) {
        assert.ok(
          FULL_SHA.test(version),
          `${name} calls ${ref}@${version}, which is not a full commit SHA`
        );
      }
    }
  }
  assert.ok(exempt.test(readFileSync(path.join(REPO_ROOT, ".pinact.yaml"), "utf8")));
});
