"""The Managed Agents editor, driven offline against a fake client."""

import datetime as dt
import io
import json
import sys
import tarfile
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inish_daily import editor_agent  # noqa: E402

DAY = dt.date(2026, 10, 12)


def make_repo(root: Path) -> None:
    files = {
        "automation/HERMES_DAILY.md": "# standard",
        "inish_daily/build_daily.py": "print('build')",
        "inish_daily/sources.json": "{}",
        "data/editions/2026-10-11.json": "{}",
        "data/editions/2026-10-12.json": '{"stale": true}',
        "data/candidates/2026-10-12.json": '{"candidate_count": 3}',
        "data/candidates/2026-10-11.json": "{}",
        "public/daily/styles.css": "",
        "public/daily/favicon.svg": "",
        "worker.js": "",
    }
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def names(blob: bytes) -> set[str]:
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        return set(tar.getnames())


class FakeStream:
    def __init__(self, events):
        self.events = events

    def __enter__(self):
        return iter(self.events)

    def __exit__(self, *exc):
        return False


class AuthenticationError(Exception):
    pass


class PermissionDeniedError(Exception):
    pass


class BadRequestError(Exception):
    pass


class FakeClient:
    """Just enough of the SDK surface the editor calls. `runs` holds one event
    list per session, in the order sessions are created."""

    def __init__(self, runs, outputs=None, existing_agent=None, cost="74", broken=None):
        self.runs = list(runs)
        self.outputs = OUTPUTS if outputs is None else outputs
        self.sent = []
        self.created_agents = []
        self.updated_agents = []
        self.deleted_files = []
        self.sessions = []
        agents = [existing_agent] if existing_agent else []

        def environments():
            if broken:
                raise broken
            return [NS(id="env_old", name="other", archived_at=None),
                    NS(id="env_1", name=editor_agent.ENVIRONMENT_NAME, archived_at=None)]

        def create_agent(**kw):
            self.created_agents.append(kw)
            return NS(id=f"agent:{kw['model']['id']}")

        self.beta = NS(
            environments=NS(list=environments, create=lambda **kw: self.fail("environment should be reused")),
            agents=NS(
                list=lambda: agents,
                create=create_agent,
                update=lambda agent_id, **kw: self.updated_agents.append(kw) or NS(id=agent_id),
            ),
            sessions=NS(
                create=self.create_session,
                retrieve=lambda sid: NS(usage=NS(list_cost=NS(amount=cost, currency="USD"))),
                events=NS(
                    stream=lambda sid: FakeStream(self.runs.pop(0)),
                    send=lambda sid, events: self.sent.extend(events),
                ),
            ),
            files=NS(list=lambda scope_id, betas: self.outputs),
        )
        self.files = NS(
            upload=lambda file: NS(id="file_up"),
            download=lambda fid: NS(read=lambda: json.dumps(
                {"date": "2026-10-12", "candidate_count": 3, "editor_note": "x", "stories": []}).encode()),
            delete=lambda fid: self.deleted_files.append(fid),
        )

    def fail(self, message):
        raise AssertionError(message)

    def create_session(self, **kwargs):
        self.sessions.append(kwargs)
        return NS(id=f"sesn_{len(self.sessions)}",
                  resources=[NS(mount_path="/mnt/session/uploads/the-daily-2026-10-12.tar.gz")])

    def models_run(self):
        return [s["agent"].split(":", 1)[1] for s in self.sessions]


def text_event(text):
    return NS(type="agent.message", content=[NS(type="text", text=text)])


DONE = [
    NS(type="agent.tool_use", name="bash", id="sevt_1", evaluated_permission="allow"),
    NS(type="agent.tool_use", name="web_fetch", id="sevt_2", evaluated_permission="ask"),
    NS(type="session.status_idle", stop_reason=NS(type="requires_action")),
    text_event("Kept 0 stories."),
    NS(type="session.status_idle", stop_reason=NS(type="end_turn")),
]
FAILED = [NS(type="session.status_idle", stop_reason=NS(type="retries_exhausted"))]
BUDGET = [NS(type="session.status_idle", stop_reason=NS(type="budget_reached"))]
OUTPUTS = [NS(id="file_out", filename="edition.json")]
SONNET, OPUS = editor_agent.MODELS


class EditorAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        make_repo(self.root)
        patcher = mock.patch.object(editor_agent, "ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def run_with(self, *clients):
        """One fake client per key, in key order."""
        by_key = {f"key-{n}": client for n, client in enumerate(clients, 1)}
        used = []
        fake_sdk = types.ModuleType("anthropic")
        fake_sdk.Anthropic = lambda api_key: used.append(api_key) or by_key[api_key]
        fake_sdk.AuthenticationError = AuthenticationError
        fake_sdk.PermissionDeniedError = PermissionDeniedError
        fake_sdk.BadRequestError = BadRequestError
        self.keys_used = used
        with mock.patch.dict(sys.modules, {"anthropic": fake_sdk}), mock.patch("builtins.print"), \
                mock.patch.object(editor_agent.time, "sleep"):
            return editor_agent.write_edition(DAY, keys=list(by_key))

    def stale_draft_untouched(self):
        return (self.root / "data/editions/2026-10-12.json").read_text() == '{"stale": true}'

    def test_bundle_holds_the_standard_builder_and_todays_pool_only(self):
        got = names(editor_agent.bundle(DAY))
        self.assertIn("automation/HERMES_DAILY.md", got)
        self.assertIn("inish_daily/build_daily.py", got)
        self.assertIn("data/candidates/2026-10-12.json", got)
        self.assertIn("data/editions/2026-10-11.json", got)
        self.assertNotIn("data/editions/2026-10-12.json", got)  # no stale draft
        self.assertNotIn("data/candidates/2026-10-11.json", got)
        self.assertNotIn("worker.js", got)

    def test_bundle_needs_the_pool(self):
        (self.root / "data/candidates/2026-10-12.json").unlink()
        with self.assertRaises(FileNotFoundError):
            editor_agent.bundle(DAY)

    def test_parse_edition_rejects_the_wrong_day(self):
        with self.assertRaises(ValueError):
            editor_agent.parse_edition(b'{"date": "2026-10-11"}', DAY)
        with self.assertRaises(ValueError):
            editor_agent.parse_edition(b"[]", DAY)

    def test_keys_come_from_the_environment_in_order(self):
        env = {"ANTHROPIC_API_KEY_3": "c", "ANTHROPIC_API_KEY": "a", "ANTHROPIC_API_KEY_2": " ", "ANTHROPIC_API_KEY_4": "a"}
        self.assertEqual(editor_agent.api_keys(env), ["a", "c"])
        self.assertEqual(editor_agent.api_keys({}), [])

    def test_each_model_has_its_own_agent_and_fingerprint(self):
        sonnet, opus = (editor_agent.agent_definition(m) for m in (SONNET, OPUS))
        self.assertNotEqual(sonnet["name"], opus["name"])
        self.assertEqual((sonnet["model"]["id"], opus["model"]["id"]), (SONNET, OPUS))
        self.assertEqual(editor_agent.fingerprint(sonnet), editor_agent.fingerprint(editor_agent.agent_definition(SONNET)))
        self.assertNotEqual(editor_agent.fingerprint(sonnet), editor_agent.fingerprint(dict(sonnet, system=sonnet["system"] + " ")))

    def test_a_run_writes_the_edition_and_cleans_up(self):
        client = FakeClient([DONE])
        path = self.run_with(client)
        self.assertEqual(json.loads(path.read_text())["date"], "2026-10-12")
        self.assertEqual(client.models_run(), [SONNET])
        self.assertEqual(client.deleted_files, ["file_up"])
        session = client.sessions[0]
        self.assertEqual(session["environment_id"], "env_1")
        self.assertEqual(session["budget"]["max_list_cost"],
                         {"amount": str(editor_agent.SESSION_BUDGET_CENTS), "currency": "USD"})
        kickoff = client.sent[0]
        self.assertEqual(kickoff["type"], "user.message")
        self.assertIn("tar -xzf /mnt/session/uploads/the-daily-2026-10-12.tar.gz", kickoff["content"][0]["text"])
        # The unattended run refuses a call that needs a human, and only that one.
        confirmations = [e for e in client.sent if e["type"] == "user.tool_confirmation"]
        self.assertEqual([(e["tool_use_id"], e["result"]) for e in confirmations], [("sevt_2", "deny")])

    def test_a_current_agent_is_reused_and_a_stale_one_updated(self):
        current = editor_agent.fingerprint(editor_agent.agent_definition(SONNET))
        agent = NS(id=f"agent:{SONNET}", name=editor_agent.agent_name(SONNET), archived_at=None, metadata={"config": current})
        client = FakeClient([DONE], existing_agent=agent)
        self.run_with(client)
        self.assertEqual((client.created_agents, client.updated_agents), ([], []))

        agent.metadata = {"config": "old"}
        client = FakeClient([DONE], existing_agent=agent)
        self.run_with(client)
        self.assertEqual(len(client.updated_agents), 1)

    def test_a_failed_run_falls_back_to_the_next_model_on_the_same_key(self):
        first, second = FakeClient([FAILED, DONE], cost="120"), FakeClient([])
        self.run_with(first, second)
        self.assertEqual(first.models_run(), [SONNET, OPUS])
        self.assertEqual(self.keys_used, ["key-1"])
        # The second session only gets what the first left of the total cap.
        self.assertEqual(first.sessions[1]["budget"]["max_list_cost"]["amount"],
                         str(min(editor_agent.SESSION_BUDGET_CENTS, editor_agent.TOTAL_BUDGET_CENTS - 120)))

    def test_a_refused_key_hands_over_to_the_next_key(self):
        for error in (AuthenticationError("bad key"), PermissionDeniedError("no"),
                      BadRequestError("Your credit balance is too low to access the Anthropic API")):
            refused, good = FakeClient([], broken=error), FakeClient([DONE])
            self.run_with(refused, good)
            self.assertEqual(self.keys_used, ["key-1", "key-2"])
            self.assertEqual(refused.models_run(), [])  # its other model is not tried
            self.assertEqual(good.models_run(), [SONNET])

    def test_every_key_and_model_failing_is_an_error_and_writes_nothing(self):
        first, second = FakeClient([FAILED, FAILED], cost="10"), FakeClient([FAILED, FAILED], cost="10")
        with self.assertRaises(RuntimeError):
            self.run_with(first, second)
        self.assertEqual((first.models_run(), second.models_run()), ([SONNET, OPUS], [SONNET, OPUS]))
        self.assertTrue(self.stale_draft_untouched())

    def test_the_total_cap_stops_further_attempts(self):
        first = FakeClient([FAILED, FAILED, FAILED], cost=str(editor_agent.TOTAL_BUDGET_CENTS))
        second = FakeClient([DONE])
        with self.assertRaises(RuntimeError):
            self.run_with(first, second)
        self.assertEqual(first.models_run(), [SONNET])
        self.assertEqual(self.keys_used, ["key-1"])
        self.assertEqual(second.models_run(), [])

    def test_a_spent_budget_stops_everything(self):
        first, second = FakeClient([BUDGET]), FakeClient([DONE])
        with self.assertRaises(editor_agent.BudgetReached):
            self.run_with(first, second)
        self.assertEqual((first.models_run(), self.keys_used), ([SONNET], ["key-1"]))
        self.assertEqual(first.deleted_files, ["file_up"])
        self.assertTrue(self.stale_draft_untouched())

    def test_a_missing_deliverable_falls_back(self):
        client = FakeClient([DONE, DONE], outputs=[])
        with self.assertRaises(RuntimeError):
            self.run_with(client)
        self.assertEqual(client.models_run(), [SONNET, OPUS])

    def test_no_key_is_an_error(self):
        with self.assertRaises(RuntimeError):
            self.run_with()


if __name__ == "__main__":
    unittest.main()
