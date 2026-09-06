"""Regression test: the required `test` job must run BOTH committed test
families - the Python unittest suite AND the Node test suite.

Why this exists: PR #69 committed tests/test_middleware_deny.test.mjs, the
behavioral proof that the middleware deny branch still denies unlisted paths
(a `false &&` prefix or any other short-circuit flips its verdicts). The
required `test` job ran only `python3 -m unittest discover -s tests`, so the
Node regression never executed in CI and the merge gate stayed green even with
the deny branch disabled. The durable rule this test pins down is: the
required `test` job must invoke both discovery commands.

The property under test is the workflow FILE, not the suites:
1. the job producing the required `test` context still exists under that exact
   name (branch protection requires the literal string);
2. the job has a step whose run line invokes the Python suite by directory
   discovery (`python3 -m unittest discover -s tests`);
3. the job has a step whose run line invokes the Node suite by directory
   discovery (`node --test tests`), so every committed `*.test.mjs` under
   tests/ executes;
4. every committed test file of either family lives under tests/, i.e. inside
   the discovery scopes above - a test committed anywhere else would silently
   fall outside CI, which is exactly the defect class this suite exists to
   catch.

Parser honesty: this is a conservative line-based reader, not a YAML parser,
mirroring tests/test_review_gate_classify.py. It guarantees the properties
above only for plain, non-anchored, non-templated YAML like this repository's
workflow files. It cannot follow YAML anchors or merge keys, cannot evaluate
`${{ }}` templating, and would misread a workflow that duplicated the test job
under another key. It strips full-line and trailing ` #` comments.

The file under test can be overridden with TESTS_WORKFLOW so the regression can
be proven against a historical copy (the pre-fix file must FAIL this suite - a
test that passes on the pre-fix workflow has tested nothing).
"""

import os
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = Path(
    os.environ.get("TESTS_WORKFLOW")
    or REPO_ROOT / ".github" / "workflows" / "tests.yml"
)

# The two discovery commands the required job must run, in the literal forms
# used in this repository's tests.yml. Discovery scoping is the point: an
# explicit single-file invocation would silently omit future committed tests.
PYTHON_RUN_FRAGMENT = "python3 -m unittest discover"
PYTHON_SCOPE_FRAGMENT = "-s tests"
NODE_RUN_FRAGMENT = "node --test"
NODE_SCOPE_FRAGMENT = "tests"  # directory-scoped discovery: `node --test tests/`

NODE_TEST_GLOBS = ("*.test.mjs", "*.test.js", "*.test.cjs")


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


def test_job_block(lines):
    """Return the (start, end) index range of the `test` job, or None.

    The job lives under `jobs:` at two-space indent; its body ends at the next
    two-space key or the end of the file.
    """
    jobs_idx = next(
        (i for i, ln in enumerate(lines) if ln == "jobs:" or ln.startswith("jobs: ")),
        None,
    )
    if jobs_idx is None:
        return None
    start = None
    for i in range(jobs_idx + 1, len(lines)):
        if _indent(lines[i]) != 2:
            continue
        key = lines[i].lstrip().split(":", 1)[0]
        if start is None and key == "test":
            start = i
        elif start is not None:
            return (start, i)
    if start is not None:
        return (start, len(lines))
    return None


def step_run_lines(job_lines):
    """Return the raw `run:` step commands inside a job block.

    Step keys (`- name:`, `run:`) sit at eight-space indent in this
    repository's workflow files.
    """
    runs = []
    for ln in job_lines:
        if _indent(ln) != 8:
            continue
        if ln.lstrip().startswith("run:"):
            runs.append(ln.split(":", 1)[1].strip())
    return runs


def _repo_files(root):
    """Relative paths of regular files in the tree, skipping dot-directories.

    A CI checkout and a `git archive` extract both contain exactly the
    committed files; skipping dot-directories keeps nested worktrees, .git and
    the like out of the inventory.
    """
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if path.is_file():
            yield rel.as_posix()


def node_test_files(root):
    return sorted(p for p in _repo_files(root) if p.endswith(NODE_TEST_GLOBS))


def python_test_files(root):
    return sorted(
        p for p in _repo_files(root)
        if p.endswith(".py") and Path(p).name.startswith("test_")
    )


class RequiredTestJobRunsBothFamiliesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not WORKFLOW.is_file():
            raise unittest.SkipTest(f"workflow not found: {WORKFLOW}")
        cls.lines = read_workflow(WORKFLOW)
        cls.block = test_job_block(cls.lines)
        cls.assertTrue(cls.block is not None, "no `test` job found under `jobs:`")
        cls.job_lines = cls.lines[cls.block[0]:cls.block[1]]
        cls.job_key = cls.lines[cls.block[0]].lstrip().split(":", 1)[0]
        cls.runs = step_run_lines(cls.job_lines)

    def test_job_name_is_exactly_test(self):
        """Branch protection requires the literal context name `test`."""
        self.assertEqual(
            self.job_key,
            "test",
            "the job producing the required context must keep the name `test`; "
            "renaming it would silently un-gate main",
        )

    def test_python_family_is_invoked(self):
        """The Python suite must be run by directory discovery over tests/."""
        python_runs = [r for r in self.runs if PYTHON_RUN_FRAGMENT in r]
        self.assertTrue(
            python_runs,
            f"required job `test` has no step running the Python suite "
            f"(`{PYTHON_RUN_FRAGMENT}`); the Python family was omitted",
        )
        self.assertTrue(
            any(PYTHON_SCOPE_FRAGMENT in r for r in python_runs),
            f"the Python step must discover under `{PYTHON_SCOPE_FRAGMENT}` so "
            "every committed test_*.py in tests/ runs",
        )

    def test_node_family_is_invoked(self):
        """The Node suite must be run by directory discovery over tests/."""
        node_runs = [r for r in self.runs if NODE_RUN_FRAGMENT in r]
        self.assertTrue(
            node_runs,
            f"required job `test` has no step running the Node suite "
            f"(`{NODE_RUN_FRAGMENT}`); the Node family was omitted - "
            "tests/test_middleware_deny.test.mjs would not execute and the "
            "gate stays green when the middleware deny branch is disabled",
        )
        self.assertTrue(
            any(NODE_SCOPE_FRAGMENT in r for r in node_runs),
            f"the Node step must discover under `{NODE_SCOPE_FRAGMENT}` "
            "(e.g. `node --test tests/`) so every committed *.test.mjs under "
            "tests/ runs",
        )

    def test_every_committed_node_test_lives_inside_the_discovery_scope(self):
        """A Node test committed outside tests/ would silently skip CI."""
        outside = [p for p in node_test_files(REPO_ROOT) if not p.startswith("tests/")]
        self.assertEqual(
            outside,
            [],
            "committed Node test file(s) %s lie outside the `node --test "
            "tests/` discovery scope; move them under tests/ or extend the "
            "workflow so they run in the required `test` job" % sorted(outside),
        )

    def test_every_committed_python_test_lives_inside_the_discovery_scope(self):
        """A Python test committed outside tests/ would silently skip CI."""
        outside = [p for p in python_test_files(REPO_ROOT) if not p.startswith("tests/")]
        self.assertEqual(
            outside,
            [],
            "committed Python test file(s) %s lie outside the `python3 -m "
            "unittest discover -s tests` scope; move them under tests/ or "
            "extend the workflow so they run in the required `test` job"
            % sorted(outside),
        )


if __name__ == "__main__":
    unittest.main()
