#!/usr/bin/env python3
"""Pure deterministic policy guard for one loop transition."""
import json, sys
from datetime import datetime, timezone

ACTIVE = {"CONTINUE", "REWORK", "REPLAN"}
SUPPORTED = ACTIVE | {"WAIT", "COMPLETE", "ESCALATE", "ABORT"}

def _count(s, key, default=0):
    value = s.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(key + " must be a non-negative integer")
    return value

def _time(value, name):
    if isinstance(value, str):
        try: value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error: raise ValueError(name + " must be ISO-8601") from error
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError(name + " must be a timezone-aware instant")
    return value.astimezone(timezone.utc)

def _result(allowed, transition, reason, tier=None):
    return {"allowed": allowed, "transition": transition, "reason": reason, "tier": tier}

def evaluate(snapshot, now):
    """Evaluate only supplied durable state; never read ambient time or storage."""
    if not isinstance(snapshot, dict): raise ValueError("snapshot must be an object")
    requested = snapshot.get("transition", snapshot.get("loop_transition"))
    if requested not in SUPPORTED: raise ValueError("unsupported transition")
    current = _time(now, "now")
    external = snapshot.get("external_dependency")
    if external is not None:
        if not isinstance(external, dict): raise ValueError("external_dependency must be an object")
        if not external.get("resume_condition"):
            return _result(False, "ABORT", "WAIT_REQUIRES_RESUME_CONDITION")
        return _result(False, "WAIT", "EXTERNAL_DEPENDENCY")
    if requested == "WAIT": return _result(False, "ABORT", "WAIT_REQUIRES_EXTERNAL_DEPENDENCY")
    tier = None
    if requested in ACTIVE:
        due = snapshot.get("due_at", snapshot.get("time_budget_expires_at"))
        if due is not None and current >= _time(due, "due_at"):
            return _result(False, "ABORT", "TIME_BUDGET_EXHAUSTED")
        if _count(snapshot, "loop_iteration") >= _count(snapshot, "loop_max_iterations"):
            return _result(False, "ABORT", "MAX_ITERATIONS_REACHED")
        if _count(snapshot, "loop_no_progress_count") >= _count(snapshot, "loop_max_no_progress"):
            return _result(False, "ABORT", "MAX_NO_PROGRESS_REACHED")
        signatures = snapshot.get("failure_signatures", [])
        if not isinstance(signatures, list): raise ValueError("failure_signatures must be an array")
        repeated = _count(snapshot, "repeated_failure_count") >= 2 or (len(signatures) >= 2 and signatures[-1] is not None and signatures[-1] == signatures[-2])
        changed = snapshot.get("changed_evidence", False)
        if not isinstance(changed, bool): raise ValueError("changed_evidence must be boolean")
        if repeated and not changed:
            return _result(False, "ABORT", "REPEATED_UNCHANGED_FAILURE")
        if not snapshot.get("next_task"): return _result(False, "ABORT", "NEXT_TASK_REQUIRED")
        if not snapshot.get("expected_proof"): return _result(False, "ABORT", "EXPECTED_PROOF_REQUIRED")
        if requested == "REWORK":
            count = _count(snapshot, "rework_count")
            if count >= 4: return _result(False, "ABORT", "REWORK_BUDGET_EXHAUSTED")
            tier = "standard" if count <= 1 else "premium"
    return _result(True, requested, "ALLOWED", tier)

def main():
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict) or "snapshot" not in payload or "now" not in payload: raise ValueError("input must contain snapshot and now")
        json.dump(evaluate(payload["snapshot"], payload["now"]), sys.stdout, sort_keys=True); print()
        return 0
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        json.dump({"error": str(error)}, sys.stderr, sort_keys=True); print(file=sys.stderr)
        return 2
if __name__ == "__main__": raise SystemExit(main())
