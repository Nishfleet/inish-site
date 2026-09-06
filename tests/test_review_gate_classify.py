"""Regression test: the required `classify` context must be structurally
unable to skip.

Why this exists: PR #42 merged into main on 2026-08-10 with the required
`classify` context concluded SKIPPED. GitHub treats a skipped required context
as satisfied, so the job-level `if: github.event.pull_request.draft == false`
had turned a required gate into a formality. The durable rule this test pins
down is: a required context must run unconditionally and fail loudly when it
cannot classify - it must never be able to report a non-executed success.

The property under test is the workflow FILE, not the incident:
1. the job that produces the `classify` context has no job-level `if:` key
   (a job-level `if:` is the only way the whole context can skip);
2. no step inside that job uses `continue-on-error: true`;
3. `on.pull_request.types` contains `opened`, `synchronize`, `reopened` and
   `ready_for_review` (the flip out of draft must always produce a fresh run);
4. the job name / context id is still exactly `classify` (branch protection
   requires that literal string; renaming it would silently un-gate main).

Parser honesty: this is a conservative line-based reader, not a YAML parser.
It guarantees the properties above only for plain, non-anchored, non-templated
YAML like this repository's workflow files. It cannot follow YAML anchors or
merge keys, cannot evaluate `${{ }}` templating, and would misread a workflow
that duplicated the classify job under another key. It does handle both flow
style (`types: [a, b]`) and block style (`types:` followed by `- a` lines) and
strips full-line and trailing ` #` comments.

The file under test can be overridden with REVIEW_GATE_WORKFLOW so the
regression can be proven against a historical copy (the old file must FAIL
this suite - a test that passes on the pre-fix workflow has tested nothing).
"""

import os
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = Path(
    os.environ.get("REVIEW_GATE_WORKFLOW")
    or REPO_ROOT / ".github" / "workflows" / "review-gate.yml"
)

REQUIRED_TYPES = {"opened", "synchronize", "reopened", "ready_for_review"}


def _strip_comment(line):
    """Cut a trailing ` # comment` (the workflow files use none inside values)."""
    for i, ch in enumerate(line):
        if ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def read_workflow(path=None):
    path = Path(path or WORKFLOW)
    lines = [_strip_comment(ln.rstrip("\n")) for ln in path.read_text().splitlines()]
    return [ln for ln in lines if ln.strip()]


def find_on_types(lines):
    """Return the set of pull_request activity types, or None if missing.

    Handles `types: [a, b]` and a block list under `types:`. Returns None for
    an `on:` block that does not mention pull_request at all, so the caller can
    distinguish "no events at all" from "types present but wrong".
    """
    on_idx = next((i for i, ln in enumerate(lines) if ln == "on:" or ln.startswith("on: ")), None)
    if on_idx is None:
        return None
    seen_pull_request = False
    in_types_block = False
    types = set()
    for ln in lines[on_idx + 1:]:
        indent = _indent(ln)
        if indent == 0:
            break  # left the `on:` block
        body = ln.lstrip()
        if not body:
            continue
        if body == "pull_request:" or body.startswith("pull_request: "):
            seen_pull_request = True
            continue
        if indent == 2:
            if seen_pull_request:
                break  # next top-level event under `on:`; PR types are done
            continue
        if not seen_pull_request:
            continue
        if in_types_block:
            if body.startswith("- "):
                types.add(body[2:].strip().strip("'\" "))
                continue
            in_types_block = False
        if body.startswith("types:"):
            tail = body.split(":", 1)[1].strip()
            if tail:
                m = re.match(r"\[(.*)\]", tail)
                if m:
                    types.update(
                        t.strip().strip("'\" ")
                        for t in m.group(1).split(",")
                        if t.strip()
                    )
            else:
                in_types_block = True
    if not seen_pull_request:
        return None
    return types


def classify_job_block(lines):
    """Return the (start, end) index range of the `classify` job, or None.

    The job lives under `jobs:` at two-space indent; its body ends at the next
    two-space key or the end of the file.
    """
    jobs_idx = next((i for i, ln in enumerate(lines) if ln == "jobs:" or ln.startswith("jobs: ")), None)
    if jobs_idx is None:
        return None
    start = None
    for i in range(jobs_idx + 1, len(lines)):
        if _indent(lines[i]) != 2:
            continue
        key = lines[i].lstrip().split(":", 1)[0]
        if start is None and key == "classify":
            start = i
        elif start is not None:
            return (start, i)
    if start is not None:
        return (start, len(lines))
    return None


class ReviewGateClassifyCannotSkipTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not WORKFLOW.is_file():
            raise unittest.SkipTest(f"workflow not found: {WORKFLOW}")
        cls.lines = read_workflow(WORKFLOW)
        cls.block = classify_job_block(cls.lines)
        cls.assertTrue(cls.block is not None, "no `classify` job found under `jobs:`")
        cls.job_lines = cls.lines[cls.block[0]:cls.block[1]]
        cls.job_key = cls.lines[cls.block[0]].lstrip().split(":", 1)[0]

    def test_job_has_no_job_level_if(self):
        """A job-level `if:` is the one way the whole required context can skip."""
        for ln in self.job_lines:
            if _indent(ln) != 4:
                continue  # only job-level keys sit at four-space indent
            if ln.lstrip().split(":", 1)[0] == "if":
                self.fail(
                    "job `classify` still has a job-level `if:` condition; "
                    "GitHub treats a skipped required context as satisfied "
                    "(PR #42 merged with classify SKIPPED). Draft handling "
                    "must be an in-job step, not a job-level gate."
                )

    def test_no_continue_on_error_in_classify_job(self):
        """Failure to classify must fail the job, never pass silently."""
        for ln in self.job_lines:
            if ln.lstrip().startswith("continue-on-error:"):
                value = ln.split(":", 1)[1].strip()
                if value.lower() in ("true", "yes", "on"):
                    self.fail(
                        "step in job `classify` uses `continue-on-error: true`; "
                        "a classification failure would then report success"
                    )

    def test_pull_request_types_include_required_events(self):
        """The flip out of draft must always create a fresh run."""
        types = find_on_types(self.lines)
        self.assertIsNotNone(types, "`on.pull_request` not found in the workflow")
        missing = REQUIRED_TYPES - types
        self.assertEqual(
            missing,
            set(),
            "`on.pull_request.types` is missing event(s) %s; without them the "
            "draft-to-ready flip may never produce a fresh run and the "
            "required context can go stale or stay skipped" % sorted(missing),
        )

    def test_context_name_is_exactly_classify(self):
        """Branch protection requires the literal context name `classify`."""
        self.assertEqual(
            self.job_key,
            "classify",
            "the job producing the required context must keep the name "
            "`classify`; renaming it would silently un-gate main",
        )


if __name__ == "__main__":
    unittest.main()
