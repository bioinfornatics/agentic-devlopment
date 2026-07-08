#!/usr/bin/env python3
"""Analyze skill eval artifacts into timelines, sequence diagrams, reports, and SQLite rows."""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKSPACE_ROOT = ROOT / "dist" / "evals" / "skills"
DEFAULT_DB = ROOT / "dist" / "evals" / "evaluation.db"

ROOT_CAUSES = {
    "skill_gap",
    "scenario_too_easy",
    "scenario_too_broad",
    "scenario_too_strict",
    "baseline_contamination",
    "fixture_issue",
    "grader_issue",
    "runner_audit_issue",
    "turn_budget_issue",
    "tool_error_loop",
    "validation_loop",
    "beads_state_confusion",
    "browser_setup_failure",
    "over_exploration",
    "final_answer_omitted",
    "model_variance",
}


MODEL_ERROR_PATTERNS = (
    "invalid_content",
    "content filter",
    "content was filtered",
    "filtered by azure",
    "azure content policy",
    "responsible ai",
    "content_filter",
    "invalid content",
)


def detect_model_errors(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detect Azure/model content errors in the event stream."""
    errors: list[dict[str, Any]] = []
    for event in events:
        event_type = str(event.get("type", ""))
        if event_type in ("error", "model_error", "provider_error"):
            errors.append({"type": event_type, "event": event})
            continue
        message = event.get("message") if isinstance(event.get("message"), dict) else {}
        for item in message.get("content", []) if isinstance(message.get("content"), list) else []:
            text = ""
            if item.get("type") == "text":
                text = str(item.get("text", ""))
            elif item.get("type") == "toolResponse":
                result = item.get("toolResult", {}).get("value", {}) if isinstance(item.get("toolResult"), dict) else {}
                text = str(result) if isinstance(result, str) else json.dumps(result)[:500]
            lower = text.lower()
            if any(pat in lower for pat in MODEL_ERROR_PATTERNS):
                errors.append({
                    "type": "model_error_in_content",
                    "pattern_matched": next(pat for pat in MODEL_ERROR_PATTERNS if pat in lower),
                    "excerpt": text[:200],
                })
    return errors


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(errors="replace"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def discover_subjects(workspace_root: Path, subject_filter: str | None) -> list[Path]:
    subjects = [p for p in workspace_root.iterdir() if p.is_dir()]
    if subject_filter:
        subjects = [p for p in subjects if p.name == subject_filter]
    return sorted(subjects)


def latest_hash_dir(subject_dir: Path, hash_filter: str | None) -> Path | None:
    candidates = [p for p in subject_dir.iterdir() if p.is_dir() and (p / "benchmark.json").exists()]
    if hash_filter:
        candidates = [p for p in candidates if p.name == hash_filter]
    if not candidates:
        return None
    return sorted(candidates, key=lambda p: (p / "benchmark.json").stat().st_mtime)[-1]


def parse_events(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if not path.exists():
        return events
    for line in path.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict):
            events.append(event)
    return events


def command_kind(command: str) -> str:
    if re.search(r"(^|[;&|])\s*bd\s+", command):
        if re.search(r"\bbd\s+(create|update|close|remember|dep\s+add|delete|reopen)\b", command):
            return "beads_write"
        return "beads_read"
    if re.search(r"\b(goose\s+recipe\s+validate|cargo\s+test|cargo\s+clippy|cargo\s+fmt|pnpm\s+test|python\s+-m\s+py_compile|build-docs\.sh)\b", command):
        return "validation"
    if re.search(r"\b(cat\s+>|tee\s+|python\s+-\s*<<|apply_patch|sed\s+-i|cp\s+|mv\s+|rm\s+)\b", command):
        return "file_write"
    if re.search(r"\b(git\s+diff|git\s+status|find\s+|grep\s+|sed\s+-n|cat\s+)\b", command):
        return "inspection"
    return "tool"


def timeline_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    timeline: list[dict[str, Any]] = []
    step = 0
    for event in events:
        message = event.get("message") if isinstance(event.get("message"), dict) else {}
        role = message.get("role", event.get("type", "event"))
        for item in message.get("content", []) if isinstance(message.get("content"), list) else []:
            item_type = item.get("type")
            if item_type == "toolRequest":
                tool = item.get("toolCall", {}).get("value", {}) if isinstance(item.get("toolCall"), dict) else {}
                name = tool.get("name", "tool")
                arguments = tool.get("arguments", {}) if isinstance(tool.get("arguments"), dict) else {}
                command = arguments.get("command") if isinstance(arguments, dict) else None
                step += 1
                timeline.append({
                    "step": step,
                    "actor": "assistant",
                    "type": "tool_request",
                    "tool": name,
                    "command": command,
                    "classification": command_kind(command) if command else browser_kind(name),
                })
            elif item_type == "toolResponse":
                result = item.get("toolResult", {}).get("value", {}) if isinstance(item.get("toolResult"), dict) else {}
                structured = result.get("structuredContent", {}) if isinstance(result, dict) else {}
                step += 1
                timeline.append({
                    "step": step,
                    "actor": "tool",
                    "type": "tool_response",
                    "exit_code": structured.get("exit_code"),
                    "stdout_preview": str(structured.get("stdout", ""))[:240],
                    "stderr_preview": str(structured.get("stderr", ""))[:240],
                    "classification": "tool_result",
                })
            elif item_type == "text":
                text = str(item.get("text", "")).strip()
                if text:
                    step += 1
                    timeline.append({
                        "step": step,
                        "actor": role,
                        "type": "message",
                        "text_preview": text[:240],
                        "classification": message_kind(text),
                    })
        if event.get("type") == "complete":
            step += 1
            timeline.append({
                "step": step,
                "actor": "goose",
                "type": "complete",
                "total_tokens": event.get("total_tokens"),
                "classification": "complete",
            })
    return timeline


def browser_kind(name: str) -> str:
    lowered = name.lower()
    if "browser" in lowered or "playwright" in lowered:
        return "browser_action"
    if "delegate" in lowered:
        return "delegation"
    return "tool"


def message_kind(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["handoff", "remaining risks", "files changed", "validation"]):
        return "handoff"
    if "plan" in lowered or "acceptance" in lowered:
        return "planning"
    return "assistant_message"


def mermaid_sequence(timeline: list[dict[str, Any]], title: str) -> str:
    lines = ["sequenceDiagram", f"    %% {title}", "    participant Agent", "    participant Tool", "    participant FS as Worktree", "    participant Beads", "    participant Browser"]
    for item in timeline[:80]:
        cls = item.get("classification")
        label = item.get("command") or item.get("tool") or item.get("text_preview") or item.get("type")
        label = sanitize_mermaid(str(label))[:120]
        if cls in {"beads_read", "beads_write"}:
            lines.append(f"    Agent->>Beads: {label}")
        elif cls in {"file_write", "inspection", "validation", "tool", "tool_result"}:
            target = "FS" if cls in {"file_write", "inspection"} else "Tool"
            arrow = "-->>" if item.get("actor") == "tool" else "->>"
            left = "Tool" if item.get("actor") == "tool" else "Agent"
            lines.append(f"    {left}{arrow}{target}: {label}")
        elif cls == "browser_action":
            lines.append(f"    Agent->>Browser: {label}")
        elif cls == "handoff":
            lines.append(f"    Agent-->>Agent: {label}")
        else:
            lines.append(f"    Agent-->>Agent: {label}")
    return "\n".join(lines) + "\n"


def sanitize_mermaid(value: str) -> str:
    return value.replace("\n", " ").replace(":", " -").replace("|", "/")


def detect_bad_actions(timeline: list[dict[str, Any]], audit: dict[str, Any], grading: dict[str, Any], timing: dict[str, Any], scenario: dict[str, Any]) -> list[dict[str, Any]]:
    bad: list[dict[str, Any]] = []
    query = scenario.get("query", "").lower()
    commands = audit.get("commands", []) if isinstance(audit, dict) else []
    beads_actions = normalize_beads_actions(audit.get("beads_actions", [])) if isinstance(audit, dict) else []
    browser_actions = audit.get("browser_actions", []) if isinstance(audit, dict) else []
    files_changed = audit.get("files_changed", []) if isinstance(audit, dict) else []
    if timing.get("max_turns_reached"):
        bad.append({"type": "max_turn_exhaustion", "severity": "high", "evidence": f"turns_used={timing.get('turns_used')} max_turns={timing.get('max_turns')}"})
    if "read-only" in query and files_changed:
        bad.append({"type": "read_only_write", "severity": "high", "evidence": ", ".join(files_changed[:8])})
    if "read-only" in query and any(action.get("kind") in {"claim", "create", "close", "memory", "dependency", "write"} for action in beads_actions):
        bad.append({"type": "read_only_beads_mutation", "severity": "high", "evidence": "Beads mutation command in read-only scenario"})
    if files_changed and not audit.get("validations"):
        bad.append({"type": "missing_validation", "severity": "medium", "evidence": "Files changed but audit.validations is empty"})
    if requires_browser_evidence(scenario) and not browser_actions and not any(item.get("classification") == "browser_action" for item in timeline):
        bad.append({"type": "browser_claim_without_evidence", "severity": "medium", "evidence": "Scenario expects browser/UI evidence but no browser actions were detected"})
    if requires_beads_evidence(scenario) and not beads_actions:
        bad.append({"type": "missing_beads_audit", "severity": "medium", "evidence": "Scenario expects Beads behavior but no Beads actions were detected"})
    if any("TODO.md" in f or "MEMORY.md" in f for f in files_changed):
        bad.append({"type": "markdown_todo_or_memory_file", "severity": "high", "evidence": ", ".join(files_changed)})
    failed = [e for e in grading.get("expectations", []) if not e.get("passed")]
    for item in failed:
        text = item.get("text", "")
        if "handoff" in text.lower() or "reports git status" in text.lower():
            bad.append({"type": "missing_handoff", "severity": "medium", "evidence": text})
    repeated = repeated_commands(commands)
    for command, count in repeated[:3]:
        if count >= 3:
            bad.append({"type": "repeated_command", "severity": "low", "evidence": f"{count}x {command[:160]}"})
    return bad


def normalize_beads_actions(items: Any) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return actions
    for item in items:
        if isinstance(item, dict):
            actions.append(item)
        elif isinstance(item, str):
            actions.append({"command": item, "kind": "write" if re.search(r"\bbd\s+(create|update|close|remember|dep\s+add)\b", item) else "read"})
    return actions


def requires_browser_evidence(scenario: dict[str, Any]) -> bool:
    text = " ".join([scenario.get("query", ""), " ".join(scenario.get("files", []))]).lower()
    return any(word in text for word in ["browser", "viewport", "accessibility", "screenshot", "ui", "ux", "webapp", "documentation site", "console", "network"])


def requires_beads_evidence(scenario: dict[str, Any]) -> bool:
    text = " ".join([scenario.get("query", ""), " ".join(scenario.get("files", []))]).lower()
    return "beads" in text or "bd " in text or ".beads" in text

def repeated_commands(commands: list[str]) -> list[tuple[str, int]]:
    counts = Counter(commands)
    return counts.most_common()


def classify_root_causes(bad_actions: list[dict[str, Any]], grading: dict[str, Any], timing: dict[str, Any], feedback: dict[str, Any]) -> list[str]:
    causes: set[str] = set()
    if timing.get("max_turns_reached"):
        causes.add("turn_budget_issue")
    bad_types = {item.get("type") for item in bad_actions}
    if {"read_only_write", "read_only_beads_mutation"} & bad_types:
        causes.add("scenario_too_strict")
    if {"missing_validation", "missing_handoff"} & bad_types:
        causes.add("skill_gap")
    if {"missing_beads_audit", "browser_claim_without_evidence"} & bad_types:
        causes.add("runner_audit_issue")
    for rec in feedback.get("recommendations", []) if isinstance(feedback.get("recommendations"), list) else []:
        rec_type = rec.get("type")
        severity = rec.get("severity")
        message = str(rec.get("message", "")).lower()
        if severity not in {"high", "medium"}:
            continue
        if rec_type == "runner":
            causes.add("runner_audit_issue")
        elif rec_type == "scenario_quality" and any(word in message for word in ["broad", "narrow", "split", "turn", "scope", "fixture"]):
            causes.add("scenario_too_broad")
        elif rec_type == "validation" and any(word in message for word in ["grader", "rubric", "evaluator", "validation", "assertion"]):
            causes.add("grader_issue")
        elif rec_type == "skill_instruction" and any(word in message for word in ["skill", "instruction", "require", "guidance", "checklist", "rule"]):
            causes.add("skill_gap")
    if grading.get("summary", {}).get("pass_rate") == 1.0 and timing.get("max_turns_reached"):
        causes.add("over_exploration")
    return sorted(causes)

def analyze_efficiency(
    timeline: list[dict[str, Any]],
    audit:    dict[str, Any],
    events:   list[dict[str, Any]],
    turns_used: int | None,
    max_turns:  int | None,
) -> dict[str, Any]:
    """Diagnose how turns were spent: phases, errors, retries, exploration ratio."""
    PHASE_MAP: dict[str, str] = {
        "inspection":    "explore",
        "beads_read":    "beads",    "beads_write": "beads",
        "file_write":    "implement",
        "validation":    "validate",
        "browser_action":"browser",
        "delegation":    "delegate",
        "handoff":       "handoff",  "planning": "plan",
    }
    phases: dict[str, int] = {}
    tool_reqs = 0
    for item in timeline:
        if item.get("type") != "tool_request":
            continue
        tool_reqs += 1
        ph = PHASE_MAP.get(item.get("classification", ""), "other")
        phases[ph] = phases.get(ph, 0) + 1

    # Non-zero exit codes in toolResponse events
    failed_calls = 0
    prev_failed  = False
    recovery_attempts = 0
    for ev in events:
        msg = ev.get("message", {}) if isinstance(ev.get("message"), dict) else {}
        for item in msg.get("content", []) if isinstance(msg.get("content"), list) else []:
            if item.get("type") == "toolResponse":
                result = item.get("toolResult", {}).get("value", {}) if isinstance(item.get("toolResult"), dict) else {}
                sc  = result.get("structuredContent", {}) if isinstance(result, dict) else {}
                ec  = sc.get("exit_code") if isinstance(sc, dict) else None
                bad = ec is not None and ec not in (0, "0")
                if bad:
                    failed_calls += 1
                    prev_failed = True
            elif item.get("type") == "toolRequest" and prev_failed:
                recovery_attempts += 1
                prev_failed = False

    # Repeated commands (≥3 times = thrashing signal)
    commands: list[str] = audit.get("commands", []) if isinstance(audit, dict) else []
    cmd_counts: dict[str, int] = {}
    for cmd in commands:
        cmd_counts[cmd] = cmd_counts.get(cmd, 0) + 1
    repeated = sorted([(c, n) for c, n in cmd_counts.items() if n >= 3], key=lambda x: -x[1])

    files_changed: list[str] = audit.get("files_changed", []) if isinstance(audit, dict) else []
    validations:   list[str] = audit.get("validations",   []) if isinstance(audit, dict) else []

    # First write turn (latency before agent stopped exploring)
    turns_to_first_write: int | None = None
    for i, item in enumerate(timeline):
        if item.get("classification") == "file_write":
            turns_to_first_write = i + 1
            break

    budget_pct  = round(turns_used / max_turns, 3) if (turns_used and max_turns) else None
    explore_pct = round(phases.get("explore", 0) / max(1, tool_reqs), 2) if tool_reqs else 0.0
    eff_ratio   = round(tool_reqs / max(1, len(files_changed)), 1) if files_changed else None

    return {
        "budget_used_pct":            budget_pct,
        "tool_calls_total":           tool_reqs,
        "failed_tool_calls":          failed_calls,
        "recovery_attempts":          recovery_attempts,
        "repeated_commands_count":    len(repeated),
        "repeated_commands_top":      [{"cmd": c[:120], "n": n} for c, n in repeated[:4]],
        "files_changed_count":        len(files_changed),
        "validation_count":           len(validations),
        "tool_calls_per_file_changed":eff_ratio,
        "turns_to_first_write":       turns_to_first_write,
        "explore_pct":                explore_pct,
        "phase_breakdown":            {k: v for k, v in sorted(phases.items(), key=lambda x: -x[1]) if v > 0},
    }


# ── Efficiency signal thresholds ──────────────────────────────────────────────
EFF_ERROR_RATE_HIGH  = 0.10   # 10%+ tool calls fail  → HIGH severity
EFF_EXPLORE_HIGH     = 0.50   # 50%+ calls = file reads → MEDIUM
EFF_REPEATED_HIGH    = 2      # >=3 repeated commands   → MEDIUM
EFF_RATIO_HIGH       = 25.0   # >25 calls per file changed → MEDIUM
EFF_DELAYED_WRITE    = 0.60   # first write after 60% of budget → LOW


def efficiency_recommendations(
    subject: str,
    eval_id: int,
    configuration: str,
    eff: dict[str, Any],
) -> list[dict[str, Any]]:
    """Map efficiency signals to specific, actionable skill-improvement recommendations.

    Each recommendation names: the signal, why it matters, and exactly what to add
    to the skill instructions to prevent the pattern.
    """
    recs: list[dict[str, Any]] = []
    total    = max(1, eff.get("tool_calls_total", 1))
    failed   = eff.get("failed_tool_calls", 0)
    recovery = eff.get("recovery_attempts", 0)
    repeated = eff.get("repeated_commands_count", 0)
    ratio    = eff.get("tool_calls_per_file_changed") or 0.0
    explore  = eff.get("explore_pct", 0.0)
    budget   = eff.get("budget_used_pct") or 0.0
    t2w      = eff.get("turns_to_first_write")  # tool calls before first write

    error_rate = failed / total

    # ── HIGH: error rate above threshold ─────────────────────────────────────
    if error_rate >= EFF_ERROR_RATE_HIGH:
        recs.append({
            "recommendation_type": "efficiency",
            "severity":            "high",
            "signal":              "error_rate_high",
            "subject":             subject,
            "eval_id":             eval_id,
            "configuration":       configuration,
            "message": (
                f"Error rate {error_rate:.0%} ({failed}/{total} tool calls produced non-zero exit). "
                f"The skill does not instruct the agent to handle tool failures gracefully."
            ),
            "evidence": (
                f"failed_tool_calls={failed}  tool_calls_total={total}  "
                f"error_rate={error_rate:.0%}  recovery_attempts={recovery}"
            ),
            "action": (
                "Add to skill operating process: "
                "'If a shell command fails (non-zero exit), read the error message carefully. "
                "Try one alternative approach. If still failing after 2 attempts, stop and "
                "report the exact blocker rather than retrying indefinitely.'"
            ),
        })

    # ── MEDIUM: over-exploration ───────────────────────────────────────────────
    if explore >= EFF_EXPLORE_HIGH:
        phases = eff.get("phase_breakdown", {})
        recs.append({
            "recommendation_type": "efficiency",
            "severity":            "medium",
            "signal":              "over_exploration",
            "subject":             subject,
            "eval_id":             eval_id,
            "configuration":       configuration,
            "message": (
                f"Over-exploration: {explore:.0%} of tool calls were file reads. "
                f"Agent spent most of its budget reading, not acting. "
                f"Phase breakdown: {phases}."
            ),
            "evidence": (
                f"explore_pct={explore:.0%}  "
                f"tool_calls_per_file_changed={ratio:.1f}  "
                f"phase_breakdown={phases}"
            ),
            "action": (
                "Add to skill: "
                "'Read at most 5 files before acting. "
                "Use the analyze extension (code structure tools) before raw file reads. "
                "Start with entry points, not broad directory scans. "
                "Emit a Scoped plan before any additional reads.'"
            ),
        })

    # ── MEDIUM: command thrashing ──────────────────────────────────────────────
    if repeated >= EFF_REPEATED_HIGH:
        top = eff.get("repeated_commands_top", [])
        ev = f"repeated_commands_count={repeated}"
        if top:
            ev += f"  top: '{top[0].get('cmd','')[:60]}' × {top[0].get('n')}"
        recs.append({
            "recommendation_type": "efficiency",
            "severity":            "medium",
            "signal":              "command_thrashing",
            "subject":             subject,
            "eval_id":             eval_id,
            "configuration":       configuration,
            "message": (
                f"Command thrashing: {repeated} commands repeated 3+ times. "
                "Agent is likely stuck in a loop trying the same approach repeatedly."
            ),
            "evidence":  ev,
            "action": (
                "Add to skill: "
                "'If you run the same command twice and get the same result, "
                "do not run it a third time. Try a different approach, "
                "or stop and report the blocker with the exact error seen.'"
            ),
        })

    # ── MEDIUM: low implementation yield ─────────────────────────────────────
    if ratio >= EFF_RATIO_HIGH and eff.get("files_changed_count", 0) > 0:
        recs.append({
            "recommendation_type": "efficiency",
            "severity":            "medium",
            "signal":              "low_implementation_yield",
            "subject":             subject,
            "eval_id":             eval_id,
            "configuration":       configuration,
            "message": (
                f"Low implementation yield: {ratio:.0f} tool calls per file changed. "
                f"Most work was exploration, not implementation."
            ),
            "evidence": (
                f"tool_calls_per_file_changed={ratio:.0f}  "
                f"files_changed={eff.get('files_changed_count')}  "
                f"tool_calls_total={total}"
            ),
            "action": (
                "Add scoped plan requirement to skill: "
                "'Before editing, state exactly which files you will change and what change you will make. "
                "Do not read additional files after the plan is stated. "
                "Make the edit, validate, then stop.'"
            ),
        })

    # ── LOW: delayed first write ──────────────────────────────────────────────
    if t2w is not None and budget >= 0.5 and t2w / max(1, total) >= EFF_DELAYED_WRITE:
        recs.append({
            "recommendation_type": "efficiency",
            "severity":            "low",
            "signal":              "delayed_first_write",
            "subject":             subject,
            "eval_id":             eval_id,
            "configuration":       configuration,
            "message": (
                f"Slow to act: first file write at tool call {t2w} "
                f"({t2w / total:.0%} into the run). "
                "Skill should constrain pre-write exploration."
            ),
            "evidence": (
                f"turns_to_first_write={t2w}  "
                f"tool_calls_total={total}  "
                f"budget_used_pct={budget:.0%}"
            ),
            "action": (
                "Add to skill operating process: "
                "'If the task requires file edits, emit a Scoped plan by tool call 5 at most. "
                "Do not read more than 3 files before the first edit.'"
            ),
        })

    return recs


def _compute_scenario_hash(scenario: dict[str, Any]) -> str:
    """Fallback: compute scenario fingerprint from the scenario dict directly."""
    import hashlib as _hl
    key = {
        "query":             scenario.get("query", ""),
        "expected_behavior": scenario.get("expected_behavior", []),
        "baseline_gaps":     scenario.get("baseline_gaps", []),
        "max_turns":         scenario.get("max_turns", 0),
        "difficulty":        scenario.get("difficulty", ""),
    }
    return _hl.sha256(json.dumps(key, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def analyze_run(run_dir: Path, scenario: dict[str, Any], subject: str, eval_id: int, configuration: str) -> dict[str, Any]:
    events = parse_events(run_dir / "outputs" / "events.jsonl")
    model_errors = detect_model_errors(events)
    timeline = timeline_from_events(events)
    audit = read_json(run_dir / "audit.json", {}) or {}
    grading = read_json(run_dir / "grading.json", {}) or {}
    timing = read_json(run_dir / "timing.json", {}) or {}
    feedback = read_json(run_dir / "feedback.json", {}) or {}
    # Scenario hash: read from eval_metadata.json (written by runner).
    # Falls back to hashing the scenario dict if metadata is missing (older runs).
    _meta = read_json(run_dir.parent.parent / "eval_metadata.json", {}) or {}
    scenario_hash_val: str = _meta.get("scenario_hash") or _compute_scenario_hash(scenario)
    # --- loaded skills + delegated agents from audit ---
    loaded_skills: list[str] = audit.get("loaded_skills", []) if isinstance(audit, dict) else []
    _delegated_raw = [
        tc.get("arguments", {}).get("source", "")
        for tc in (audit.get("tool_calls", []) if isinstance(audit, dict) else [])
        if isinstance(tc, dict) and "delegate" in str(tc.get("name", "")).lower()
        and isinstance(tc.get("arguments"), dict) and tc["arguments"].get("source")
    ]
    _seen_da: set[str] = set()
    delegated_agents: list[str] = [x for x in _delegated_raw if not (x in _seen_da or _seen_da.add(x))]  # type: ignore[func-returns-value]
    efficiency = analyze_efficiency(
        timeline, audit, events,
        turns_used=timing.get("turns_used"),
        max_turns=timing.get("max_turns"),
    )
    bad_actions = detect_bad_actions(timeline, audit, grading, timing, scenario)
    root_causes = classify_root_causes(bad_actions, grading, timing, feedback)
    analysis = {
        "subject": subject,
        "eval_id": eval_id,
        "configuration": configuration,
        "run_number": int(run_dir.name.split("-")[-1]) if run_dir.name.startswith("run-") else 1,
        "score": grading.get("summary", {}),
        "turns": {
            "used": timing.get("turns_used"),
            "max": timing.get("max_turns"),
            "reached_max": timing.get("max_turns_reached"),
        },
        "timeline": timeline,
        "bad_actions": bad_actions,
        "root_causes": root_causes,
        "feedback": feedback,
        "confidence": confidence_for_run(grading, timing, events),
        "model_errors": model_errors,
        "model_error_count": len(model_errors),
        "loaded_skills": loaded_skills,
        "delegated_agents": delegated_agents,
        "efficiency": efficiency,
        "efficiency_recs": efficiency_recommendations(subject, eval_id, configuration, efficiency),
        "scenario_hash": scenario_hash_val,
    }
    write_json(run_dir / "analysis.json", analysis)
    (run_dir / "sequence.mmd").write_text(mermaid_sequence(timeline, f"{subject} eval-{eval_id} {configuration} {run_dir.name}"))
    (run_dir / "analysis.md").write_text(run_analysis_md(analysis))
    return analysis


def confidence_for_run(grading: dict[str, Any], timing: dict[str, Any], events: list[dict[str, Any]]) -> float:
    confidence = 0.75
    if timing.get("max_turns_reached"):
        confidence -= 0.25
    if not events:
        confidence -= 0.25
    if grading.get("summary", {}).get("total", 0) == 0:
        confidence -= 0.25
    return round(max(0.1, min(1.0, confidence)), 2)


def run_analysis_md(analysis: dict[str, Any]) -> str:
    lines = [f"# Run Analysis — {analysis['subject']} eval-{analysis['eval_id']} {analysis['configuration']}", ""]
    score = analysis.get("score", {})
    turns = analysis.get("turns", {})
    lines.append(f"- Pass rate: {score.get('pass_rate')} ({score.get('passed')}/{score.get('total')})")
    lines.append(f"- Turns: {turns.get('used')}/{turns.get('max')} max reached={turns.get('reached_max')}")
    lines.append(f"- Confidence: {analysis.get('confidence')}")
    _skills = analysis.get("loaded_skills") or []
    _agents = analysis.get("delegated_agents") or []
    lines.append(f"- Loaded skills: {', '.join(_skills) if _skills else '—'}")
    lines.append(f"- Delegated agents: {', '.join(_agents) if _agents else '—'}")
    # Turn efficiency — only shown when budget usage is notable (> 40%)
    eff = analysis.get("efficiency", {})
    budget = eff.get("budget_used_pct")
    if budget is not None and budget > 0.4:
        lines.append("")
        lines.append("## Turn Efficiency")
        lines.append(f"- Budget used: {budget:.0%}  ({eff.get('tool_calls_total', '?')} tool calls)")
        pb = eff.get("phase_breakdown", {})
        if pb:
            parts = " | ".join(f"{ph}={n}" for ph, n in sorted(pb.items(), key=lambda x: -x[1]))
            lines.append(f"- Phase breakdown: {parts}")
        if eff.get("failed_tool_calls", 0) > 0:
            lines.append(f"- Failed tool calls: {eff['failed_tool_calls']} (non-zero exit)")
        if eff.get("recovery_attempts", 0) > 0:
            lines.append(f"- Recovery attempts after failure: {eff['recovery_attempts']}")
        if eff.get("repeated_commands_count", 0) > 0:
            lines.append(f"- Repeated commands (>=3x): {eff['repeated_commands_count']}")
            for rc in eff.get("repeated_commands_top", [])[:3]:
                cmd_str = str(rc.get("cmd", ""))[:80]
                n_str   = str(rc.get("n", "?"))
                lines.append(f"  - {n_str}x: {cmd_str}")
        if eff.get("turns_to_first_write") is not None:
            lines.append(f"- Turns before first file write: {eff['turns_to_first_write']}")
        if eff.get("tool_calls_per_file_changed") is not None:
            ratio = eff["tool_calls_per_file_changed"]
            flag  = " (high: over-exploration)" if ratio > 20 else ""
            lines.append(f"- Tool calls per file changed: {ratio}{flag}")
        if eff.get("explore_pct", 0) > 0.3:
            lines.append(f"- Exploration fraction: {eff['explore_pct']:.0%} of tool calls were file reads")
    lines.append("")
    lines.append("## Root causes")
    lines.extend(f"- `{item}`" for item in analysis.get("root_causes", []) or ["none"])
    lines.append("")
    lines.append("## Bad actions")
    for item in analysis.get("bad_actions", []):
        lines.append(f"- **{item.get('severity')}** `{item.get('type')}` — {item.get('evidence')}")
    if not analysis.get("bad_actions"):
        lines.append("- none detected")
    lines.append("")
    lines.append("## Timeline preview")
    for item in analysis.get("timeline", [])[:20]:
        label = item.get("command") or item.get("tool") or item.get("text_preview") or item.get("type")
        lines.append(f"- {item.get('step')}. `{item.get('classification')}` {label}")
    return "\n".join(lines) + "\n"


def scenario_quality(with_run: dict[str, Any] | None, without_run: dict[str, Any] | None, scenario: dict[str, Any]) -> str:
    if not with_run or not without_run:
        return "inconclusive"
    if with_run["score"].get("pass_rate") == 1.0 and without_run["score"].get("pass_rate") == 1.0:
        return "too_easy"
    if with_run["turns"].get("reached_max") and without_run["turns"].get("reached_max"):
        return "too_broad"
    if any(".agents/skills/" in path for path in scenario.get("files", [])):
        return "contaminated"
    return "good"


def skill_impact(with_run: dict[str, Any] | None, without_run: dict[str, Any] | None) -> str:
    if not with_run or not without_run:
        return "inconclusive"
    w = with_run["score"].get("pass_rate", 0) or 0
    b = without_run["score"].get("pass_rate", 0) or 0
    if w > b:
        return "positive"
    if w < b:
        return "negative"
    return "neutral"


def run_llm_analysis(args: argparse.Namespace, subject: str, scenario_analysis: dict[str, Any], with_run: dict[str, Any] | None, without_run: dict[str, Any] | None) -> dict[str, Any] | None:
    if not args.llm:
        return None
    prompt = build_llm_analysis_prompt(subject, scenario_analysis, with_run, without_run)
    cmd = [resolve_goose_cli(args), "run", "--no-session", "--text", prompt, "--max-turns", str(args.llm_max_turns), "--output-format", "json"]
    if args.provider:
        cmd.extend(["--provider", args.provider])
    if args.model:
        cmd.extend(["--model", args.model])
    proc = subprocess.run(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=args.llm_timeout)
    parsed = extract_json_object(proc.stdout)
    if proc.returncode != 0 or not isinstance(parsed, dict):
        return {
            "error": "llm_analysis_failed",
            "returncode": proc.returncode,
            "stderr": proc.stderr[-1000:],
        }
    return parsed


def resolve_goose_cli(args: argparse.Namespace) -> str:
    cli = args.goose_cli or os.environ.get("GOOSE_EVAL_CLI") or "goose"
    if not any(sep in cli for sep in (os.sep, "/")):
        return cli
    path = Path(cli).expanduser()
    return str(path.resolve() if path.is_absolute() else (ROOT / path).resolve())


def build_llm_analysis_prompt(subject: str, scenario_analysis: dict[str, Any], with_run: dict[str, Any] | None, without_run: dict[str, Any] | None) -> str:
    payload = {
        "subject": subject,
        "scenario": scenario_analysis,
        "with_skill": compact_run_for_llm(with_run),
        "without_skill": compact_run_for_llm(without_run),
    }
    return (
        "You are analyzing an A/B skill evaluation. Return JSON only with keys: "
        "skill_impact, scenario_quality, root_causes, bad_actions, blockages, "
        "skill_recommendations, scenario_recommendations, runner_recommendations, confidence.\n\n"
        f"Input:\n{json.dumps(payload, indent=2, ensure_ascii=False)}"
    )


def compact_run_for_llm(run: dict[str, Any] | None) -> dict[str, Any] | None:
    if not run:
        return None
    return {
        "configuration": run.get("configuration"),
        "score": run.get("score"),
        "turns": run.get("turns"),
        "bad_actions": run.get("bad_actions"),
        "root_causes": run.get("root_causes"),
        "confidence": run.get("confidence"),
        "feedback_recommendations": (run.get("feedback", {}) or {}).get("recommendations", [])[:8],
        "timeline_preview": run.get("timeline", [])[:15],
    }


def extract_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text:
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def analyze_subject(subject_dir: Path, args: argparse.Namespace) -> dict[str, Any] | None:
    run_dir = latest_hash_dir(subject_dir, args.hash)
    if not run_dir:
        return None
    subject = subject_dir.name
    eval_def = read_json(ROOT / "evals" / "skills" / f"{subject}.json", []) or []
    benchmark = read_json(run_dir / "benchmark.json", {}) or {}
    scenario_analyses = []
    for eval_path in sorted(run_dir.glob("eval-*")):
        eval_id = int(eval_path.name.split("-")[-1])
        if args.scenario is not None and eval_id != args.scenario:
            continue
        scenario = eval_def[eval_id] if eval_id < len(eval_def) else {}
        run_analyses: dict[str, dict[str, Any]] = {}
        for config_dir in sorted(p for p in eval_path.iterdir() if p.is_dir()):
            for one_run in sorted(config_dir.glob("run-*")):
                analysis = analyze_run(one_run, scenario, subject, eval_id, config_dir.name)
                run_analyses[config_dir.name] = analysis
        with_run = run_analyses.get("with_skill") or run_analyses.get("new_skill")
        without_run = run_analyses.get("without_skill") or run_analyses.get("old_skill")
        total_model_errors = sum(run.get("model_error_count", 0) for run in run_analyses.values())
        all_loaded_skills = sorted(set(
            s for run in run_analyses.values() for s in (run.get("loaded_skills") or [])
        ))
        _seen_aa: set[str] = set()
        all_delegated_agents: list[str] = []
        for _run in run_analyses.values():
            for _a in (_run.get("delegated_agents") or []):
                if _a not in _seen_aa:
                    _seen_aa.add(_a)
                    all_delegated_agents.append(_a)
        scenario_analysis = {
            "subject": subject,
            "content_hash": run_dir.name,
            "eval_id": eval_id,
            "query": scenario.get("query"),
            "difficulty": scenario.get("difficulty", "unknown"),
            "expected_skill_contribution": scenario.get("expected_skill_contribution", ""),
            "skill_impact": skill_impact(with_run, without_run),
            "scenario_quality": scenario_quality(with_run, without_run, scenario),
            "with_score": with_run.get("score", {}).get("pass_rate") if with_run else None,
            "without_score": without_run.get("score", {}).get("pass_rate") if without_run else None,
            "with_turns": with_run.get("turns", {}).get("used") if with_run else None,
            "without_turns": without_run.get("turns", {}).get("used") if without_run else None,
            "root_causes": sorted(set(sum((run.get("root_causes", []) for run in run_analyses.values()), []))),
            "bad_actions": sum((run.get("bad_actions", []) for run in run_analyses.values()), []),
            "max_turn_warning": any(run.get("turns", {}).get("reached_max") for run in run_analyses.values()),
            "confidence": round(sum(run.get("confidence", 0.0) for run in run_analyses.values()) / max(1, len(run_analyses)), 2),
            "model_error_count": total_model_errors,
            "has_model_errors": total_model_errors > 0,
            "loaded_skills": all_loaded_skills,
            "delegated_agents": all_delegated_agents,
            # Use the with_skill hash if available; both configs should match.
            "scenario_hash": (with_run or without_run or {}).get("scenario_hash", ""),
        }
        llm_analysis = run_llm_analysis(args, subject, scenario_analysis, with_run, without_run)
        if llm_analysis is not None:
            scenario_analysis["llm_analysis"] = llm_analysis
        write_json(eval_path / "analysis.json", scenario_analysis)
        (eval_path / "analysis.md").write_text(scenario_analysis_md(scenario_analysis))
        scenario_analyses.append(scenario_analysis)
    subject_analysis = {
        "subject": subject,
        "content_hash": run_dir.name,
        "benchmark": benchmark.get("run_summary", {}),
        "scenarios": scenario_analyses,
        "recurring_root_causes": Counter(cause for item in scenario_analyses for cause in item.get("root_causes", [])).most_common(),
        "generated_at": utc_now(),
        "loaded_skills": sorted(set(s for item in scenario_analyses for s in (item.get("loaded_skills") or []))),
        "delegated_agents": list(dict.fromkeys(a for item in scenario_analyses for a in (item.get("delegated_agents") or []))),
        # Aggregated efficiency signals and recommendations across all run analyses
        "efficiency_recs": [
            rec
            for eval_path in sorted(run_dir.glob("eval-*"))
            for config_dir in sorted(p for p in eval_path.iterdir() if p.is_dir())
            for one_run in sorted(config_dir.glob("run-*"))
            for rec in (read_json(one_run / "analysis.json", {}) or {}).get("efficiency_recs", [])
        ],
    }
    write_json(run_dir / "analysis.json", subject_analysis)
    (run_dir / "analysis.md").write_text(subject_analysis_md(subject_analysis))
    return subject_analysis


def scenario_analysis_md(analysis: dict[str, Any]) -> str:
    lines = [f"# Scenario Analysis — {analysis['subject']} eval-{analysis['eval_id']}", ""]
    difficulty = analysis.get("difficulty", "unknown")
    lines.append(f"- difficulty: **{difficulty}**")
    _sc_skills = analysis.get("loaded_skills") or []
    _sc_agents = analysis.get("delegated_agents") or []
    lines.append(f"- loaded skills: {', '.join(_sc_skills) if _sc_skills else '—'}")
    lines.append(f"- delegated agents: {', '.join(_sc_agents) if _sc_agents else '—'}")
    for key in ["skill_impact", "scenario_quality", "with_score", "without_score", "with_turns", "without_turns", "confidence"]:
        lines.append(f"- {key}: {analysis.get(key)}")
    if analysis.get("model_error_count", 0) > 0:
        lines.append(f"- ⚠ model_errors: {analysis['model_error_count']} (may skew pass-rate baselines)")
    if analysis.get("expected_skill_contribution"):
        lines.append("")
        lines.append(f"*Expected skill contribution:* {analysis['expected_skill_contribution']}")
    lines.append("")
    lines.append("## Root causes")
    lines.extend(f"- `{cause}`" for cause in analysis.get("root_causes", []) or ["none"])
    lines.append("")
    lines.append("## Bad actions")
    for item in analysis.get("bad_actions", [])[:20]:
        lines.append(f"- **{item.get('severity')}** `{item.get('type')}` — {item.get('evidence')}")
    if not analysis.get("bad_actions"):
        lines.append("- none detected")
    if analysis.get("llm_analysis"):
        lines.append("")
        lines.append("## LLM comparative analysis")
        lines.append("```json")
        lines.append(json.dumps(analysis["llm_analysis"], indent=2, ensure_ascii=False))
        lines.append("```")
    return "\n".join(lines) + "\n"


def subject_analysis_md(analysis: dict[str, Any]) -> str:
    lines = [f"# Evaluation Analysis — {analysis['subject']}", "", f"Content hash: `{analysis['content_hash']}`", ""]
    lines.append("| Eval | Difficulty | Impact | Quality | With | Without | Turns W/B | Max-turn | Model errs | Confidence | Loaded Skills | Agents | Root causes |")
    lines.append("|---:|---|---|---|---:|---:|---:|---|---:|---:|---|---|---|")
    for item in analysis.get("scenarios", []):
        model_err_col = str(item.get("model_error_count", 0)) if item.get("has_model_errors") else ""
        _row_skills = ' '.join(f'`{s}`' for s in (item.get('loaded_skills') or []))
        _row_agents = ' '.join(f'`{a}`' for a in (item.get('delegated_agents') or []))
        lines.append(
            f"| {item['eval_id']} | {item.get('difficulty','?')} | {item['skill_impact']} | {item['scenario_quality']} | {item.get('with_score')} | {item.get('without_score')} | {item.get('with_turns')}/{item.get('without_turns')} | {'⚠' if item.get('max_turn_warning') else ''} | {model_err_col} | {item.get('confidence')} | {_row_skills or '—'} | {_row_agents or '—'} | {', '.join(item.get('root_causes', []))} |"
        )
    lines.append("")
    lines.append("## Recurring root causes")
    for cause, count in analysis.get("recurring_root_causes", []):
        lines.append(f"- `{cause}`: {count}")
    # Difficulty breakdown
    by_difficulty: dict[str, list[dict[str, Any]]] = {}
    for s in analysis.get("scenarios", []):
        by_difficulty.setdefault(s.get("difficulty", "unknown"), []).append(s)
    if any(v for v in by_difficulty.values()):
        lines.append("")
        lines.append("## By difficulty")
        for diff in ["normal", "difficult", "very_difficult", "unknown"]:
            items = by_difficulty.get(diff, [])
            if not items:
                continue
            impacts = [s.get("skill_impact", "?") for s in items]
            lines.append(f"- **{diff}**: {', '.join(impacts)}")
    return "\n".join(lines) + "\n"


def init_analysis_tables(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT,
                kind TEXT NOT NULL,
                subject TEXT NOT NULL,
                eval_id INTEGER,
                configuration TEXT,
                run_number INTEGER,
                skill_impact TEXT,
                scenario_quality TEXT,
                root_causes_json TEXT,
                bad_actions_json TEXT,
                confidence REAL,
                analysis_path TEXT,
                sequence_path TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_scenario_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT,
                kind TEXT NOT NULL,
                subject TEXT NOT NULL,
                eval_id INTEGER NOT NULL,
                scenario_hash TEXT,
                with_score REAL,
                without_score REAL,
                with_turns REAL,
                without_turns REAL,
                root_cause TEXT,
                skill_impact TEXT,
                scenario_quality TEXT,
                recommended_action TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def persist_analysis(db_path: Path, analyses: list[dict[str, Any]], workspace_root: Path) -> None:
    init_analysis_tables(db_path)
    created = utc_now()
    with sqlite3.connect(db_path) as db:
        for subject_analysis in analyses:
            subject = subject_analysis["subject"]
            run_id = subject_analysis["content_hash"]
            for scenario in subject_analysis.get("scenarios", []):
                root_causes = scenario.get("root_causes", [])
                db.execute(
                    """
                    INSERT INTO eval_scenario_analysis(
                        run_id, kind, subject, eval_id, scenario_hash, with_score, without_score, with_turns, without_turns,
                        root_cause, skill_impact, scenario_quality, recommended_action, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        "skills",
                        subject,
                        scenario.get("eval_id"),
                        scenario.get("scenario_hash", ""),
                        scenario.get("with_score"),
                        scenario.get("without_score"),
                        scenario.get("with_turns"),
                        scenario.get("without_turns"),
                        ",".join(root_causes),
                        scenario.get("skill_impact"),
                        scenario.get("scenario_quality"),
                        recommended_action(scenario),
                        created,
                    ),
                )
                eval_dir = workspace_root / subject / run_id / f"eval-{scenario.get('eval_id')}"
                # Persist efficiency recommendations to eval_feedback
                for rec in (read_json(
                    workspace_root / subject / run_id / f"eval-{scenario.get('eval_id')}"
                    / str(list((workspace_root / subject / run_id / f"eval-{scenario.get('eval_id')}").iterdir())[0].name if (workspace_root / subject / run_id / f"eval-{scenario.get('eval_id')}").exists() else "") / "run-1" / "analysis.json",
                    {}
                ) or {}).get("efficiency_recs", []):
                    try:
                        db.execute(
                            """
                            INSERT INTO eval_feedback(
                                run_id, kind, subject, eval_id, configuration, run_number,
                                recommendation_type, severity, message, evidence, git_commit, provider, model, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                run_id, "skills", subject, scenario.get("eval_id"),
                                rec.get("configuration"), 1,
                                rec.get("recommendation_type", "efficiency"),
                                rec.get("severity"),
                                rec.get("message", "")[:500],
                                (rec.get("evidence", "") + " | ACTION: " + rec.get("action", ""))[:800],
                                None, None, None, created,
                            ),
                        )
                    except Exception:
                        pass  # avoid breaking persist on path issues
                for run_analysis_path in eval_dir.glob("*/run-*/analysis.json"):
                    run = read_json(run_analysis_path, {}) or {}
                    db.execute(
                        """
                        INSERT INTO eval_analysis(
                            run_id, kind, subject, eval_id, configuration, run_number, skill_impact, scenario_quality,
                            root_causes_json, bad_actions_json, confidence, analysis_path, sequence_path, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            run_id,
                            "skills",
                            subject,
                            run.get("eval_id"),
                            run.get("configuration"),
                            run.get("run_number"),
                            scenario.get("skill_impact"),
                            scenario.get("scenario_quality"),
                            json.dumps(run.get("root_causes", [])),
                            json.dumps(run.get("bad_actions", [])),
                            run.get("confidence"),
                            str(run_analysis_path),
                            str(run_analysis_path.with_name("sequence.mmd")),
                            created,
                        ),
                    )


def recommended_action(scenario: dict[str, Any]) -> str:
    causes = set(scenario.get("root_causes", []))
    if "runner_audit_issue" in causes:
        return "Improve runner audit extraction before changing skill text."
    if "turn_budget_issue" in causes:
        return "Add stop rules or split the scenario before judging skill quality."
    if "skill_gap" in causes:
        return "Update skill instructions and rerun this scenario."
    if scenario.get("scenario_quality") != "good":
        return "Revise scenario design and rerun."
    return "Review feedback and rerun if needed."


def ranked_recommendations(analyses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate ranked P0/P1 recommendations from suite analysis results."""
    recs: list[dict[str, Any]] = []
    for item in analyses:
        subject = item["subject"]
        scenarios = item.get("scenarios", [])
        n = len(scenarios)
        if n == 0:
            continue
        # P0: negative delta (skill actively hurts — fix skill or fixture first)
        for s in scenarios:
            if s.get("skill_impact") == "negative":
                recs.append({
                    "priority": "P0",
                    "subject": subject,
                    "eval_id": s.get("eval_id"),
                    "difficulty": s.get("difficulty", "?"),
                    "issue": "negative_delta",
                    "message": f"Skill delta is negative (with={s.get('with_score')}, without={s.get('without_score')}). Fix skill instructions or scenario discriminant.",
                    "action": "Check expected_skill_contribution; update skill or revise expected_behavior.",
                })
        # P0: high max-turn saturation (>= 2/3 scenarios hit max turns)
        max_hit = sum(1 for s in scenarios if s.get("max_turn_warning"))
        if n > 0 and max_hit / n >= 2 / 3:
            recs.append({
                "priority": "P0",
                "subject": subject,
                "eval_id": None,
                "difficulty": None,
                "issue": "max_turn_saturation",
                "message": f"{max_hit}/{n} scenarios hit max turns. Reduce per-scenario max_turns or add stop-rule expected_behavior.",
                "action": "Lower max_turns in eval JSON; add handoff/stop items to expected_behavior.",
            })
        # P1: neutral delta scenarios
        for s in scenarios:
            if s.get("skill_impact") == "neutral":
                recs.append({
                    "priority": "P1",
                    "subject": subject,
                    "eval_id": s.get("eval_id"),
                    "difficulty": s.get("difficulty", "?"),
                    "issue": "neutral_delta",
                    "message": f"Skill delta is neutral (with={s.get('with_score')}, without={s.get('without_score')}). Scenario may not test skill-specific behaviour.",
                    "action": "Add skill-specific expected_behavior items baseline cannot pass (e.g. required format, domain terms).",
                })
        # P1: efficiency issue (pass_rate=1.0 AND max_turns_reached)
        for s in scenarios:
            if s.get("max_turn_warning") and s.get("with_score") == 1.0 and s.get("without_score") == 1.0:
                recs.append({
                    "priority": "P1",
                    "subject": subject,
                    "eval_id": s.get("eval_id"),
                    "difficulty": s.get("difficulty", "?"),
                    "issue": "efficiency_and_full_score",
                    "message": f"Both configs score 1.0 AND hit max turns — likely answer-key leakage in fixture_description or query.",
                    "action": "Neutralise fixture_description; remove query hints; add discriminant expected_behavior.",
                })
        # P1: model errors
        for s in scenarios:
            if s.get("has_model_errors"):
                recs.append({
                    "priority": "P1",
                    "subject": subject,
                    "eval_id": s.get("eval_id"),
                    "difficulty": s.get("difficulty", "?"),
                    "issue": "model_errors",
                    "message": f"{s.get('model_error_count', 0)} model error(s) detected — pass rates may be skewed.",
                    "action": "Investigate content-filter triggers; consider retry policy or prompt adjustments.",
                })
    # Sort: P0 before P1, then by subject
    recs.sort(key=lambda r: (r["priority"], r["subject"], r.get("eval_id") or 0))
    return recs


def write_suite_summary(workspace_root: Path, analyses: list[dict[str, Any]]) -> None:
    recs = ranked_recommendations(analyses)
    summary = {"generated_at": utc_now(), "subjects": analyses, "recommendations": recs}
    write_json(workspace_root / "analysis-summary.json", summary)
    lines = ["# Skill Evaluation Analysis Summary", ""]
    # Ranked recommendations
    if recs:
        lines.append("## Ranked recommendations")
        lines.append("")
        lines.append("| Priority | Subject | Eval | Difficulty | Issue | Message | Action |")
        lines.append("|---|---|---|---|---|---|---|")
        for r in recs:
            eid = str(r["eval_id"]) if r.get("eval_id") is not None else "—"
            diff = r.get("difficulty") or "—"
            lines.append(f"| **{r['priority']}** | {r['subject']} | {eid} | {diff} | `{r['issue']}` | {r['message']} | {r['action']} |")
        lines.append("")
    lines.append("## Subject summary")
    lines.append("")
    lines.append("| Subject | Hash | Scenarios | Negative/Neutral | Max-turn warnings | Recurring root causes |")
    lines.append("|---|---|---:|---:|---:|---|")
    for item in analyses:
        causes = ", ".join(f"{cause}({count})" for cause, count in item.get("recurring_root_causes", []))
        negative_neutral = sum(1 for scenario in item.get('scenarios', []) if scenario.get('skill_impact') in {'negative', 'neutral'})
        max_warnings = sum(1 for scenario in item.get('scenarios', []) if scenario.get('max_turn_warning'))
        lines.append(f"| {item['subject']} | `{item['content_hash']}` | {len(item.get('scenarios', []))} | {negative_neutral} | {max_warnings} | {causes} |")
    (workspace_root / "analysis-summary.md").write_text("\n".join(lines) + "\n")
    (workspace_root / "analysis-index.html").write_text(render_html_summary(analyses, recs))


def render_html_summary(analyses: list[dict[str, Any]], recs: list[dict[str, Any]] | None = None) -> str:
    import html as _html
    recs = recs or []
    rec_rows = []
    for r in recs:
        priority_class = "p0" if r["priority"] == "P0" else "p1"
        eid = str(r["eval_id"]) if r.get("eval_id") is not None else "—"
        diff = r.get("difficulty") or "—"
        rec_rows.append(
            f"<tr class='{priority_class}'>"
            f"<td><strong>{_html.escape(r['priority'])}</strong></td>"
            f"<td>{_html.escape(r['subject'])}</td>"
            f"<td>{_html.escape(eid)}</td>"
            f"<td>{_html.escape(diff)}</td>"
            f"<td><code>{_html.escape(r['issue'])}</code></td>"
            f"<td>{_html.escape(r['message'])}</td>"
            f"<td>{_html.escape(r['action'])}</td>"
            "</tr>"
        )
    rows = []
    for item in analyses:
        causes = ", ".join(f"{cause}({count})" for cause, count in item.get("recurring_root_causes", []))
        negative_neutral = sum(1 for scenario in item.get('scenarios', []) if scenario.get('skill_impact') in {'negative', 'neutral'})
        max_warnings = sum(1 for scenario in item.get('scenarios', []) if scenario.get('max_turn_warning'))
        row_class = "warn" if max_warnings or negative_neutral else "ok"
        _skills_html = " ".join(f"<code>{_html.escape(s)}</code>" for s in item.get("loaded_skills", []))
        _agents_html = " ".join(f"<code>{_html.escape(a)}</code>" for a in item.get("delegated_agents", []))
        rows.append(f"<tr class='{row_class}'><td>{_html.escape(item['subject'])}</td><td><code>{_html.escape(item['content_hash'])}</code></td><td>{len(item.get('scenarios', []))}</td><td>{negative_neutral}</td><td>{max_warnings}</td><td>{_skills_html or '—'}</td><td>{_agents_html or '—'}</td><td>{_html.escape(causes)}</td><td><a href='{_html.escape(item['subject'])}/{_html.escape(item['content_hash'])}/analysis.md'>analysis.md</a></td></tr>")
    rec_section = ""
    if rec_rows:
        rec_section = (
            "<h2>Ranked recommendations</h2>"
            "<table><thead><tr><th>Priority</th><th>Subject</th><th>Eval</th><th>Difficulty</th>"
            "<th>Issue</th><th>Message</th><th>Action</th></tr></thead>"
            f"<tbody>{''.join(rec_rows)}</tbody></table>"
        )
    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>Skill Eval Analysis</title>
<style>
body{{font-family:system-ui;margin:2rem;color:#1f2937}}
table{{border-collapse:collapse;width:100%;margin-bottom:2rem}}
td,th{{border:1px solid #ddd;padding:.5rem;text-align:left;vertical-align:top}}
th{{background:#f3f4f6}}
code{{background:#eee;padding:.1rem .25rem;border-radius:.2rem}}
.warn{{background:#fff7ed}}.ok{{background:#f0fdf4}}
.p0{{background:#fee2e2}}.p1{{background:#fef9c3}}
a{{color:#2563eb}}
</style>
</head><body>
<h1>Skill Evaluation Analysis</h1>
{rec_section}
<h2>Subject summary</h2>
<p>Rows highlighted when scenarios are neutral/negative or hit max turns.</p>
<table><thead><tr><th>Subject</th><th>Hash</th><th>Scenarios</th><th>Negative/Neutral</th><th>Max-turn warnings</th><th>Loaded Skills</th><th>Delegated Agents</th><th>Root causes</th><th>Links</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table>
</body></html>"""

def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze generated skill eval artifacts.")
    parser.add_argument("--workspace-root", type=Path, default=DEFAULT_WORKSPACE_ROOT)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--skill")
    parser.add_argument("--hash")
    parser.add_argument("--scenario", type=int)
    parser.add_argument("--no-sqlite", action="store_true")
    parser.add_argument("--llm", action="store_true", help="Run comparative LLM root-cause analysis for each scenario.")
    parser.add_argument("--goose-cli", help="Goose CLI binary for --llm analysis. Defaults to $GOOSE_EVAL_CLI or goose.")
    parser.add_argument("--provider")
    parser.add_argument("--model")
    parser.add_argument("--llm-timeout", type=int, default=300)
    parser.add_argument("--llm-max-turns", type=int, default=2)
    parser.add_argument("--check", action="store_true",
                        help="Enable quality gate checking. Exits 1 if hard thresholds are violated.")
    parser.add_argument("--max-turn-threshold", type=float, default=0.75, metavar="RATE",
                        help="Gate: FAIL if max-turn hit rate across scenarios exceeds this fraction (default: 0.5).")
    parser.add_argument("--negative-delta-gate", action="store_true",
                        help="Gate: WARN if any subject has one or more negative skill delta scenarios.")
    parser.add_argument("--efficiency-gate", action="store_true",
                        help="Gate: WARN if any scenario has pass_rate=1.0 AND max_turns_reached (answer-key leakage suspected).")
    args = parser.parse_args()

    analyses = []
    for subject_dir in discover_subjects(args.workspace_root, args.skill):
        analysis = analyze_subject(subject_dir, args)
        if analysis:
            analyses.append(analysis)
    write_suite_summary(args.workspace_root, analyses)
    if not args.no_sqlite:
        persist_analysis(args.db, analyses, args.workspace_root)
    print(f"Analyzed {len(analyses)} subjects under {args.workspace_root}")
    print(f"Summary: {args.workspace_root / 'analysis-summary.md'}")

    if args.check:
        gate_failures: list[str] = []
        gate_warnings: list[str] = []
        for analysis in analyses:
            subject = analysis["subject"]
            scenarios = analysis.get("scenarios", [])
            n = len(scenarios)
            if n == 0:
                continue
            # Hard gate: max-turn hit rate
            max_turn_hit_count = sum(1 for s in scenarios if s.get("max_turn_warning"))
            max_turn_rate = max_turn_hit_count / n
            if max_turn_rate > args.max_turn_threshold:
                gate_failures.append(
                    f"FAIL [{subject}]: max-turn hit rate {max_turn_rate:.0%} > threshold {args.max_turn_threshold:.0%} "
                    f"({max_turn_hit_count}/{n} scenarios)"
                )
            # Soft gate: negative delta
            if args.negative_delta_gate:
                neg_count = sum(1 for s in scenarios if s.get("skill_impact") == "negative")
                if neg_count > 0:
                    gate_warnings.append(
                        f"WARN [{subject}]: {neg_count} scenario(s) with negative skill delta"
                    )
            # Soft gate: efficiency (pass_rate=1.0 but max turns hit)
            if args.efficiency_gate:
                for s in scenarios:
                    diff = s.get("difficulty", "?")
                    eid = s.get("eval_id", "?")
                    if s.get("max_turn_warning") and s.get("with_score") == 1.0:
                        gate_warnings.append(
                            f"WARN [{subject}] eval-{eid} ({diff}): with_skill pass_rate=1.0 AND max_turns_reached "
                            f"— possible answer-key leakage or scenario too easy"
                        )
                    if s.get("max_turn_warning") and s.get("without_score") == 1.0:
                        gate_warnings.append(
                            f"WARN [{subject}] eval-{eid} ({diff}): without_skill pass_rate=1.0 AND max_turns_reached "
                            f"— baseline contamination suspected"
                        )
            # Efficiency gates: read from eval_analysis.efficiency_json via DB
            # (only when DB is available and --efficiency-gate is set)
            if args.efficiency_gate and not args.no_sqlite and args.db.exists():
                try:
                    _edb = __import__("sqlite3").connect(args.db)
                    _erows = _edb.execute(
                        "SELECT ea.eval_id, ea.configuration, ea.efficiency_json "
                        "FROM eval_analysis ea "
                        "INNER JOIN (SELECT eval_id, configuration, MAX(created_at) lat "
                        "            FROM eval_analysis WHERE subject=? AND efficiency_json IS NOT NULL "
                        "            GROUP BY eval_id, configuration) L "
                        "ON ea.eval_id=L.eval_id AND ea.configuration=L.configuration AND ea.created_at=L.lat "
                        "WHERE ea.subject=?",
                        (subject, subject)
                    ).fetchall()
                    _edb.close()
                    for _eid, _cfg, _ejson in _erows:
                        _eff = __import__("json").loads(_ejson or "{}")
                        _total = max(1, _eff.get("tool_calls_total", 1))
                        _err_r = _eff.get("failed_tool_calls", 0) / _total
                        _expl  = _eff.get("explore_pct", 0)
                        _rep   = _eff.get("repeated_commands_count", 0)
                        if _err_r >= EFF_ERROR_RATE_HIGH:
                            gate_warnings.append(
                                f"WARN [{subject}] eval-{_eid} {_cfg}: "
                                f"error rate {_err_r:.0%} >= {EFF_ERROR_RATE_HIGH:.0%} threshold — "
                                "add error-handling guidance to skill."
                            )
                        if _expl >= EFF_EXPLORE_HIGH:
                            gate_warnings.append(
                                f"WARN [{subject}] eval-{_eid} {_cfg}: "
                                f"exploration {_expl:.0%} >= {EFF_EXPLORE_HIGH:.0%} — "
                                "add 'read at most N files' stop rule to skill."
                            )
                        if _rep >= EFF_REPEATED_HIGH:
                            gate_warnings.append(
                                f"WARN [{subject}] eval-{_eid} {_cfg}: "
                                f"{_rep} repeated commands — "
                                "add thrashing/loop detection guidance to skill."
                            )
                except Exception:
                    pass  # DB not readable — skip efficiency gates

            # Soft gate: model errors
            for s in scenarios:
                if s.get("has_model_errors"):
                    gate_warnings.append(
                        f"WARN [{subject}] eval-{s.get('eval_id', '?')} ({s.get('difficulty','?')}): "
                        f"{s.get('model_error_count', 0)} model error(s) detected — runs may skew baselines"
                    )

        print("\n## Quality Gate\n")
        for item in gate_failures + gate_warnings:
            print(f"  {item}")
        if not gate_failures and not gate_warnings:
            print("  All checks passed.")
        if gate_failures:
            print(f"\nQuality gate: FAIL ({len(gate_failures)} failure(s), {len(gate_warnings)} warning(s))")
            return 1
        elif gate_warnings:
            print(f"\nQuality gate: WARN ({len(gate_warnings)} warning(s))")
        else:
            print("\nQuality gate: PASS")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
