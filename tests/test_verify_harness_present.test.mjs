// Pin the standing-rule verification harness to disk (fleet-ops#524).
//
// The standing rule (Nish, 2026-08-20) says every product repo ships ONE
// checked-in verification skill at .claude/skills/verify-<app>/SKILL.md
// with the five required headings (LAUNCH, DOCTOR, DRIVE, EVIDENCE,
// CLEANUP) plus a features/ map. The fleet-verify-harness-canary in
// fleet-ops-deploy-clone watches this on a heartbeat tick, but the canary
// lives in another repo and is not exercised by this repo's own CI.
//
// This suite is the repo-local mirror of the canary's local-only path: a
// discovery test that runs in the same `node --test "tests/**/*.test.mjs"`
// job the existing suites run, so a regression that removes the harness,
// drops a required heading, or empties the features/ map fails CI on
// this repo before the next heartbeat tick would have noticed.
//
// The harness being pinned here is itself the in-process proof — the
// SKILL.md, the features/ map, the LAUNCH script, and the in-process
// worker test together make the "did we keep the harness on HEAD?"
// question a one-line grep instead of a stand-up ask. fleet-ops#963
// (a stale re-firing of fleet-ops#770) is the gap this test was added
// against: a canary tick that landed 45 seconds after PR #138 merged,
// while the canary's local HEAD was still behind origin/main. The fix
// is to make the harness's own presence a CI gate on this repo so the
// gap cannot re-occur via a missing or accidentally-reverted file.
//
// node --test runs this file directly; no transpiler, no third-party deps.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const REQUIRED_HEADINGS = ["LAUNCH", "DOCTOR", "DRIVE", "EVIDENCE", "CLEANUP"];

const SKILL_PATH = ".claude/skills/verify-inish-site/SKILL.md";
const FEATURES_DIR = ".claude/skills/verify-inish-site/features";
const LAUNCH_SCRIPT = "scripts/launch_local.sh";
const INPROCESS_TEST = "tests/test_worker_edge.test.mjs";
const LIVE_E2E = "scripts/verify_live.py";
const POLICY_MODULE = "functions/policy.js";

function repoExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

function repoDirExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isDirectory();
  } catch {
    return false;
  }
}

function readSkillBody() {
  return readFileSync(resolve(repoRoot, SKILL_PATH), "utf8");
}

test("harness: SKILL.md is checked in at the standing-rule path", () => {
  // The canary looks at .claude/skills/verify-<app>/SKILL.md specifically;
  // a move to e.g. docs/verify/SKILL.md would silently disable the
  // observation on this repo. The path itself is the contract.
  assert.ok(
    repoExists(SKILL_PATH),
    `missing harness at ${SKILL_PATH} — re-apply the standing rule (fleet-ops#524)`
  );
});

test("harness: SKILL.md frontmatter carries name and description", () => {
  // The Claude skill frontmatter is the only piece the host reads before
  // the body. A skill file without a name/description pair does not
  // register as a real skill even when the body is correct.
  const body = readSkillBody();
  const fmMatch = body.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, "SKILL.md must have YAML frontmatter delimited by ---");
  const fm = fmMatch[1];
  assert.ok(/^name:\s*\S+/m.test(fm), "frontmatter must declare `name:`");
  assert.ok(/^description:\s*\S+/m.test(fm), "frontmatter must declare `description:`");
  // The skill name must match the directory it lives in — the canary
  // matches on .claude/skills/verify-<app>/, so a name mismatch would
  // mean the canary and the human reader disagree on what the skill is.
  const name = fm.match(/^name:\s*(\S+)/m)[1];
  assert.equal(name, "verify-inish-site");
});

test("harness: every required standing-rule heading is present", () => {
  // The canary requires LAUNCH/DOCTOR/DRIVE/EVIDENCE/CLEANUP (config
  // verify-harness.json, fleet-ops#524). Match the canary's own regex
  // shape (## <heading> with optional trailing text) so a heading written
  // as `##Launch` or `## LAUNCHING` does not silently pass.
  const body = readSkillBody();
  for (const heading of REQUIRED_HEADINGS) {
    const re = new RegExp(`^##\\s+${heading}(\\s|$)`, "m");
    assert.ok(
      re.test(body),
      `SKILL.md must include a "## ${heading}" heading (fleet-ops#524)`
    );
  }
});

test("harness: features/ map is a non-empty directory of .md files", () => {
  // The standing rule says "plus a features/ map" — the canary checks
  // features_on_head() returns at least one .md file. Mirror that here.
  assert.ok(
    repoDirExists(FEATURES_DIR),
    `missing features/ directory at ${FEATURES_DIR}`
  );
  const entries = readdirSync(resolve(repoRoot, FEATURES_DIR));
  const mdFiles = entries.filter((e) => e.endsWith(".md"));
  assert.ok(
    mdFiles.length > 0,
    `features/ must contain at least one .md file, found ${mdFiles.length}`
  );
  // Every feature must be a top-level .md, never nested or with a suffix
  // the canary regex would not match.
  for (const name of mdFiles) {
    assert.ok(
      /^[a-z0-9-]+\.md$/.test(name),
      `feature file name ${name} must be lowercase kebab-case .md (canary regex)`
    );
  }
});

test("harness: LAUNCH points at the deterministic local launch script", () => {
  // The standing rule says LAUNCH must name the exact start command. The
  // shipped launch script is the only one in the repo: it stages a temp
  // dir, rewrites canonicalOrigin to loopback, and probes /about.html.
  // If the script goes away, the LAUNCH section's promise is broken.
  assert.ok(
    repoExists(LAUNCH_SCRIPT),
    `LAUNCH contract needs ${LAUNCH_SCRIPT} on disk`
  );
  // The SKILL.md must reference the script — a LAUNCH section that
  // describes a different start command (or none) defeats the harness.
  const body = readSkillBody();
  assert.ok(
    body.includes("launch_local.sh"),
    "LAUNCH section must name scripts/launch_local.sh as the start command"
  );
});

test("harness: the in-process worker test the harness advertises still exists", () => {
  // The SKILL.md advertises `node --test tests/test_worker_edge.test.mjs`
  // as the deterministic no-wrangler proof. If that file is renamed or
  // removed, the SKILL.md's promise points at a thing that no longer
  // exists — the harness is hollow.
  assert.ok(
    repoExists(INPROCESS_TEST),
    `${INPROCESS_TEST} must stay on disk; the SKILL.md's no-wrangler proof points at it`
  );
  assert.ok(
    repoExists(POLICY_MODULE),
    `${POLICY_MODULE} must stay on disk; the in-process proof imports from it`
  );
});

test("harness: the live E2E script the harness advertises still exists", () => {
  // The SKILL.md names scripts/verify_live.py as the live-edge byte
  // parity proof. A LAUNCH section that points at a missing script
  // is the exact class of regression this suite exists to catch.
  assert.ok(
    repoExists(LIVE_E2E),
    `${LIVE_E2E} must stay on disk; the SKILL.md's live E2E points at it`
  );
});

test("harness: the skill name in the directory matches the in-repo products", () => {
  // The canary's regex is `verify-<app>`; the app is the repo's product
  // name. The inish-site skill is verify-inish-site, matching the
  // checkout directory. If a future skill is added at verify-some-other-app
  // it would not be the inish-site harness, and the canary would
  // observably look at the wrong file.
  const skillDir = SKILL_PATH.split("/").slice(0, -1).join("/");
  const expected = "verify-inish-site";
  assert.ok(
    skillDir.endsWith(`/${expected}`),
    `skill directory must end with /${expected} (got ${skillDir})`
  );
});
