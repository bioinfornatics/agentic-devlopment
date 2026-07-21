#!/usr/bin/env python3
"""Aggregate and interpret skill-evaluation efficiency metrics."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from numbers import Real
from typing import Any

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

EFF_ERROR_RATE_HIGH = 0.10
EFF_EXPLORE_HIGH = 0.50
EFF_REPEATED_HIGH = 3
EFF_RATIO_HIGH = 25.0
EFF_DELAYED_WRITE = 0.60
EFF_MIN_BUDGET_FOR_DELAY = 0.50


def get_efficiency_summary(
    runs: Sequence[Mapping[str, Any]] | None,
) -> dict[str, int | float]:
    """Average each available scalar efficiency metric across runs."""
    if runs is None:
        runs = []
    if isinstance(runs, (str, bytes)) or not isinstance(runs, Sequence):
        raise TypeError("runs must be a sequence of mappings or None")

    totals = dict.fromkeys(SCALAR_METRICS, 0.0)
    counts = dict.fromkeys(SCALAR_METRICS, 0)
    for run in runs:
        if not isinstance(run, Mapping):
            raise TypeError("each run must be a mapping")
        for metric in SCALAR_METRICS:
            value = run.get(metric)
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, Real):
                raise TypeError(f"{metric} must be numeric or None")
            totals[metric] += float(value)
            counts[metric] += 1

    summary: dict[str, int | float] = {"run_count": len(runs)}
    summary.update({
        metric: totals[metric] / counts[metric] if counts[metric] else 0
        for metric in SCALAR_METRICS
    })
    return summary


_PHASE_MAP = {
    "inspection": "explore",
    "beads_read": "beads",
    "beads_write": "beads",
    "file_write": "implement",
    "validation": "validate",
    "browser_action": "browser",
    "delegation": "delegate",
    "handoff": "handoff",
    "planning": "plan",
}


def analyze_efficiency(
    timeline: Sequence[Any] | None,
    audit: Mapping[str, Any] | None,
    events: Sequence[Any] | None,
    turns_used: int | None,
    max_turns: int | None,
) -> dict[str, Any]:
    """Summarize workflow phases, failed calls, recoveries, and command reuse.

    A recovery is the first tool request after one or more failed responses.
    Commands are compared after collapsing whitespace; commands observed fewer
    than three times are not considered repeated/thrashing commands.
    """
    timeline_items = (
        timeline
        if isinstance(timeline, Sequence) and not isinstance(timeline, (str, bytes))
        else []
    )
    event_items = (
        events
        if isinstance(events, Sequence) and not isinstance(events, (str, bytes))
        else []
    )
    audit_data = audit if isinstance(audit, Mapping) else {}

    phases: dict[str, int] = {}
    tool_calls = 0
    turns_to_first_write: int | None = None
    for item in timeline_items:
        if not isinstance(item, Mapping) or item.get("type") != "tool_request":
            continue
        tool_calls += 1
        classification = item.get("classification")
        if turns_to_first_write is None and classification == "file_write":
            turns_to_first_write = tool_calls
        phase = _PHASE_MAP.get(str(classification or ""), "other")
        phases[phase] = phases.get(phase, 0) + 1

    failed_calls = 0
    recovery_attempts = 0
    awaiting_recovery = False
    for event in event_items:
        if not isinstance(event, Mapping):
            continue
        message = event.get("message")
        if not isinstance(message, Mapping):
            continue
        content = message.get("content")
        if not isinstance(content, Sequence) or isinstance(content, (str, bytes)):
            continue
        for item in content:
            if not isinstance(item, Mapping):
                continue
            if item.get("type") == "toolRequest":
                if awaiting_recovery:
                    recovery_attempts += 1
                    awaiting_recovery = False
                continue
            if item.get("type") != "toolResponse":
                continue
            raw_tool_result = item.get("toolResult")
            tool_result = (
                raw_tool_result if isinstance(raw_tool_result, Mapping) else {}
            )
            value = tool_result.get("value")
            result: Mapping[str, Any] = {}
            if isinstance(value, Mapping):
                structured = value.get("structuredContent")
                result = structured if isinstance(structured, Mapping) else value
            exit_code = result.get("exit_code")
            explicit_error = (
                item.get("isError") is True
                or tool_result.get("isError") is True
                or str(result.get("status", "")).lower() in {"error", "failed", "failure"}
            )
            exit_failure = False
            if exit_code is not None and not isinstance(exit_code, bool):
                try:
                    exit_failure = int(exit_code) != 0
                except (TypeError, ValueError):
                    exit_failure = False
            if explicit_error or exit_failure:
                failed_calls += 1
                awaiting_recovery = True

    raw_commands = audit_data.get("commands")
    commands = (
        raw_commands
        if isinstance(raw_commands, Sequence)
        and not isinstance(raw_commands, (str, bytes))
        else []
    )
    command_counts: dict[str, int] = {}
    first_seen: dict[str, int] = {}
    for command in commands:
        if not isinstance(command, str):
            continue
        normalized = " ".join(command.split())
        if not normalized:
            continue
        first_seen.setdefault(normalized, len(first_seen))
        command_counts[normalized] = command_counts.get(normalized, 0) + 1
    repeated = sorted(
        ((command, count) for command, count in command_counts.items() if count >= 3),
        key=lambda pair: (-pair[1], first_seen[pair[0]]),
    )

    def audit_list_size(name: str) -> int:
        value = audit_data.get(name)
        return (
            len(value)
            if isinstance(value, Sequence) and not isinstance(value, (str, bytes))
            else 0
        )

    files_changed_count = audit_list_size("files_changed")
    validation_count = audit_list_size("validations")
    valid_budget = (
        isinstance(turns_used, Real)
        and not isinstance(turns_used, bool)
        and isinstance(max_turns, Real)
        and not isinstance(max_turns, bool)
        and max_turns > 0
    )
    budget_pct = round(turns_used / max_turns, 3) if valid_budget else None
    explore_pct = (
        round(phases.get("explore", 0) / tool_calls, 2) if tool_calls else 0.0
    )
    calls_per_file = (
        round(tool_calls / files_changed_count, 1) if files_changed_count else None
    )
    phase_breakdown = dict(
        sorted(phases.items(), key=lambda pair: -pair[1])
    )

    return {
        "budget_used_pct": budget_pct,
        "tool_calls_total": tool_calls,
        "failed_tool_calls": failed_calls,
        "recovery_attempts": recovery_attempts,
        "repeated_commands_count": len(repeated),
        "repeated_commands_top": [
            {"cmd": command[:120], "n": count}
            for command, count in repeated[:4]
        ],
        "files_changed_count": files_changed_count,
        "validation_count": validation_count,
        "tool_calls_per_file_changed": calls_per_file,
        "turns_to_first_write": turns_to_first_write,
        "explore_pct": explore_pct,
        "phase_breakdown": phase_breakdown,
    }


def efficiency_recommendations(
    subject: str,
    eval_id: int,
    configuration: str,
    eff: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """Return actionable recommendations for every breached signal threshold."""
    recommendations: list[dict[str, Any]] = []
    total = max(1, eff.get("tool_calls_total", 1))
    failed = eff.get("failed_tool_calls", 0)
    recovery = eff.get("recovery_attempts", 0)
    repeated = eff.get("repeated_commands_count", 0)
    ratio = eff.get("tool_calls_per_file_changed") or 0.0
    explore = eff.get("explore_pct", 0.0)
    budget = eff.get("budget_used_pct") or 0.0
    first_write = eff.get("turns_to_first_write")
    context = {
        "recommendation_type": "efficiency",
        "subject": subject,
        "eval_id": eval_id,
        "configuration": configuration,
    }
    error_rate = failed / total
    write_delay = None if first_write is None else first_write / total

    def add_recommendation(
        severity: str, signal: str, message: str, evidence: str, action: str
    ) -> None:
        recommendations.append({
            **context,
            "severity": severity,
            "signal": signal,
            "message": message,
            "evidence": evidence,
            "action": action,
        })

    if error_rate >= EFF_ERROR_RATE_HIGH:
        add_recommendation(
            "high",
            "error_rate_high",
            f"Error rate {error_rate:.0%} ({failed}/{total} tool calls failed).",
            f"failed_tool_calls={failed} tool_calls_total={total} recovery_attempts={recovery}",
            "Inspect a failed command's error, try one alternative, then report the blocker.",
        )

    if explore >= EFF_EXPLORE_HIGH:
        add_recommendation(
            "medium",
            "over_exploration",
            f"Over-exploration: {explore:.0%} of tool calls were file reads.",
            f"explore_pct={explore:.0%} phase_breakdown={eff.get('phase_breakdown', {})}",
            "Constrain initial reads and state a scoped plan before exploring further.",
        )

    if repeated >= EFF_REPEATED_HIGH:
        add_recommendation(
            "medium",
            "command_thrashing",
            f"Command thrashing: {repeated} commands were repeated 3+ times.",
            f"repeated_commands_count={repeated}",
            "After two identical results, change approach or report the blocker.",
        )

    if ratio >= EFF_RATIO_HIGH and eff.get("files_changed_count", 0) > 0:
        add_recommendation(
            "medium",
            "low_implementation_yield",
            f"Low implementation yield: {ratio:.0f} tool calls per file changed.",
            f"tool_calls_per_file_changed={ratio:.0f} files_changed={eff.get('files_changed_count')}",
            "Name the files to change, make the scoped edit, validate, and stop.",
        )

    if (
        write_delay is not None
        and budget >= EFF_MIN_BUDGET_FOR_DELAY
        and write_delay >= EFF_DELAYED_WRITE
    ):
        add_recommendation(
            "low",
            "delayed_first_write",
            f"Slow to act: first file write at tool call {first_write}.",
            f"turns_to_first_write={first_write} tool_calls_total={total} budget_used_pct={budget:.0%}",
            "Limit pre-write reads and emit a scoped plan early.",
        )

    return recommendations
