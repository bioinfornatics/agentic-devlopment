#!/usr/bin/env python3
"""
KG Bootstrap — populate .knowledge/memory.jsonl from current harness state.

Reads: .agents/agents/*.md, .agents/skills/*/SKILL.md, .goose/recipes/*.yaml, docs/*.md
Writes: .knowledge/memory.jsonl (appends new entities/relations, skips existing)
Idempotent: MCP server ignores duplicate entities.

Usage:
    python3 scripts/kg-bootstrap.py                   # bootstrap harness layer
    python3 scripts/kg-bootstrap.py --product src/    # add product layer from source
"""
import json, pathlib, re, sys, argparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
KG   = ROOT / ".knowledge" / "memory.jsonl"

def ent(name, etype, obs):
    return {"type": "entity", "name": name, "entityType": etype, "observations": obs}

def rel(from_, to, rtype):
    return {"type": "relation", "from": from_, "to": to, "relationType": rtype}

def load_existing(path):
    existing = set()
    if path.exists():
        for line in path.read_text().splitlines():
            try:
                d = json.loads(line)
                if d["type"] == "entity":
                    existing.add(d["name"])
            except Exception:
                pass
    return existing

def append_new(path, records, existing):
    new_records = []
    for r in records:
        if r["type"] == "entity" and r["name"] in existing:
            continue
        new_records.append(r)
    if new_records:
        with open(path, "a") as f:
            for r in new_records:
                f.write(json.dumps(r) + "\n")
    return len(new_records)

def bootstrap_harness(root):
    records = []

    # Agents
    for f in sorted((root / ".agents" / "agents").glob("*.md")):
        name = f.stem
        records.append(ent(f"agent:{name}", "harness:agent",
            [f"file: .agents/agents/{name}.md", "scope: buildtime", "namespace: harness"]))

    # Skills
    for f in sorted((root / ".agents" / "skills").glob("*/SKILL.md")):
        name = f.parent.name
        records.append(ent(f"skill:{name}", "harness:skill",
            [f"file: .agents/skills/{name}/SKILL.md", "scope: buildtime", "namespace: harness"]))

    # Recipes
    for f in sorted((root / ".goose" / "recipes").glob("*.yaml")):
        name = f.stem
        records.append(ent(f"recipe:{name}", "harness:recipe",
            [f"file: .goose/recipes/{name}.yaml", f"slash: /{name}",
             "scope: buildtime", "namespace: harness"]))

    # Docs
    for f in sorted((root / "docs").glob("*.md")):
        records.append(ent(f"doc:{f.name}", "harness:doc",
            [f"file: docs/{f.name}", "scope: buildtime", "namespace: harness"]))

    # Key relations
    RECIPE_SKILLS = {
        "dev": "agentic-dev-harness", "review": "code-review",
        "implement": "beads-harness", "spec": "sdd", "discover": "sdd",
        "plan": "beads-harness", "verify": "webapp-testing",
        "design": "ux-quality", "sdd": "sdd",
    }
    RECIPE_AGENTS = {
        "review": "review-critic", "implement": "implementation-worker",
        "discover": "product-owner", "spec": "architect",
        "plan": "beads-planner", "verify": "qa-automation",
        "design": "ux-researcher",
    }
    for r, s in RECIPE_SKILLS.items():
        if (root / ".goose" / "recipes" / f"{r}.yaml").exists():
            records.append(rel(f"recipe:{r}", f"skill:{s}", "USES_SKILL"))
    for r, a in RECIPE_AGENTS.items():
        if (root / ".goose" / "recipes" / f"{r}.yaml").exists():
            records.append(rel(f"recipe:{r}", f"agent:{a}", "DELEGATES_TO"))

    return records

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", help="Source root to scan for product layer entities")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    KG.parent.mkdir(exist_ok=True)
    existing = load_existing(KG)

    records = bootstrap_harness(ROOT)

    if args.product:
        src = pathlib.Path(args.product)
        # Scan for source files — create code_file entities
        for ext in ["*.py","*.ts","*.tsx","*.js","*.jsx","*.go","*.rs","*.java"]:
            for f in sorted(src.rglob(ext)):
                rel_path = str(f.relative_to(ROOT))
                records.append(ent(rel_path, "code_file",
                    ["scope: buildtime", f"path: {rel_path}"]))

    if args.dry_run:
        new = [r for r in records if r["type"]=="entity" and r["name"] not in existing]
        print(f"Dry-run: {len(new)} new entities would be added (skipping {len(records)-len(new)} existing)")
        return

    added = append_new(KG, records, existing)
    total = sum(1 for l in KG.read_text().splitlines() if l.strip())
    print(f"Added {added} records. KG total: {total} lines ({KG})")

if __name__ == "__main__":
    main()
