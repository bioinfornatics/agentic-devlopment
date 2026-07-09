#!/usr/bin/env python3
"""
KG Reasoner — forward chaining rules on .knowledge/memory.jsonl
Produces .knowledge/derived.jsonl with inferred relations and status facts.

Usage:
    python3 scripts/kg-reason.py                    # reason + write derived.jsonl
    python3 scripts/kg-reason.py --dry-run          # show rules without writing
    python3 scripts/kg-reason.py --rules            # list all active rules
"""
import json, pathlib, sys, argparse, collections
from datetime import datetime

ROOT   = pathlib.Path(__file__).resolve().parents[1]
MEMORY = ROOT / ".knowledge" / "memory.jsonl"
DERIVED = ROOT / ".knowledge" / "derived.jsonl"

# ── Loader ────────────────────────────────────────────────────────────────────

def load_kg(path):
    entities, relations = {}, []
    if not path.exists(): return entities, relations
    for line in path.read_text().splitlines():
        try:
            d = json.loads(line)
            if d["type"] == "entity":
                entities[d["name"]] = d
            elif d["type"] == "relation":
                relations.append(d)
        except Exception: pass
    return entities, relations

def rel_key(f, t, r): return (f, t, r)

# ── Rule engine ───────────────────────────────────────────────────────────────

def forward_chain(entities, base_relations, rules, max_iter=10):
    """Naive forward chaining: apply rules until fixed point."""
    all_rels = list(base_relations)
    rel_set  = set(rel_key(r["from"], r["to"], r["relationType"]) for r in all_rels)

    for iteration in range(max_iter):
        new_rels = []
        for rule in rules:
            derived = rule(entities, all_rels, rel_set)
            for d in derived:
                k = rel_key(d["from"], d["to"], d["relationType"])
                if k not in rel_set:
                    rel_set.add(k)
                    all_rels.append(d)
                    new_rels.append(d)
        if not new_rels:
            break

    return [r for r in all_rels if r not in base_relations]

def make_rel(frm, to, rtype, confidence=1.0, rule_name=""):
    return {
        "type": "relation",
        "from": frm, "to": to, "relationType": rtype,
        "derived": True,
        "confidence": confidence,
        "rule": rule_name,
        "inferred_at": datetime.utcnow().isoformat()
    }

def make_status(entity_name, status, reason, rule_name=""):
    """Status as a relation to a synthetic status node."""
    return {
        "type": "relation",
        "from": entity_name,
        "to": f"status:{status}",
        "relationType": "HAS_STATUS",
        "derived": True,
        "status_value": status,
        "reason": reason,
        "rule": rule_name,
        "inferred_at": datetime.utcnow().isoformat()
    }

# ── Rules ─────────────────────────────────────────────────────────────────────

def rule_ac_test_gap(entities, relations, rel_set):
    """R1: acceptance_criterion with no VALIDATES incoming → test-gap."""
    acs = [e for e in entities.values() if e["entityType"] == "acceptance_criterion"]
    validated = {r["to"] for r in relations if r["relationType"] == "VALIDATES"}
    derived = []
    for ac in acs:
        if ac["name"] not in validated:
            derived.append(make_status(ac["name"], "test-gap",
                f"{ac['name']} has no test that VALIDATES it — spec-anchored coverage gap",
                rule_name="R1:ac-test-gap"))
    return derived

def rule_feature_not_decomposed(entities, relations, rel_set):
    """R2: feature with no REFINED_INTO user_story → not-decomposed."""
    features = [e for e in entities.values() if e["entityType"] == "feature"]
    refined = {r["from"] for r in relations if r["relationType"] == "REFINED_INTO"}
    derived = []
    for f in features:
        if f["name"] not in refined:
            derived.append(make_status(f["name"], "not-decomposed",
                f"{f['name']} has no user_story via REFINED_INTO",
                rule_name="R2:feature-not-decomposed"))
    return derived

def rule_feature_not_implemented(entities, relations, rel_set):
    """R3: feature with no IMPLEMENTS incoming → not-implemented."""
    features = {e["name"] for e in entities.values() if e["entityType"] == "feature"}
    implemented = {r["to"] for r in relations if r["relationType"] == "IMPLEMENTS"}
    derived = []
    for fname in features:
        if fname not in implemented:
            derived.append(make_status(fname, "not-implemented",
                f"{fname} has nothing that IMPLEMENTS it",
                rule_name="R3:feature-not-implemented"))
    return derived

def rule_recipe_transitive_skill(entities, relations, rel_set):
    """R4: recipe USES_SKILL skill AND skill LOADS skill2 → recipe TRANSITIVELY_USES skill2."""
    uses = [(r["from"], r["to"]) for r in relations if r["relationType"] == "USES_SKILL"]
    loads = {(r["from"], r["to"]) for r in relations if r["relationType"] == "LOADS" or r["relationType"] == "REFERENCED_BY"}
    derived = []
    for recipe, skill1 in uses:
        for s1, s2 in loads:
            if s1 == skill1:
                k = rel_key(recipe, s2, "TRANSITIVELY_USES")
                if k not in rel_set:
                    derived.append(make_rel(recipe, s2, "TRANSITIVELY_USES", 0.9,
                        rule_name="R4:transitive-skill"))
    return derived

def rule_epic_completeness(entities, relations, rel_set):
    """R5: epic where all features are HAS_STATUS not-implemented → epic-blocked."""
    epics = [e for e in entities.values() if e["entityType"] == "epic"]
    decomp = collections.defaultdict(list)
    for r in relations:
        if r["relationType"] == "DECOMPOSES_INTO":
            decomp[r["to"]].append(r["from"])  # epic → features
    not_impl = {r["from"] for r in relations if r.get("status_value") == "not-implemented"}
    derived = []
    for epic in epics:
        feats = decomp[epic["name"]]
        if feats and all(f in not_impl for f in feats):
            derived.append(make_status(epic["name"], "blocked",
                f"All {len(feats)} features of {epic['name']} are not-implemented",
                rule_name="R5:epic-blocked"))
    return derived

def rule_recipe_agent_skill_triangle(entities, relations, rel_set):
    """R6: recipe DELEGATES_TO agent AND agent LOADS skill BUT recipe NOT USES_SKILL skill
       → potential skill-mismatch (agent loads skill not declared in recipe)."""
    delegates = [(r["from"], r["to"]) for r in relations if r["relationType"] == "DELEGATES_TO"]
    agent_loads = {(r["from"], r["to"]) for r in relations if r["relationType"] == "LOADS"}
    recipe_uses = {(r["from"], r["to"]) for r in relations if r["relationType"] == "USES_SKILL"}
    derived = []
    for recipe, agent in delegates:
        for ag, skill in agent_loads:
            if ag == agent and (recipe, skill) not in recipe_uses:
                derived.append(make_rel(recipe, skill, "AGENT_LOADS_UNDECLARED_SKILL", 0.7,
                    rule_name="R6:undeclared-skill"))
    return derived

RULES = [
    rule_ac_test_gap,
    rule_feature_not_decomposed,
    rule_feature_not_implemented,
    rule_recipe_transitive_skill,
    rule_epic_completeness,
    rule_recipe_agent_skill_triangle,
]

RULE_DESCRIPTIONS = {
    "R1:ac-test-gap":         "AC with no VALIDATES incoming test → HAS_STATUS test-gap",
    "R2:feature-not-decomposed": "Feature with no REFINED_INTO user_story → HAS_STATUS not-decomposed",
    "R3:feature-not-implemented": "Feature with no IMPLEMENTS incoming → HAS_STATUS not-implemented",
    "R4:transitive-skill":    "recipe USES_SKILL s1, s1 LOADS s2 → recipe TRANSITIVELY_USES s2",
    "R5:epic-blocked":        "Epic where all features are not-implemented → HAS_STATUS blocked",
    "R6:undeclared-skill":    "Agent loads skill not declared in recipe → AGENT_LOADS_UNDECLARED_SKILL",
}

# ── Status entities ────────────────────────────────────────────────────────────

STATUS_ENTITIES = {
    "status:test-gap":           {"entityType": "derived_status", "color": "#fc8181", "label": "Test gap"},
    "status:not-decomposed":     {"entityType": "derived_status", "color": "#f6ad55", "label": "Not decomposed"},
    "status:not-implemented":    {"entityType": "derived_status", "color": "#fc8181", "label": "Not implemented"},
    "status:blocked":            {"entityType": "derived_status", "color": "#e53e3e", "label": "Blocked"},
}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="KG forward-chaining reasoner")
    parser.add_argument("--dry-run",   action="store_true")
    parser.add_argument("--rules",     action="store_true")
    parser.add_argument("--memory",    default=str(MEMORY))
    parser.add_argument("--output",    default=str(DERIVED))
    args = parser.parse_args()

    if args.rules:
        print("Active rules:")
        for name, desc in RULE_DESCRIPTIONS.items():
            print(f"  {name}: {desc}")
        return

    entities, base_relations = load_kg(pathlib.Path(args.memory))
    print(f"Loaded: {len(entities)} entities, {len(base_relations)} relations")

    derived = forward_chain(entities, base_relations, RULES)
    print(f"Derived: {len(derived)} new facts")

    # Count by rule
    by_rule = collections.Counter(r.get("rule","unknown") for r in derived)
    for rule, count in sorted(by_rule.items()):
        print(f"  {rule}: {count}")

    if args.dry_run:
        print("Dry run — not written.")
        return

    # Write derived.jsonl: status entities + derived relations
    lines = []
    seen_status = set()
    for d in derived:
        if d["relationType"] == "HAS_STATUS":
            sname = d["to"]
            if sname not in seen_status:
                seen_status.add(sname)
                sinfo = STATUS_ENTITIES.get(sname, {"entityType":"derived_status","color":"#aaa","label":sname})
                lines.append(json.dumps({
                    "type": "entity", "name": sname,
                    "entityType": sinfo["entityType"],
                    "observations": [f"label: {sinfo['label']}", f"color: {sinfo['color']}", "derived: true"]
                }))
        lines.append(json.dumps(d))

    pathlib.Path(args.output).parent.mkdir(exist_ok=True)
    pathlib.Path(args.output).write_text("\n".join(lines) + "\n")
    print(f"Written: {args.output} ({len(lines)} lines)")

if __name__ == "__main__":
    main()
