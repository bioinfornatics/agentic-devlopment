#!/usr/bin/env python3
"""Contract tests for get_efficiency_summary().

Acceptance criteria:
- EFF-SUM-01: None and empty input return a stable zero-valued summary.
- EFF-SUM-02: Numeric metrics are averaged independently; missing/None values are ignored.
- EFF-SUM-03: Zero and upper-bound percentage values remain valid observations.
- EFF-SUM-04: Invalid containers, records, and metric values fail explicitly.
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from types import ModuleType
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "analyze-skill-eval-results.py"

SCALAR_METRICS = (
    "budget_used_pct",
    "tool_calls_total",
    "failed_tool_calls",
    "recovery_attempts",
    "repeated_commands_count",
    "files_changed_count",
    "validation_count",
    "tool_calls_per_file_changed",
    "turns_to_first_write",
    "explore_pct",
)


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("analyze_skill_eval_results", SCRIPT)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GetEfficiencySummaryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_script()
        cls.get_efficiency_summary = staticmethod(cls.module.get_efficiency_summary)

    def test_none_and_empty_input_return_zero_summary(self) -> None:
        # EFF-SUM-01
        expected: dict[str, int | float] = {"run_count": 0}
        expected.update(dict.fromkeys(SCALAR_METRICS, 0))

        self.assertEqual(self.get_efficiency_summary(None), expected)
        self.assertEqual(self.get_efficiency_summary([]), expected)

    def test_averages_each_available_numeric_metric_and_ignores_nulls(self) -> None:
        # EFF-SUM-02
        runs: list[dict[str, Any]] = [
            {"budget_used_pct": 0.25, "tool_calls_total": 4, "failed_tool_calls": 1,
             "turns_to_first_write": None, "explore_pct": 0.50},
            {"budget_used_pct": 0.75, "tool_calls_total": 8, "failed_tool_calls": 0,
             "turns_to_first_write": 3, "explore_pct": None},
            {"tool_calls_total": 12, "failed_tool_calls": None, "turns_to_first_write": 5},
        ]

        summary = self.get_efficiency_summary(runs)

        self.assertEqual(summary["run_count"], 3)
        self.assertAlmostEqual(summary["budget_used_pct"], 0.50)
        self.assertAlmostEqual(summary["tool_calls_total"], 8.0)
        self.assertAlmostEqual(summary["failed_tool_calls"], 0.5)
        self.assertAlmostEqual(summary["turns_to_first_write"], 4.0)
        self.assertAlmostEqual(summary["explore_pct"], 0.50)
        self.assertEqual(summary["validation_count"], 0)

    def test_every_metric_uses_its_own_non_null_denominator(self) -> None:
        # EFF-SUM-02: missing values for one metric must not dilute another.
        first = {metric: index + 1 for index, metric in enumerate(SCALAR_METRICS)}
        second = {
            metric: index + 3
            for index, metric in enumerate(SCALAR_METRICS)
            if index % 2 == 0
        }
        third = {
            metric: index + 5 if index % 2 else None
            for index, metric in enumerate(SCALAR_METRICS)
        }

        summary = self.get_efficiency_summary([first, second, third])

        self.assertEqual(summary["run_count"], 3)
        for index, metric in enumerate(SCALAR_METRICS):
            expected = index + 2 if index % 2 == 0 else index + 3
            with self.subTest(metric=metric):
                self.assertAlmostEqual(summary[metric], expected)

    def test_zero_and_full_budget_values_are_included_in_average(self) -> None:
        # EFF-SUM-03: zero is data, not a missing value.
        summary = self.get_efficiency_summary([
            {"budget_used_pct": 0.0, "explore_pct": 0.0},
            {"budget_used_pct": 1.0, "explore_pct": 1.0},
        ])

        self.assertEqual(summary["run_count"], 2)
        self.assertAlmostEqual(summary["budget_used_pct"], 0.5)
        self.assertAlmostEqual(summary["explore_pct"], 0.5)

    def test_rejects_non_collection_top_level_input(self) -> None:
        # EFF-SUM-04
        for invalid in (0, "runs", {}):
            with self.subTest(invalid=invalid):
                with self.assertRaises(TypeError):
                    self.get_efficiency_summary(invalid)

    def test_rejects_non_mapping_run_records(self) -> None:
        # EFF-SUM-04
        with self.assertRaises(TypeError):
            self.get_efficiency_summary([{"tool_calls_total": 1}, None])

    def test_rejects_boolean_and_non_numeric_metric_values(self) -> None:
        # EFF-SUM-04: bool is deliberately excluded even though it subclasses int.
        for invalid in (True, "12", object()):
            with self.subTest(invalid=invalid):
                with self.assertRaises(TypeError):
                    self.get_efficiency_summary([{"tool_calls_total": invalid}])


class EfficiencyRecommendationsTest(unittest.TestCase):
    """Boundary contract for efficiency_recommendations()."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_script()

    def recommendations(self, **overrides: Any) -> list[dict[str, Any]]:
        efficiency: dict[str, Any] = {
            "tool_calls_total": 100,
            "failed_tool_calls": 0,
            "recovery_attempts": 0,
            "repeated_commands_count": 0,
            "tool_calls_per_file_changed": 0.0,
            "files_changed_count": 0,
            "explore_pct": 0.0,
            "budget_used_pct": 0.0,
            "turns_to_first_write": None,
        }
        efficiency.update(overrides)
        return self.module.efficiency_recommendations(
            "sdd", 7, "with_skill", efficiency
        )

    def signals(self, **overrides: Any) -> list[str]:
        return [item["signal"] for item in self.recommendations(**overrides)]

    def test_error_rate_triggers_at_ten_percent_not_below(self) -> None:
        # EFF-REC-01
        self.assertNotIn("error_rate_high", self.signals(failed_tool_calls=9))
        self.assertIn("error_rate_high", self.signals(failed_tool_calls=10))

    def test_exploration_triggers_at_fifty_percent_not_below(self) -> None:
        # EFF-REC-02
        self.assertNotIn("over_exploration", self.signals(explore_pct=0.499))
        self.assertIn("over_exploration", self.signals(explore_pct=0.50))

    def test_command_thrashing_starts_at_three_repeated_commands(self) -> None:
        # EFF-REC-03: the signal describes commands repeated 3+ times.
        self.assertNotIn(
            "command_thrashing", self.signals(repeated_commands_count=2)
        )
        self.assertIn(
            "command_thrashing", self.signals(repeated_commands_count=3)
        )

    def test_low_yield_triggers_at_twenty_five_calls_and_requires_a_changed_file(self) -> None:
        # EFFREC-01, EFFREC-02: the named high threshold is inclusive.
        self.assertNotIn(
            "low_implementation_yield",
            self.signals(tool_calls_per_file_changed=24.99, files_changed_count=1),
        )
        self.assertIn(
            "low_implementation_yield",
            self.signals(tool_calls_per_file_changed=25.0, files_changed_count=1),
        )
        self.assertNotIn(
            "low_implementation_yield",
            self.signals(tool_calls_per_file_changed=30.0, files_changed_count=0),
        )

    def test_delayed_write_requires_sixty_percent_and_half_budget(self) -> None:
        # EFF-REC-05: exercise both independent thresholds.
        self.assertNotIn(
            "delayed_first_write",
            self.signals(turns_to_first_write=59, budget_used_pct=0.50),
        )
        self.assertIn(
            "delayed_first_write",
            self.signals(turns_to_first_write=60, budget_used_pct=0.50),
        )
        self.assertNotIn(
            "delayed_first_write",
            self.signals(turns_to_first_write=60, budget_used_pct=0.499),
        )
        self.assertNotIn(
            "delayed_first_write",
            self.signals(turns_to_first_write=None, budget_used_pct=1.0),
        )

    def test_combined_signals_keep_context_and_severity_order(self) -> None:
        # EFF-REC-06
        recommendations = self.recommendations(
            failed_tool_calls=10,
            explore_pct=0.50,
            repeated_commands_count=3,
            tool_calls_per_file_changed=26.0,
            files_changed_count=1,
            turns_to_first_write=60,
            budget_used_pct=0.50,
        )

        self.assertEqual(
            [item["signal"] for item in recommendations],
            [
                "error_rate_high",
                "over_exploration",
                "command_thrashing",
                "low_implementation_yield",
                "delayed_first_write",
            ],
        )
        self.assertEqual(
            [item["severity"] for item in recommendations],
            ["high", "medium", "medium", "medium", "low"],
        )
        for item in recommendations:
            self.assertEqual(item["recommendation_type"], "efficiency")
            self.assertEqual(item["subject"], "sdd")
            self.assertEqual(item["eval_id"], 7)
            self.assertEqual(item["configuration"], "with_skill")
            self.assertTrue(item["message"])
            self.assertTrue(item["evidence"])
            self.assertTrue(item["action"])


    def test_combined_signals_match_complete_payloads(self) -> None:
        # EFFREC-03, EFFREC-04: refactoring must preserve exact public output.
        self.assertEqual(
            self.recommendations(
                failed_tool_calls=10,
                explore_pct=0.50,
                repeated_commands_count=3,
                tool_calls_per_file_changed=26.0,
                files_changed_count=1,
                turns_to_first_write=60,
                budget_used_pct=0.50,
            ),
            [
                {
                    "recommendation_type": "efficiency",
                    "subject": "sdd",
                    "eval_id": 7,
                    "configuration": "with_skill",
                    "severity": "high",
                    "signal": "error_rate_high",
                    "message": "Error rate 10% (10/100 tool calls failed).",
                    "evidence": "failed_tool_calls=10 tool_calls_total=100 recovery_attempts=0",
                    "action": "Inspect a failed command's error, try one alternative, then report the blocker.",
                },
                {
                    "recommendation_type": "efficiency",
                    "subject": "sdd",
                    "eval_id": 7,
                    "configuration": "with_skill",
                    "severity": "medium",
                    "signal": "over_exploration",
                    "message": "Over-exploration: 50% of tool calls were file reads.",
                    "evidence": "explore_pct=50% phase_breakdown={}",
                    "action": "Constrain initial reads and state a scoped plan before exploring further.",
                },
                {
                    "recommendation_type": "efficiency",
                    "subject": "sdd",
                    "eval_id": 7,
                    "configuration": "with_skill",
                    "severity": "medium",
                    "signal": "command_thrashing",
                    "message": "Command thrashing: 3 commands were repeated 3+ times.",
                    "evidence": "repeated_commands_count=3",
                    "action": "After two identical results, change approach or report the blocker.",
                },
                {
                    "recommendation_type": "efficiency",
                    "subject": "sdd",
                    "eval_id": 7,
                    "configuration": "with_skill",
                    "severity": "medium",
                    "signal": "low_implementation_yield",
                    "message": "Low implementation yield: 26 tool calls per file changed.",
                    "evidence": "tool_calls_per_file_changed=26 files_changed=1",
                    "action": "Name the files to change, make the scoped edit, validate, and stop.",
                },
                {
                    "recommendation_type": "efficiency",
                    "subject": "sdd",
                    "eval_id": 7,
                    "configuration": "with_skill",
                    "severity": "low",
                    "signal": "delayed_first_write",
                    "message": "Slow to act: first file write at tool call 60.",
                    "evidence": "turns_to_first_write=60 tool_calls_total=100 budget_used_pct=50%",
                    "action": "Limit pre-write reads and emit a scoped plan early.",
                },
            ],
        )


class AnalyzeEfficiencyTest(unittest.TestCase):
    """[EFF-01..05] Contract tests for transcript efficiency analysis."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.analyze = staticmethod(load_script().analyze_efficiency)

    def test_empty_inputs_return_stable_zero_analysis(self) -> None:
        # [EFF-04]
        self.assertEqual(self.analyze([], {}, [], None, None), {
            "budget_used_pct": None,
            "tool_calls_total": 0,
            "failed_tool_calls": 0,
            "recovery_attempts": 0,
            "repeated_commands_count": 0,
            "repeated_commands_top": [],
            "files_changed_count": 0,
            "validation_count": 0,
            "tool_calls_per_file_changed": None,
            "turns_to_first_write": None,
            "explore_pct": 0.0,
            "phase_breakdown": {},
        })

    def test_classifies_tool_requests_and_ignores_non_requests(self) -> None:
        # [EFF-01]
        classifications = [
            "inspection", "beads_read", "beads_write", "file_write",
            "validation", "browser_action", "delegation", "handoff",
            "planning", "unrecognized",
        ]
        timeline = [
            {"type": "tool_request", "classification": classification}
            for classification in classifications
        ] + [{"type": "assistant", "classification": "inspection"}]

        result = self.analyze(timeline, {}, [], 5, 20)

        self.assertEqual(result["tool_calls_total"], 10)
        self.assertEqual(result["phase_breakdown"], {
            "beads": 2,
            "explore": 1,
            "implement": 1,
            "validate": 1,
            "browser": 1,
            "delegate": 1,
            "handoff": 1,
            "plan": 1,
            "other": 1,
        })
        self.assertEqual(result["turns_to_first_write"], 4)
        self.assertEqual(result["budget_used_pct"], 0.25)
        self.assertEqual(result["explore_pct"], 0.1)

    def test_detects_failed_results_and_only_next_request_as_recovery(self) -> None:
        # [EFF-02]
        events = [{"message": {"content": [
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": {"exit_code": 2}}}},
            {"type": "toolRequest"},
            {"type": "toolRequest"},
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": {"exit_code": "0"}}}},
            {"type": "toolResponse", "toolResult": {"value": {
                "exit_code": 1}}},
            {"type": "toolRequest"},
        ]}}]

        result = self.analyze([], {}, events, None, None)

        self.assertEqual(result["failed_tool_calls"], 2)
        self.assertEqual(result["recovery_attempts"], 2)

    def test_ignores_benign_error_text_and_malformed_events(self) -> None:
        # [EFF-02, EFF-04]
        events: list[Any] = [
            None,
            {"message": "error: documentation example"},
            {"message": {"content": "not-a-list"}},
            {"message": {"content": [
                "error",
                {"type": "toolResponse", "toolResult": None},
                {"type": "toolResponse", "toolResult": {"value": {
                    "structuredContent": {"exit_code": 0}}}},
                {"type": "toolResponse", "toolResult": {"value": {
                    "exit_code": "not-an-integer"}}},
            ]}},
        ]
        self.assertEqual(
            self.analyze([], {}, events, None, 10)["failed_tool_calls"], 0
        )

    def test_explicit_error_envelopes_are_failures_without_exit_codes(self) -> None:
        # [EFF-02] Exercise the common direct and nested error markers.
        responses = [
            {"type": "toolResponse", "isError": True,
             "toolResult": {"value": {}}},
            {"type": "toolResponse",
             "toolResult": {"isError": True, "value": {}}},
            {"type": "toolResponse",
             "toolResult": {"value": {"status": "failure"}}},
            {"type": "toolResponse",
             "toolResult": {"value": {"status": "ok"}}},
        ]

        result = self.analyze(
            [], {}, [{"message": {"content": responses}}], None, None
        )

        self.assertEqual(result["failed_tool_calls"], 3)

    def test_first_write_uses_tool_request_position_not_timeline_position(self) -> None:
        # [EFF-01, EFF-04] Malformed and assistant events do not add latency.
        timeline = [
            None,
            "malformed",
            {"type": "assistant", "classification": "file_write"},
            {"type": "tool_request", "classification": "inspection"},
            {"type": "tool_request", "classification": "file_write"},
        ]

        self.assertEqual(
            self.analyze(timeline, {}, [], None, None)["turns_to_first_write"],
            2,
        )

    def test_malformed_budget_values_are_ignored(self) -> None:
        # [EFF-04] bool is deliberately invalid even though it subclasses int.
        for turns, maximum in (
            ("bad", 20),
            (2, "20"),
            (True, 20),
            (2, False),
            (2, 0),
        ):
            with self.subTest(turns=turns, maximum=maximum):
                self.assertIsNone(
                    self.analyze([], {}, [], turns, maximum)["budget_used_pct"]
                )

    def test_normalizes_commands_and_reports_only_three_or_more(self) -> None:
        # [EFF-03]
        long_command = "python " + "x" * 140
        audit = {
            "commands": [
                "  pytest   -q ", "pytest -q", "pytest	-q",
                "git status", "git status",
                long_command, long_command, long_command, long_command,
                42,
            ],
            "files_changed": ["a.py", "b.py"],
            "validations": ["pytest"],
        }

        result = self.analyze(
            [{"type": "tool_request", "classification": "validation"}] * 5,
            audit, [], 0, 0,
        )

        self.assertEqual(result["repeated_commands_count"], 2)
        self.assertEqual(result["repeated_commands_top"][0], {
            "cmd": long_command[:120], "n": 4,
        })
        self.assertEqual(result["repeated_commands_top"][1], {
            "cmd": "pytest -q", "n": 3,
        })
        self.assertEqual(result["files_changed_count"], 2)
        self.assertEqual(result["validation_count"], 1)
        self.assertEqual(result["tool_calls_per_file_changed"], 2.5)
        self.assertIsNone(result["budget_used_pct"])

    def test_tolerates_non_collection_audit_fields_and_timeline_items(self) -> None:
        # [EFF-04]
        result = self.analyze(
            [None, "bad", {"type": "tool_request"}],
            {"commands": "pytest", "files_changed": None, "validations": 3},
            [], None, None,
        )
        self.assertEqual(result["tool_calls_total"], 1)
        self.assertEqual(result["phase_breakdown"], {"other": 1})
        self.assertEqual(result["repeated_commands_top"], [])
        self.assertEqual(result["files_changed_count"], 0)
        self.assertEqual(result["validation_count"], 0)


if __name__ == "__main__":
    unittest.main()
