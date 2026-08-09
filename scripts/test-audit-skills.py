from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().with_name("audit-skills.py")
PYTHON_LAUNCHER = Path(__file__).resolve().with_name("run-python.mjs")
REPO_ROOT = Path(__file__).resolve().parents[1]

AUDIT_FILES = [
    "skills-audit.json",
    "skills-registry.json",
    "skills-dashboard.html",
    "SKILLS_AUDIT.md",
    "ROUTING_SOURCE.md",
]


def base_env(tmp: Path, skills_root: Path, out_root: Path, codex_home: Path | None = None) -> dict:
    env = os.environ.copy()
    env["MSSR_PROJECT_ROOT"] = str(REPO_ROOT)
    env["CODEX_HOME"] = str(codex_home or (tmp / "codex"))
    env["MSSR_SCRIPTS"] = str(SCRIPT.parent)
    env["MAUROPRIME_SKILL_REPO_ROOT"] = str(skills_root)
    env["MSSR_SKILL_DASHBOARD_ROOT"] = str(out_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def run_script(env: dict, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        env=env,
    )


class AuditSkillsTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmpdir.name)
        self.skills_root = self.tmp / "skills"
        self.skills_root.mkdir(parents=True, exist_ok=True)
        self.out_root = self.tmp / "out"
        self.codex_home = self.tmp / "codex"

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def test_check_mode_is_read_only_and_succeeds(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertEqual(data["mode"], "check")
        self.assertTrue(data["ok"])
        self.assertEqual(data["problems"], [])
        self.assertFalse(self.out_root.exists(), "dashboard mode must not create the output root")

    def test_check_mode_fails_on_missing_routing(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        env["MSSR_SKILL_ROUTING_PATH"] = str(self.tmp / "missing-routing.json")
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertTrue(data["problems"])

    def _write_routing(self, payload: dict, filename: str = "routing.json") -> str:
        path = self.tmp / filename
        path.write_text(json.dumps(payload), encoding="utf-8")
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        env["MSSR_SKILL_ROUTING_PATH"] = str(path)
        return env

    def test_check_mode_validates_valid_overrides(self) -> None:
        payload = {
            "schemaVersion": 1,
            "skills": {
                "sample-skill": {
                    "phase": "discovery",
                    "domains": ["coding"],
                    "actions": ["analyze"],
                    "activation": "on-demand",
                }
            },
            "workflows": [
                {
                    "name": "sample",
                    "match": {"domains": ["coding"]},
                    "phases": [
                        {"phase": "discovery", "skills": ["sample-skill"], "required": True}
                    ],
                }
            ],
        }
        env = self._write_routing(payload)
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["schemaViolations"], [])

    def test_check_mode_fails_on_schema_version_violation(self) -> None:
        env = self._write_routing({"schemaVersion": 2, "skills": {}, "workflows": []})
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertTrue(any("schemaVersion" in item for item in data["schemaViolations"]))

    def test_check_mode_fails_on_unknown_property_violation(self) -> None:
        env = self._write_routing({
            "schemaVersion": 1,
            "skills": {"x": {"phase": "discovery", "notARealKey": True}},
            "workflows": [],
        })
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertTrue(any("notARealKey" in item for item in data["schemaViolations"]))

    def test_check_mode_accepts_declared_schema_annotation_only(self) -> None:
        valid_env = self._write_routing({
            "$schema": "./skill-routing.schema.json",
            "schemaVersion": 1,
            "skills": {},
            "workflows": [],
        }, "routing-with-schema.json")
        valid = run_script(valid_env, "--check")
        self.assertEqual(valid.returncode, 0, valid.stderr)

        invalid_env = self._write_routing({
            "$schema": "./skill-routing.schema.json",
            "$unexpected": True,
            "schemaVersion": 1,
            "skills": {},
            "workflows": [],
        }, "routing-with-unknown-dollar-key.json")
        invalid = run_script(invalid_env, "--check")
        self.assertEqual(invalid.returncode, 1, invalid.stderr)
        data = json.loads(invalid.stdout)
        self.assertTrue(any("$unexpected" in item for item in data["schemaViolations"]))

    def test_check_mode_fails_on_invalid_enum_violation(self) -> None:
        env = self._write_routing({
            "schemaVersion": 1,
            "skills": {"x": {"phase": "bogus", "activation": "on-demand"}},
            "workflows": [],
        })
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertTrue(any("/skills/x/phase" in item and "allowed" in item for item in data["schemaViolations"]))

    def test_check_mode_fails_on_priority_bound_violation(self) -> None:
        env = self._write_routing({
            "schemaVersion": 1,
            "skills": {"x": {"phase": "discovery", "priority": 999}},
            "workflows": [],
        })
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertFalse(data["ok"])
        self.assertTrue(any("/skills/x/priority" in item and "<= 100" in item for item in data["schemaViolations"]))

    def test_check_mode_fails_on_missing_schema(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        env["MSSR_PROJECT_ROOT"] = str(self.tmp / "project-without-schema")
        env["MSSR_SKILL_ROUTING_PATH"] = str(REPO_ROOT / "config" / "skill-routing" / "skill-routing-overrides.json")
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(any("Missing routing schema" in item for item in data["problems"]))

    def test_check_mode_fails_when_schema_itself_is_invalid(self) -> None:
        project = self.tmp / "invalid-schema-project"
        routing_root = project / "config" / "skill-routing"
        routing_root.mkdir(parents=True)
        (routing_root / "skill-routing.schema.json").write_text(
            json.dumps({"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "not-a-json-schema-type"}),
            encoding="utf-8",
        )
        routing = routing_root / "skill-routing-overrides.json"
        routing.write_text(json.dumps({"schemaVersion": 1, "skills": {}, "workflows": []}), encoding="utf-8")
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        env["MSSR_PROJECT_ROOT"] = str(project)
        env["MSSR_SKILL_ROUTING_PATH"] = str(routing)
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(any("schema" in item.lower() for item in data["schemaViolations"]))

    def test_python_launcher_honors_explicit_interpreter_and_arguments(self) -> None:
        probe = self.tmp / "python-probe.py"
        probe.write_text("import sys; print(sys.argv[1])\n", encoding="utf-8")
        env = os.environ.copy()
        env["MSSR_PYTHON"] = sys.executable
        proc = subprocess.run(
            ["node", str(PYTHON_LAUNCHER), str(probe), "portable-ok"],
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.strip(), "portable-ok")

    def test_check_mode_fails_on_skill_contract_warning(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        skill = self.skills_root / "broken-skill"
        skill.mkdir()
        (skill / "SKILL.md").write_text("# missing frontmatter\n", encoding="utf-8")
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 1, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(data["warnings"])
        self.assertTrue(data["blockingWarnings"])
        self.assertTrue(any("Skill contract warnings" in item for item in data["problems"]))

    def test_check_mode_keeps_length_warning_advisory(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        skill = self.skills_root / "long-skill"
        skill.mkdir()
        body = "---\nname: long-skill\ndescription: Valid but intentionally long fixture.\n---\n" + "line\n" * 501
        (skill / "SKILL.md").write_text(body, encoding="utf-8")
        proc = run_script(env, "--check")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(any(item["type"] == "length" for item in data["warnings"]))
        self.assertEqual(data["blockingWarnings"], [])

    def test_dashboard_mode_writes_into_configured_root(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        proc = run_script(env)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        for name in AUDIT_FILES:
            self.assertTrue((self.out_root / name).exists(), f"missing {name}")
        json.loads((self.out_root / "skills-audit.json").read_text(encoding="utf-8"))
        json.loads((self.out_root / "skills-registry.json").read_text(encoding="utf-8"))
        self.assertIn("<!doctype html>", (self.out_root / "skills-dashboard.html").read_text(encoding="utf-8"))

    def test_local_root_is_portable_and_configurable(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        snippet = (
            "import os, sys, importlib;"
            "sys.path.insert(0, os.environ['MSSR_SCRIPTS']);"
            "audit_skills = importlib.import_module('audit-skills');"
            "assert os.path.realpath(str(audit_skills.LOCAL_ROOT)) == os.path.realpath(os.environ['MAUROPRIME_SKILL_REPO_ROOT']);"
            "assert not os.path.exists(os.environ['MSSR_SKILL_DASHBOARD_ROOT']);"
        )
        proc = subprocess.run([sys.executable, "-c", snippet], capture_output=True, text=True, env=env)
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_local_root_defaults_to_portable_codex_skills(self) -> None:
        env = base_env(self.tmp, self.skills_root, self.out_root, self.codex_home)
        env.pop("MAUROPRIME_SKILL_REPO_ROOT")
        snippet = (
            "import os, sys, importlib;"
            "sys.path.insert(0, os.environ['MSSR_SCRIPTS']);"
            "audit_skills = importlib.import_module('audit-skills');"
            "expected = os.path.join(os.environ['CODEX_HOME'], 'skills');"
            "assert os.path.realpath(str(audit_skills.LOCAL_ROOT)) == os.path.realpath(expected), audit_skills.LOCAL_ROOT;"
        )
        proc = subprocess.run([sys.executable, "-c", snippet], capture_output=True, text=True, env=env)
        self.assertEqual(proc.returncode, 0, proc.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
