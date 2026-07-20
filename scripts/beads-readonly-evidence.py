#!/usr/bin/env python3
"""Read-only Beads evidence adapter."""
import argparse, json, hashlib
from collections import Counter, defaultdict
from pathlib import Path
parser = argparse.ArgumentParser(description="Emit read-only Beads evidence from .beads/issues.jsonl")
parser.add_argument("--issues", default=".beads/issues.jsonl")
parser.add_argument("--format", choices=["json", "md"], default="md")
args = parser.parse_args()
path = Path(args.issues)
raw = path.read_bytes()
issues = []
invalid = []
for i, line in enumerate(raw.decode("utf-8").splitlines(), 1):
    if not line.strip(): continue
    try: issues.append(json.loads(line))
    except Exception as exc: invalid.append({"line": i, "error": str(exc)})
by_status = Counter(str(x.get("status", "unknown")) for x in issues)
by_type = Counter(str(x.get("type", "unknown")) for x in issues)
by_priority = Counter(str(x.get("priority", "unknown")) for x in issues)
blocked = [x for x in issues if str(x.get("status", "")).lower() in {"blocked", "blocker"} or x.get("blocked_by") or x.get("depends_on")]
ready = [x for x in issues if str(x.get("status", "")).lower() in {"open", "ready", "todo"} and not x.get("blocked_by")]
links = defaultdict(int)
for x in issues:
    for key in ("depends_on", "blocked_by", "children", "parent", "epic_id"):
        v = x.get(key)
        if isinstance(v, list): links[key] += len(v)
        elif v: links[key] += 1
summary = {"source": str(path), "sha256": hashlib.sha256(raw).hexdigest(), "issue_count": len(issues), "invalid_json_lines": invalid, "by_status": dict(sorted(by_status.items())), "by_type": dict(sorted(by_type.items())), "by_priority": dict(sorted(by_priority.items())), "ready_count": len(ready), "blocked_or_dependent_count": len(blocked), "dependency_link_counts": dict(sorted(links.items())), "sample_ready_ids": [x.get("id") for x in ready[:10]], "sample_blocked_or_dependent_ids": [x.get("id") for x in blocked[:10]]}
if args.format == "json":
    print(json.dumps(summary, indent=2, sort_keys=True))
else:
    print("# Beads Read-only Evidence")
    print(f"\n- Source: {summary['source']}")
    print(f"- SHA256: {summary['sha256']}")
    print(f"- Issues: {summary['issue_count']}")
    print(f"- Invalid JSON lines: {len(invalid)}")
    print("\n## Status counts")
    for k, v in summary["by_status"].items(): print(f"- {k}: {v}")
    print("\n## Type counts")
    for k, v in summary["by_type"].items(): print(f"- {k}: {v}")
    print("\n## Priority counts")
    for k, v in summary["by_priority"].items(): print(f"- {k}: {v}")
    print("\n## Dependency fields")
    for k, v in summary["dependency_link_counts"].items(): print(f"- {k}: {v}")
    print("\n## Samples")
    print("- Ready IDs: " + ", ".join(str(x) for x in summary["sample_ready_ids"]))
    print("- Blocked/dependent IDs: " + ", ".join(str(x) for x in summary["sample_blocked_or_dependent_ids"]))
