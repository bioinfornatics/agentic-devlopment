#!/usr/bin/env python3
"""Regression tests for structured recipe/agent/skill metadata validation."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RecipeMetadataValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for relative in (
            "scripts/check-recipe-metadata.py",
            ".specs/harness/recipe-workflow-metadata.json",
            ".specs/schemas/recipe-workflow-metadata.schema.json",
        ):
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        for relative in (".goose/recipes", ".agents/agents", ".agents/skills"):
            shutil.copytree(ROOT / relative, self.root / relative)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_validator(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", "scripts/check-recipe-metadata.py"],
            cwd=self.root,
            text=True,
            capture_output=True,
            check=False,
        )

    def mutate_metadata(self, mutation) -> subprocess.CompletedProcess[str]:
        path = self.root / ".specs/harness/recipe-workflow-metadata.json"
        data = json.loads(path.read_text())
        mutation(data)
        path.write_text(json.dumps(data))
        return self.run_validator()

    def assert_rejected(self, result: subprocess.CompletedProcess[str], message: str) -> None:
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stdout)

    def test_active_contract_passes(self) -> None:
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_missing_agent_is_rejected(self) -> None:
        result = self.mutate_metadata(
            lambda data: data["agents"].pop("repository-researcher")
        )
        self.assert_rejected(result, "metadata agents")

    def test_missing_skill_is_rejected(self) -> None:
        result = self.mutate_metadata(
            lambda data: data["recipes"]["implement"]["controller_skills"][0].update(
                skill="missing-skill"
            )
        )
        self.assert_rejected(result, "unknown skill")

    def test_skill_path_reference_is_rejected(self) -> None:
        result = self.mutate_metadata(
            lambda data: data["recipes"]["implement"]["controller_skills"][0].update(
                skill=".agents/skills/task-framing"
            )
        )
        self.assert_rejected(result, "name-only")

    def test_missing_skills_extension_is_rejected(self) -> None:
        path = self.root / ".goose/recipes/implement.yaml"
        extension = "  - type: platform\n    name: skills\n"
        text = path.read_text()
        self.assertIn(extension, text)
        path.write_text(text.replace(extension, "", 1))
        self.assert_rejected(
            self.run_validator(), "missing required skills platform extension"
        )


if __name__ == "__main__":
    unittest.main()
