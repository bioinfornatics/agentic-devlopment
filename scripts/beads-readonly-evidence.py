#!/usr/bin/env python3
"""Read-only Beads evidence adapter."""
import argparse, json, hashlib
from collections import Counter, defaultdict
from pathlib import Path
parser = argparse.ArgumentParser(description="Emit read-only Beads evidence from .beads/issues.jsonl")
parser.add_argument("--issues", default=".beads/issues.jsonl")
parser.add_argument("--format", choices=["json", "md"], default="md")
args = parser.parse_args()
path = Path(args.issues); raw = path.read_bytes(); issues = []; invalid = []
for i, line in enumerate(raw.decode("utf-8").splitlines(), 1):
    if not line.strip(): continue
    try: issues.append(json.loads(line))
    except Exception as exc: invalid.append({"line": i, "error": str(exc)})
by_status = Counter(str(x.get("status", "unknown")) for x in issues)
by_type = Counter(str(x.get("issue_type", x.get("type", "unknown"))) for x in issues)
by_priority = Counter(str(x.get("priority", "unknown")) for x in issues)
links = defaultdict(int); dependency_types = Counter(); dependent_ids = set(); parent_links = 0
for x in issues:
    dependencies = x.get("dependencies") or []
    if isinstance(dependencies, list):
        links["dependencies"] += len(dependencies)
        for dep in dependencies:
            if isinstance(dep, dict):
                dependency_types[str(dep.get("type", "unknown"))] += 1
                if dep.get("depends_on_id"): dependent_ids.add(x.get("id"))
    for key in ("depends_on", "blocked_by", "children"):
        value = x.get(key)
        if isinstance(value, list): links[key] += len(value)
        elif value: links[key] += 1
    if x.get("parent") or x.get("epic_id") or any(isinstance(d, dict) and d.get("type") == "parent-child" for d in dependencies):
        parent_links += 1
blocked = [x for x in issues if str(x.get("status", "")).lower() in {"blocked", "blocker"} or x.get("blocked_by") or x.get("depends_on") or x.get("id") in dependent_ids or int(x.get("dependency_count", 0) or 0) > 0]
ready = [x for x in issues if str(x.get("status", "")).lower() in {"open", "ready", "todo"} and x not in blocked]
summary = {"source":str(path),"sha256":hashlib.sha256(raw).hexdigest(),"issue_count":len(issues),"invalid_json_lines":invalid,"by_status":dict(sorted(by_status.items())),"by_type":dict(sorted(by_type.items())),"by_priority":dict(sorted(by_priority.items())),"ready_count":len(ready),"blocked_or_dependent_count":len(blocked),"dependency_link_counts":dict(sorted(links.items())),"dependency_type_counts":dict(sorted(dependency_types.items())),"epic_or_parent_link_count":parent_links,"sample_ready_ids":[x.get("id") for x in ready[:10]],"sample_blocked_or_dependent_ids":[x.get("id") for x in blocked[:10]]}
if args.format == "json": print(json.dumps(summary, indent=2, sort_keys=True))
else:
    print("# Beads Read-only Evidence")
    for label,key in (("Source","source"),("SHA256","sha256"),("Issues","issue_count"),("Invalid JSON lines","invalid_json_lines"),("Ready","ready_count"),("Blocked/dependent","blocked_or_dependent_count"),("Epic/parent links","epic_or_parent_link_count")): print(f"- {label}: {len(summary[key]) if key == 'invalid_json_lines' else summary[key]}")
    for title,key in (("Status counts","by_status"),("Type counts","by_type"),("Priority counts","by_priority"),("Dependency fields","dependency_link_counts"),("Dependency types","dependency_type_counts")):
        print(f"\n## {title}"); [print(f"- {k}: {v}") for k,v in summary[key].items()]
    print("\n## Samples"); print("- Ready IDs: " + ", ".join(map(str,summary["sample_ready_ids"]))); print("- Blocked/dependent IDs: " + ", ".join(map(str,summary["sample_blocked_or_dependent_ids"])))
