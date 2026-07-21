#!/usr/bin/env python3
"""Integration contracts for the committed harness evaluation corpus."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVALS = ROOT / "evals"
KINDS = ("skills", "agents", "recipes")
DIFFICULTIES = {"normal", "difficult", "very_difficult"}


class EvalCorpusIntegrationTest(unittest.TestCase):
    def eval_files(self, kind: str) -> list[Path]:
        files = sorted((EVALS / kind).glob("*.json"))
        self.assertTrue(files, f"evals/{kind} must contain JSON scenarios")
        return files

    def test_every_eval_file_is_valid_and_has_runnable_scenarios(self) -> None:
        for kind in KINDS:
            for path in self.eval_files(kind):
                with self.subTest(path=path.relative_to(ROOT)):
                    scenarios = json.loads(path.read_text(encoding="utf-8"))
                    self.assertIsInstance(scenarios, list)
                    self.assertGreaterEqual(len(scenarios), 1)
                    for index, scenario in enumerate(scenarios, 1):
                        label = f"{path}:{index}"
                        self.assertIsInstance(scenario, dict, label)
                        for key in ("query", "expected_skill_contribution"):
                            self.assertIsInstance(scenario.get(key), str, f"{label} {key}")
                            self.assertTrue(scenario[key].strip(), f"{label} {key}")
                        for key in ("expected_behavior", "baseline_gaps"):
                            self.assertIsInstance(scenario.get(key), list, f"{label} {key}")
                            self.assertTrue(scenario[key], f"{label} {key}")
                            self.assertTrue(all(isinstance(v, str) and v.strip() for v in scenario[key]), f"{label} {key}")
                        self.assertIn(scenario.get("difficulty"), DIFFICULTIES, label)
                        self.assertIsInstance(scenario.get("max_turns"), int, label)
                        self.assertGreater(scenario["max_turns"], 0, label)

    def test_layer_references_resolve_to_installed_harness_assets(self) -> None:
        asset_dirs = {"skills": ROOT / ".agents" / "skills", "agents": ROOT / ".agents" / "agents"}
        for kind in KINDS:
            for path in self.eval_files(kind):
                scenarios = json.loads(path.read_text(encoding="utf-8"))
                for index, scenario in enumerate(scenarios, 1):
                    for layer, asset_dir in asset_dirs.items():
                        refs = scenario.get(layer, [])
                        self.assertIsInstance(refs, list, f"{path}:{index} {layer}")
                        for ref in refs:
                            target = asset_dir / ref
                            exists = target.is_dir() if layer == "skills" else target.with_suffix(".md").is_file()
                            self.assertTrue(exists, f"{path}:{index} references missing {layer[:-1]} {ref!r}")
                    if kind == "agents":
                        self.assertIn("skills", scenario, f"{path}:{index}")
                    if kind == "recipes":
                        self.assertIn("skills", scenario, f"{path}:{index}")
                        self.assertIn("agents", scenario, f"{path}:{index}")

    def test_subject_names_are_stable_and_lowercase(self) -> None:
        for kind in KINDS:
            for path in self.eval_files(kind):
                with self.subTest(path=path.relative_to(ROOT)):
                    self.assertNotIn(" ", path.stem)
                    self.assertEqual(path.name, path.name.lower())


if __name__ == "__main__":
    unittest.main()
