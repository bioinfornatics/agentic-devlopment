#!/usr/bin/env python3
"""[EFF-01..05] Tests for skill-evaluation efficiency analysis."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).with_name("analyze-skill-eval-results.py")
spec = importlib.util.spec_from_file_location("efficiency_analysis", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AnalyzeEfficiencyTest(unittest.TestCase):
    def test_empty_and_invalid_top_level_inputs_are_stable(self) -> None:
        # [EFF-04]
        expected = {
            "budget_used_pct": None, "tool_calls_total": 0,
            "failed_tool_calls": 0, "recovery_attempts": 0,
            "repeated_commands_count": 0, "repeated_commands_top": [],
            "files_changed_count": 0, "validation_count": 0,
            "tool_calls_per_file_changed": None,
            "turns_to_first_write": None, "explore_pct": 0.0,
            "phase_breakdown": {},
        }
        self.assertEqual(module.analyze_efficiency([], {}, [], None, None), expected)
        self.assertEqual(module.analyze_efficiency("bad", None, "bad", None, 0), expected)

    def test_classifies_all_phases_unknowns_and_first_write(self) -> None:
        # [EFF-01]
        classes = ["inspection", "beads_read", "beads_write", "file_write",
                   "validation", "browser_action", "delegation", "handoff",
                   "planning", "unknown"]
        timeline: list[Any] = [None, "bad"] + [
            {"type": "tool_request", "classification": value} for value in classes
        ] + [{"type": "assistant", "classification": "inspection"}]
        result = module.analyze_efficiency(timeline, {}, [], 5, 20)
        self.assertEqual(result["tool_calls_total"], 10)
        self.assertEqual(result["phase_breakdown"], {
            "beads": 2, "explore": 1, "implement": 1, "validate": 1,
            "browser": 1, "delegate": 1, "handoff": 1, "plan": 1,
            "other": 1,
        })
        self.assertEqual(result["turns_to_first_write"], 4)
        self.assertEqual(result["budget_used_pct"], .25)
        self.assertEqual(result["explore_pct"], .1)

    def test_detects_nested_and_direct_exit_codes_and_recoveries(self) -> None:
        # [EFF-02]
        content: list[Any] = [
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": {"exit_code": 2}}}},
            {"type": "toolRequest"}, {"type": "toolRequest"},
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": {"exit_code": "0"}}}},
            {"type": "toolResponse", "toolResult": {"value": {"exit_code": 1}}},
            {"type": "toolRequest"},
            {"type": "ignored"}, "error",
        ]
        events: list[Any] = [None, {"message": "error text"},
                             {"message": {"content": "error text"}},
                             {"message": {"content": content}}]
        result = module.analyze_efficiency([], {}, events, None, None)
        self.assertEqual(result["failed_tool_calls"], 2)
        self.assertEqual(result["recovery_attempts"], 2)

    def test_ignores_malformed_and_successful_tool_results(self) -> None:
        # [EFF-02, EFF-04]
        malformed = [
            {"type": "toolResponse", "toolResult": None},
            {"type": "toolResponse", "toolResult": {"value": None}},
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": {"exit_code": 0}}}},
            {"type": "toolResponse", "toolResult": {"value": {
                "structuredContent": "bad", "exit_code": "0"}}},
        ]
        result = module.analyze_efficiency(
            [], {}, [{"message": {"content": malformed}}], None, None)
        self.assertEqual(result["failed_tool_calls"], 0)

    def test_normalizes_repeated_commands_and_audit_counts(self) -> None:
        # [EFF-03]
        long_cmd = "python " + "x" * 140
        commands: list[Any] = [" pytest   -q ", "pytest -q", "pytest	-q",
                               "git status", "git status", "  ", 42,
                               long_cmd, long_cmd, long_cmd, long_cmd]
        audit = {"commands": commands, "files_changed": ["a", "b"],
                 "validations": ["test"]}
        timeline = [{"type": "tool_request", "classification": "validation"}] * 5
        result = module.analyze_efficiency(timeline, audit, [], 0, 0)
        self.assertEqual(result["repeated_commands_count"], 2)
        self.assertEqual(result["repeated_commands_top"], [
            {"cmd": long_cmd[:120], "n": 4}, {"cmd": "pytest -q", "n": 3}])
        self.assertEqual(result["files_changed_count"], 2)
        self.assertEqual(result["validation_count"], 1)
        self.assertEqual(result["tool_calls_per_file_changed"], 2.5)
        self.assertIsNone(result["budget_used_pct"])

    def test_non_collection_audit_fields_are_ignored(self) -> None:
        # [EFF-04]
        result = module.analyze_efficiency(
            [{"type": "tool_request"}],
            {"commands": "x", "files_changed": None, "validations": 3},
            [], None, None)
        self.assertEqual(result["phase_breakdown"], {"other": 1})
        self.assertEqual(result["repeated_commands_top"], [])
        self.assertEqual(result["files_changed_count"], 0)

    def test_explicit_tool_error_markers_are_failures(self) -> None:
        # [EFF-02] Common response envelopes without an exit code still fail.
        responses = [
            {"type": "toolResponse", "isError": True, "toolResult": {"value": {}}},
            {"type": "toolResponse", "toolResult": {"isError": True, "value": {}}},
            {"type": "toolResponse", "toolResult": {"value": {"status": "failed"}}},
            {"type": "toolResponse", "toolResult": {"value": {"status": "ok"}}},
        ]
        result = module.analyze_efficiency(
            [], {}, [{"message": {"content": responses}}], None, None)
        self.assertEqual(result["failed_tool_calls"], 3)

    def test_explicit_errors_with_malformed_values_and_coalesced_recovery(self) -> None:
        # [EFF-02, EFF-04] Explicit errors do not require structured values,
        # and consecutive failures produce one recovery at the next request.
        content = [
            {"type": "toolResponse", "toolResult": {
                "isError": True, "value": "command failed"}},
            {"type": "toolResponse", "isError": True,
             "toolResult": {"value": None}},
            {"type": "toolResponse", "toolResult": {
                "value": {"exit_code": 2}}},
            {"type": "toolResponse", "toolResult": {
                "value": {"exit_code": "not-an-int"}}},
            {"type": "toolRequest"},
            {"type": "toolRequest"},
        ]
        result = module.analyze_efficiency(
            [], {}, [{"message": {"content": content}}], None, None)
        self.assertEqual(result["failed_tool_calls"], 3)
        self.assertEqual(result["recovery_attempts"], 1)

    def test_first_write_counts_tool_requests_not_raw_timeline_items(self) -> None:
        # [EFF-01, EFF-04]
        timeline = [
            None,
            "malformed",
            {"type": "assistant", "classification": "file_write"},
            {"type": "assistant", "classification": "inspection"},
            {"type": "tool_request", "classification": "inspection"},
            {"type": "tool_request", "classification": "file_write"},
        ]
        result = module.analyze_efficiency(timeline, {}, [], None, None)
        self.assertEqual(result["turns_to_first_write"], 2)

    def test_malformed_budget_values_do_not_raise(self) -> None:
        # [EFF-04]
        for turns, maximum in (("bad", 20), (2, "20"), (True, 20), (2, False)):
            with self.subTest(turns=turns, maximum=maximum):
                result = module.analyze_efficiency([], {}, [], turns, maximum)
                self.assertIsNone(result["budget_used_pct"])


class SupportingEfficiencyContractTest(unittest.TestCase):
    """Exercise module branches so module-level branch coverage is meaningful."""
    def test_summary_validates_and_averages(self) -> None:
        self.assertEqual(module.get_efficiency_summary(None)["run_count"], 0)
        summary = module.get_efficiency_summary([
            {"tool_calls_total": 0, "explore_pct": None},
            {"tool_calls_total": 2, "explore_pct": 1.0},
        ])
        self.assertEqual(summary["tool_calls_total"], 1)
        for bad in ("bad", 1):
            with self.assertRaises(TypeError): module.get_efficiency_summary(bad)
        with self.assertRaises(TypeError): module.get_efficiency_summary([None])
        for bad in (True, "1"):
            with self.assertRaises(TypeError):
                module.get_efficiency_summary([{"tool_calls_total": bad}])

    def test_recommendation_threshold_branches(self) -> None:
        base = {"tool_calls_total": 100, "failed_tool_calls": 0,
                "recovery_attempts": 0, "repeated_commands_count": 0,
                "tool_calls_per_file_changed": 0, "files_changed_count": 0,
                "explore_pct": 0, "budget_used_pct": 0,
                "turns_to_first_write": None}
        self.assertEqual(module.efficiency_recommendations("x", 1, "c", base), [])
        all_signals = dict(base, failed_tool_calls=10, explore_pct=.5,
                           repeated_commands_count=3,
                           tool_calls_per_file_changed=26,
                           files_changed_count=1, budget_used_pct=.5,
                           turns_to_first_write=60)
        recommendations = module.efficiency_recommendations("x", 1, "c", all_signals)
        self.assertEqual(len(recommendations), 5)
        self.assertEqual(recommendations[0]["signal"], "error_rate_high")
        no_file = dict(base, tool_calls_per_file_changed=30, files_changed_count=0)
        self.assertEqual(module.efficiency_recommendations("x", 1, "c", no_file), [])


if __name__ == "__main__":
    unittest.main()
