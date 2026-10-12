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


class FakeClient:
    """Just enough of the SDK surface the editor calls."""

    def __init__(self, events, outputs, existing_agent=None):
        self.sent = []
        self.created_agents = []
        self.updated_agents = []
        self.deleted_files = []
        self.session_kwargs = None
        agents = [existing_agent] if existing_agent else []
        self.beta = NS(
            environments=NS(
                list=lambda: [NS(id="env_old", name="other", archived_at=None),
                              NS(id="env_1", name=editor_agent.ENVIRONMENT_NAME, archived_at=None)],
                create=lambda **kw: self.fail("environment should be reused"),
            ),
            agents=NS(
                list=lambda: agents,
                create=lambda **kw: self.created_agents.append(kw) or NS(id="agent_new"),
                update=lambda agent_id, **kw: self.updated_agents.append(kw) or NS(id=agent_id),
            ),
            sessions=NS(
                create=self.create_session,
                retrieve=lambda sid: NS(usage=NS(list_cost=NS(amount="74", currency="USD"))),
                events=NS(
                    stream=lambda sid: FakeStream(events),
                    send=lambda sid, events: self.sent.extend(events),
                ),
            ),
            files=NS(list=lambda scope_id, betas: outputs),
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
        self.session_kwargs = kwargs
        return NS(id="sesn_1", resources=[NS(mount_path="/mnt/session/uploads/the-daily-2026-10-12.tar.gz")])


def text_event(text):
    return NS(type="agent.message", content=[NS(type="text", text=text)])


DONE = [
    NS(type="agent.tool_use", name="bash", id="sevt_1", evaluated_permission="allow"),
    NS(type="agent.tool_use", name="web_fetch", id="sevt_2", evaluated_permission="ask"),
    NS(type="session.status_idle", stop_reason=NS(type="requires_action")),
    text_event("Kept 0 stories."),
    NS(type="session.status_idle", stop_reason=NS(type="end_turn")),
]
OUTPUTS = [NS(id="file_out", filename="edition.json")]


class EditorAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        make_repo(self.root)
        patcher = mock.patch.object(editor_agent, "ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def run_with(self, client):
        fake_sdk = types.ModuleType("anthropic")
        fake_sdk.Anthropic = lambda: client
        with mock.patch.dict(sys.modules, {"anthropic": fake_sdk}), mock.patch("builtins.print"):
            return editor_agent.write_edition(DAY)

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

    def test_fingerprint_tracks_the_definition(self):
        definition = editor_agent.agent_definition()
        self.assertEqual(editor_agent.fingerprint(definition), editor_agent.fingerprint(editor_agent.agent_definition()))
        changed = dict(definition, system=definition["system"] + " ")
        self.assertNotEqual(editor_agent.fingerprint(definition), editor_agent.fingerprint(changed))
        self.assertEqual(definition["model"]["id"], "claude-sonnet-5-5")

    def test_a_run_writes_the_edition_and_cleans_up(self):
        client = FakeClient(DONE, OUTPUTS)
        path = self.run_with(client)
        self.assertEqual(path, self.root / "data/editions/2026-10-12.json")
        self.assertEqual(json.loads(path.read_text())["date"], "2026-10-12")
        self.assertEqual(client.deleted_files, ["file_up"])
        self.assertEqual(len(client.created_agents), 1)
        kwargs = client.session_kwargs
        self.assertEqual(kwargs["environment_id"], "env_1")
        self.assertEqual(kwargs["budget"]["max_list_cost"], {"amount": editor_agent.BUDGET_CENTS, "currency": "USD"})
        kickoff = client.sent[0]
        self.assertEqual(kickoff["type"], "user.message")
        self.assertIn("tar -xzf /mnt/session/uploads/the-daily-2026-10-12.tar.gz", kickoff["content"][0]["text"])
        # The unattended run refuses a call that needs a human, and only that one.
        confirmations = [e for e in client.sent if e["type"] == "user.tool_confirmation"]
        self.assertEqual([(e["tool_use_id"], e["result"]) for e in confirmations], [("sevt_2", "deny")])

    def test_a_current_agent_is_reused_and_a_stale_one_updated(self):
        current = editor_agent.fingerprint(editor_agent.agent_definition())
        agent = NS(id="agent_1", name=editor_agent.AGENT_NAME, archived_at=None, metadata={"config": current})
        client = FakeClient(DONE, OUTPUTS, existing_agent=agent)
        self.run_with(client)
        self.assertEqual((client.created_agents, client.updated_agents), ([], []))

        agent.metadata = {"config": "old"}
        client = FakeClient(DONE, OUTPUTS, existing_agent=agent)
        self.run_with(client)
        self.assertEqual(len(client.updated_agents), 1)

    def test_a_run_that_stops_early_fails_and_still_cleans_up(self):
        events = [NS(type="session.status_idle", stop_reason=NS(type="budget_reached"))]
        client = FakeClient(events, OUTPUTS)
        with self.assertRaises(RuntimeError):
            self.run_with(client)
        self.assertEqual(client.deleted_files, ["file_up"])
        self.assertEqual((self.root / "data/editions/2026-10-12.json").read_text(), '{"stale": true}')

    def test_a_missing_deliverable_fails(self):
        client = FakeClient(DONE, [])
        with mock.patch.object(editor_agent.time, "sleep"), self.assertRaises(FileNotFoundError):
            self.run_with(client)


if __name__ == "__main__":
    unittest.main()
