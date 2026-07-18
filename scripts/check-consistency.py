#!/usr/bin/env python3
"""Consistency checker — verifies downstream files match structural sources.

Run after any skill / agent / recipe change, or as a pre-commit gate.
Exits 0 if all checks pass, 1 if any FAIL (hard violations).
WARNs are printed but do not affect exit code.
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"
OK   = "\033[32m OK \033[0m"

failures = 0

def fail(msg: str) -> None:
    global failures
    failures += 1
    print(f"  [{FAIL}] {msg}")

def warn(msg: str) -> None:
    print(f"  [{WARN}] {msg}")

def ok(msg: str) -> None:
    print(f"  [{OK}] {msg}")

# ── helpers ──────────────────────────────────────────────────────────────────

SKILL_RE = re.compile(r"[Ll]oad\s+skills?\s*:?\s*`?([a-z][a-z0-9-]+)`?", re.IGNORECASE)
AGENT_RE = re.compile(r"[Ll]oad\s+agent\s+([a-z][a-z0-9-]+)", re.IGNORECASE)

def actual_skills() -> list[str]:
    """Domain skills present on disk (excludes skill-creator and README)."""
    return sorted(
        p.name for p in (ROOT / ".agents/skills").iterdir()
        if p.is_dir() and p.name not in ("skill-creator",)
    )

def actual_agents() -> list[str]:
    return sorted(p.stem for p in (ROOT / ".agents/agents").glob("*.md"))

def actual_recipes() -> list[str]:
    return sorted(p.stem for p in (ROOT / ".goose/recipes").glob("*.yaml")
                  if p.parent.name != "subrecipes")

def eval_json(kind: str, name: str) -> list[dict]:
    p = ROOT / "evals" / kind / f"{name}.json"
    return json.loads(p.read_text()) if p.exists() else []

# ── 1. SKILL COUNTS ───────────────────────────────────────────────────────────
print("\n── Skill counts ──────────────────────────────────────────────────────")
skills = actual_skills()
n = len(skills)

readme = (ROOT / "README.md").read_text()
m = re.search(r"## Skills \((\d+)\)", readme)
readme_count = int(m.group(1)) if m else None
if readme_count != n:
    fail(f"README.md says Skills ({readme_count}), disk has {n}")
else:
    ok(f"README.md skill count = {n}")

gstart = (ROOT / "docs/getting-started.md").read_text()
if f"{n}+" not in gstart and str(n) not in gstart:
    warn(f"docs/getting-started.md may have stale skill count (expected {n}+)")
else:
    ok("docs/getting-started.md skill count")

arch = (ROOT / ".specs/architecture.md").read_text()
if str(n) not in arch:
    warn(f".specs/architecture.md may have stale skill count (expected {n})")
else:
    ok(".specs/architecture.md skill count")

spec_core = (ROOT / ".specs/features/harness-core/spec.md").read_text()
spec_count_m = re.search(r"following (\d+) domain skills", spec_core)
spec_count = int(spec_count_m.group(1)) if spec_count_m else None
if spec_count != n:
    fail(f"AC-SKILL-01 says {spec_count} domain skills, disk has {n}")
else:
    ok(f"AC-SKILL-01 domain skill count = {n}")

# ── 2. README SKILLS TABLE ────────────────────────────────────────────────────
print("\n── README skills table ───────────────────────────────────────────────")
for skill in skills:
    if f"`{skill}`" not in readme:
        fail(f"README.md missing skill row: {skill}")
ok_count = sum(1 for s in skills if f"`{s}`" in readme)
ok(f"README.md skill rows present: {ok_count}/{n}")

# ── 3. AC-SKILL-01 TABLE ─────────────────────────────────────────────────────
print("\n── AC-SKILL-01 table ─────────────────────────────────────────────────")
for skill in skills:
    if f"`{skill}`" not in spec_core:
        warn(f"AC-SKILL-01 missing skill: {skill}")

# ── 4. EVAL JSON FOR EACH SKILL ───────────────────────────────────────────────
print("\n── Skill eval coverage ───────────────────────────────────────────────")
for skill in skills:
    p = ROOT / "evals/skills" / f"{skill}.json"
    if not p.exists():
        warn(f"No eval file: evals/skills/{skill}.json")
    else:
        scenarios = json.loads(p.read_text())
        if len(scenarios) < 3:
            warn(f"evals/skills/{skill}.json has {len(scenarios)} scenario(s), expected 3")

# ── 5. AGENT COUNTS ───────────────────────────────────────────────────────────
print("\n── Agent counts ──────────────────────────────────────────────────────")
agents = actual_agents()
na = len(agents)

m = re.search(r"## Named agents \((\d+)\)", readme)
readme_agents = int(m.group(1)) if m else None
if readme_agents != na:
    fail(f"README.md says Named agents ({readme_agents}), disk has {na}")
else:
    ok(f"README.md agent count = {na}")

# AC-AGENT-01
for agent in agents:
    if f"`{agent}.md`" not in spec_core and f"`{agent}`" not in spec_core:
        warn(f"AC-AGENT-01 missing agent: {agent}")

# ── 6. AGENT EVAL JSON: "skills" field ────────────────────────────────────────
print("\n── Agent eval JSON layer declarations ────────────────────────────────")
for agent in agents:
    scenarios = eval_json("agents", agent)
    if not scenarios:
        warn(f"No eval file: evals/agents/{agent}.json")
        continue
    agent_body = (ROOT / ".agents/agents" / f"{agent}.md").read_text()
    declared = set(SKILL_RE.findall(agent_body))
    for i, s in enumerate(scenarios):
        listed = s.get("skills") or []
        if not listed:
            warn(f"evals/agents/{agent}.json scenario {i}: no 'skills' field")
        else:
            missing = [sk for sk in listed if sk not in declared]
            if missing:
                fail(f"evals/agents/{agent}.json references skills {missing} "
                     f"not declared in {agent}.md body")

ok(f"Agent eval JSON layer checks done ({na} agents)")

# ── 7. RECIPE COUNTS + AC-RECIPE-01 ──────────────────────────────────────────
print("\n── Recipe counts ─────────────────────────────────────────────────────")
recipes = actual_recipes()
nr = len(recipes)

for recipe in recipes:
    if recipe not in spec_core:
        warn(f"AC-RECIPE-01 missing recipe: {recipe}")

ok(f"Top-level recipes on disk: {nr}")

# ── 8. RECIPE EVAL JSON: "agents"+"skills" fields ─────────────────────────────
print("\n── Recipe eval JSON layer declarations ───────────────────────────────")
for recipe in recipes:
    scenarios = eval_json("recipes", recipe)
    if not scenarios:
        warn(f"No eval file: evals/recipes/{recipe}.json")
        continue
    recipe_body = (ROOT / ".goose/recipes" / f"{recipe}.yaml").read_text()
    decl_agents = set(AGENT_RE.findall(recipe_body))
    decl_skills = set(SKILL_RE.findall(recipe_body))
    for i, s in enumerate(scenarios):
        listed_ag = s.get("agents") or []
        listed_sk = s.get("skills") or []
        if not listed_sk and recipe != "remember":
            warn(f"evals/recipes/{recipe}.json scenario {i}: no 'skills' field")
        missing_ag = [a for a in listed_ag if a not in decl_agents]
        if missing_ag:
            fail(f"evals/recipes/{recipe}.json references agents {missing_ag} "
                 f"not loaded in-session by {recipe}.yaml")
        missing_sk = [sk for sk in listed_sk if sk not in decl_skills]
        if missing_sk:
            fail(f"evals/recipes/{recipe}.json references skills {missing_sk} "
                 f"not declared in {recipe}.yaml")

ok(f"Recipe eval JSON layer checks done ({nr} recipes)")

# ── 9. AC-RECIPE-02 WIRING TABLE ─────────────────────────────────────────────
print("\n── AC-RECIPE-02 wiring table completeness ────────────────────────────")
for recipe in recipes:
    if recipe not in spec_core:
        fail(f"AC-RECIPE-02 wiring table missing row for: {recipe}")

ok("AC-RECIPE-02 wiring table presence checked")

# ── 10. USE_CASES.MD ──────────────────────────────────────────────────────────
print("\n── USE_CASES.md stale recipe names ───────────────────────────────────")
use_cases = (ROOT / "USE_CASES.md").read_text()
stale = ["harness-master", "sdd-master", "harness-review", "harness-implement",
         "harness-release", "harness-research", "harness-plan", "ui-ux-suite",
         "harness-web-test", "harness-memory"]
for name in stale:
    if name in use_cases:
        fail(f"USE_CASES.md still references deleted recipe: {name}")
ok("USE_CASES.md stale recipe check done")

# ── 11. DOC 15 EVAL MAP ───────────────────────────────────────────────────────
# Only skills/agents/recipes that already have eval files are expected in the map.
# Missing eval files are already flagged above under coverage checks.
print("\n── docs/15-skill-evaluations.md eval map ─────────────────────────────")
doc15 = (ROOT / "docs/15-skill-evaluations.md").read_text()
for skill in skills:
    has_eval = (ROOT / "evals/skills" / f"{skill}.json").exists()
    if has_eval and skill not in doc15:
        fail(f"docs/15-skill-evaluations.md eval map missing skill (has eval): {skill}")
for agent in agents:
    has_eval = (ROOT / "evals/agents" / f"{agent}.json").exists()
    if has_eval and agent not in doc15:
        fail(f"docs/15-skill-evaluations.md eval map missing agent (has eval): {agent}")
for recipe in recipes:
    has_eval = (ROOT / "evals/recipes" / f"{recipe}.json").exists()
    if has_eval and recipe not in doc15:
        fail(f"docs/15-skill-evaluations.md eval map missing recipe (has eval): {recipe}")

ok("docs/15-skill-evaluations.md eval map checked")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
print()
if failures:
    print(f"  {failures} FAIL(s) — fix before committing.")
    sys.exit(1)
else:
    print("  All consistency checks passed ✓")
    sys.exit(0)
