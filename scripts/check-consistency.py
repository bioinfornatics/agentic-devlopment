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

gstart_path = ROOT / "docs/reference/getting-started.md"
if gstart_path.exists():
    gstart = gstart_path.read_text()
    if f"{n}+" not in gstart and str(n) not in gstart:
        warn(f"docs/reference/getting-started.md may have stale skill count (expected {n}+)")
    else:
        ok("docs/reference/getting-started.md skill count")
else:
    ok("docs/reference/getting-started.md (file moved or restructured)")

arch = (ROOT / ".specs/architecture.md").read_text()
# architecture.md intentionally uses generate-tables.py pointer instead of hard counts (AD-002)
if "generate-tables" in arch or "README.md" in arch:
    ok(".specs/architecture.md defers to generated counts (AD-002)")
elif str(n) not in arch:
    warn(f".specs/architecture.md may have stale skill count (expected {n})")

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

# ── 5b. AGENT SKILL CONTRACTS (AC-AGENT-02) ───────────────────────────────────
print("\n── Agent skill contracts (AC-AGENT-02) ──────────────────────────────")
_contract_ok = True
for agent in agents:
    body = (ROOT / ".agents/agents" / f"{agent}.md").read_text()
    if "## Required Skill Load" not in body:
        fail(f"AC-AGENT-02: {agent}.md missing '## Required Skill Load' section")
        _contract_ok = False
    elif "stop and report" not in body:
        fail(f"AC-AGENT-02: {agent}.md has '## Required Skill Load' but no stop-if-missing guard ('stop and report')")
        _contract_ok = False
if _contract_ok:
    ok(f"Agent skill contracts present and guarded ({na} agents)")

# ── 5c. SKILL SUPPORTING FILE INTEGRITY (AC-SKILL-02) ────────────────────────
print("\n── Skill supporting file integrity (AC-SKILL-02) ────────────────────")
import re as _re
_files_ok = True
for skill_name in actual_skills():
    skill_dir = ROOT / ".agents" / "skills" / skill_name
    skill_md  = skill_dir / "SKILL.md"
    if not skill_md.exists():
        continue
    body = skill_md.read_text()

    # Pattern A: load `references/<file>` / `scripts/<file>` / `assets/<file>`
    # These are relative references that must resolve inside the skill directory.
    # Exclude placeholder patterns containing < > (documentation examples, not real paths).
    for ref in _re.findall(r'load\s+`((?:references|scripts|assets)/[^`<>]+)`', body):
        if not (skill_dir / ref).exists():
            fail(f"AC-SKILL-02: {skill_name}/SKILL.md references '{ref}' "
                 f"but .agents/skills/{skill_name}/{ref} does not exist")
            _files_ok = False

    # Pattern B: load skill: <skill-name>/references|scripts|assets/<file>
    # Cross-skill sub-path references with explicit skill prefix.
    for full_ref in _re.findall(
        r'load\s+skill[:\s]+`?([a-z][a-z0-9-]+/(?:references|scripts|assets)/[^\s`|\'\"]+)`?', body
    ):
        target_skill, sub_path = full_ref.split("/", 1)
        target = ROOT / ".agents" / "skills" / target_skill / sub_path
        if not target.exists():
            fail(f"AC-SKILL-02: {skill_name}/SKILL.md references "
                 f"'{full_ref}' but .agents/skills/{target_skill}/{sub_path} does not exist")
            _files_ok = False

    # Layout check: executable files in skill root instead of scripts/ subdir.
    for f in skill_dir.iterdir():
        if f.is_file() and f.suffix in (".sh", ".py", ".ts", ".js") and f.name != "SKILL.md":
            warn(f"AC-SKILL-02: {skill_name}: '{f.name}' is in the skill root "
                 f"— move to {skill_name}/scripts/")

if _files_ok:
    ok("Skill supporting file references all resolve on disk")

# ── 5d. ARTIFACT SIZE CALIBRATION (AC-SKILL-03 / AC-AGENT-03) ────────────────
print("\n── Artifact size calibration (HJ052-HJ054) ──────────────────────────")

# Skills: SKILL.md body (excluding YAML frontmatter between first two --- lines)
for skill_name in actual_skills():
    skill_md = ROOT / ".agents" / "skills" / skill_name / "SKILL.md"
    if not skill_md.exists():
        continue
    lines = skill_md.read_text().splitlines()
    # Strip YAML frontmatter (content between opening --- and closing ---)
    body_start = 0
    if lines and lines[0].strip() == "---":
        for i, ln in enumerate(lines[1:], 1):
            if ln.strip() == "---":
                body_start = i + 1
                break
    body_lines = len(lines) - body_start
    if body_lines < 50:
        fail(f"HJ052: {skill_name}/SKILL.md body is {body_lines} lines — too short (< 50); real methodology cannot fit")
    elif body_lines > 700:
        fail(f"HJ052: {skill_name}/SKILL.md body is {body_lines} lines — too long (> 700); offload to references/")
    elif body_lines > 500:
        warn(f"HJ052: {skill_name}/SKILL.md body is {body_lines} lines — approaching bloat (> 500); consider references/")

# Agents: full .md file
for agent in agents:
    agent_md = ROOT / ".agents" / "agents" / f"{agent}.md"
    n = len(agent_md.read_text().splitlines())
    if n < 80:
        fail(f"HJ053: {agent}.md is {n} lines — too short (< 80); required sections cannot fit")
    elif n > 500:
        fail(f"HJ053: {agent}.md is {n} lines — too long (> 500); methodology should be in skills")
    elif n > 400:
        warn(f"HJ053: {agent}.md is {n} lines — approaching bloat (> 400); audit for embedded methodology")

ok("Artifact size calibration checked (skills + agents)")

# ── 5e. SKILL CONDITIONAL LOAD SECTIONS (AC-SKILL-04 / HJ055) ────────────────
print("\n── Skill conditional-load sections (AC-SKILL-04 / HJ055) ───────────")
_cond_ok = True
for skill_name in actual_skills():
    skill_dir = ROOT / ".agents" / "skills" / skill_name
    ref_dir   = skill_dir / "references"
    skill_md  = skill_dir / "SKILL.md"
    if not ref_dir.is_dir() or not skill_md.exists():
        continue
    ref_files = [f.name for f in ref_dir.glob("*.md")]
    if not ref_files:
        continue
    body = skill_md.read_text()
    # Check 1: a named conditional-load section exists
    has_section = bool(_re.search(
        r'(?im)'
        r'(^##.*when to load'                          # ## When to load references
        r'|^##.*progressive disclosure'                # ## Progressive disclosure
        r'|→\s*load\s*`(?:references|scripts)/'       # → load `references/file`
        r'|load\s+skill:\s*[a-z][a-z0-9-]+/references/'  # load skill: name/references/
        r'|Consult\s*`references/)',                   # Consult `references/file`
        body
    ))
    if not has_section:
        fail(f"AC-SKILL-04: {skill_name}/SKILL.md has references/ but no "
             f"'When to load references' section (HJ055)")
        _cond_ok = False
        continue
    # Check 2: every reference file has a trigger line mentioning it
    for ref_file in ref_files:
        stem = ref_file.replace(".md", "")
        # Accept both → load and prose mention with the filename
        if stem not in body and ref_file not in body:
            fail(f"AC-SKILL-04: {skill_name}/SKILL.md has references/{ref_file} "
                 f"but no trigger for it in the conditional-load section (HJ055)")
            _cond_ok = False
if _cond_ok:
    ok("Skill conditional-load sections present and complete (HJ055)")

# ── 5f. SKILL FRONTMATTER SPEC (AC-SKILL-05) ──────────────────────────────────
print("\n── Skill frontmatter spec (AC-SKILL-05 / HJ056-HJ057) ──────────────")
_fm_ok = True
for skill_name in actual_skills():
    skill_md = ROOT / ".agents" / "skills" / skill_name / "SKILL.md"
    if not skill_md.exists():
        continue
    body = skill_md.read_text()
    fm_match = _re.match(r'^---\n(.*?)\n---', body, _re.DOTALL)
    if not fm_match:
        continue
    fm = fm_match.group(1)

    # name field
    name_m = _re.search(r"^name:\s*['\"]?([^'\"\n]+)['\"]?", fm, _re.M)
    if name_m:
        nm = name_m.group(1).strip()
        if len(nm) > 64:
            fail(f"AC-SKILL-05: {skill_name}/SKILL.md name '{nm}' exceeds 64 chars ({len(nm)})")
            _fm_ok = False
        if not _re.match(r'^[a-z0-9-]+$', nm):
            fail(f"AC-SKILL-05: {skill_name}/SKILL.md name '{nm}' contains invalid chars (only a-z, 0-9, hyphens)")
            _fm_ok = False
        for rw in ('anthropic', 'claude'):
            if rw in nm:
                warn(f"AC-SKILL-05: {skill_name}/SKILL.md name contains reserved word '{rw}'")

    # description field — collect multi-line > block
    desc_m = _re.search(r'^description:\s*(>-?|[^\n]+)', fm, _re.M)
    if desc_m:
        # grab everything after description: up to the next non-indented key
        after = fm[desc_m.start():]
        lines = after.split('\n')
        desc_lines = [lines[0].replace('description:', '').replace('>', '').strip()]
        for ln in lines[1:]:
            if ln and not ln[0].isspace():
                break
            desc_lines.append(ln.strip())
        desc_val = ' '.join(l for l in desc_lines if l).strip()

        if len(desc_val) > 1024:
            fail(f"AC-SKILL-05: {skill_name}/SKILL.md description exceeds 1024 chars ({len(desc_val)})")
            _fm_ok = False
        if _re.match(r'^(I |You )', desc_val):
            fail(f"AC-SKILL-05: {skill_name}/SKILL.md description must be third person (not starting with 'I ' or 'You ')")
            _fm_ok = False
        if _re.search(r'<[a-zA-Z]', desc_val):
            fail(f"AC-SKILL-05: {skill_name}/SKILL.md description contains XML tags")
            _fm_ok = False
        # exclusion clause check (HJ057)
        has_excl = bool(_re.search(r'(?i)(do not use|do not trigger|avoid when|not for|never use for|except when)', desc_val))
        if not has_excl:
            warn(f"HJ057: {skill_name}/SKILL.md description has no exclusion clause ('Do NOT use for...')")

if _fm_ok:
    ok("Skill frontmatter spec valid (AC-SKILL-05)")

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

print("\n── Recipe semantic lint (AD-001 / delegation prose) ─────────────────")
contradictions = 0
for recipe in recipes:
    recipe_path = ROOT / ".goose/recipes" / f"{recipe}.yaml"
    recipe_body = recipe_path.read_text()
    lower = recipe_body.lower()
    has_none = "delegated/summoned: none" in lower
    has_agent_or_delegate = bool(AGENT_RE.search(recipe_body) or re.search(r"\bdelegate\s+(to|[a-z-]+)|delegate\(source", recipe_body, re.IGNORECASE))
    if has_none and has_agent_or_delegate:
        fail(f"AD-001: {recipe}.yaml says 'Delegated/summoned: none' but also loads/delegates agents")
        contradictions += 1
    if "ad-001 pattern:" not in lower and recipe not in ("remember",):
        warn(f"AD-001: {recipe}.yaml has no explicit 'AD-001 pattern:' marker")
if contradictions == 0:
    ok("Recipe semantic lint found no 'Delegated/summoned: none' contradictions")


print("\n── Recipe workflow metadata validation ───────────────────────────────")
meta_path = ROOT / ".specs/harness/recipe-workflow-metadata.json"
if not meta_path.exists():
    fail("Missing .specs/harness/recipe-workflow-metadata.json")
else:
    meta = json.loads(meta_path.read_text())
    for recipe in recipes:
        m = meta.get("recipes", {}).get(recipe)
        if not m:
            fail(f"Recipe workflow metadata missing recipe: {recipe}")
            continue
        for key in ("phase", "ad001_pattern", "entry_criteria", "exit_criteria", "source_path"):
            if not m.get(key):
                fail(f"Recipe workflow metadata {recipe} missing {key}")
    ok("Recipe workflow metadata checked")

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
print("\n── docs/internal/15-skill-evaluations.md eval map ─────────────────────────────")
doc15_path = ROOT / "docs/internal/15-skill-evaluations.md"
if doc15_path.exists():
    doc15 = doc15_path.read_text()
    for skill in skills:
        has_eval = (ROOT / "evals/skills" / f"{skill}.json").exists()
        if has_eval and skill not in doc15:
            fail(f"docs/internal/15-skill-evaluations.md eval map missing skill (has eval): {skill}")
    for agent in agents:
        has_eval = (ROOT / "evals/agents" / f"{agent}.json").exists()
        if has_eval and agent not in doc15:
            fail(f"docs/internal/15-skill-evaluations.md eval map missing agent (has eval): {agent}")
    for recipe in recipes:
        has_eval = (ROOT / "evals/recipes" / f"{recipe}.json").exists()
        if has_eval and recipe not in doc15:
            fail(f"docs/internal/15-skill-evaluations.md eval map missing recipe (has eval): {recipe}")
    ok("docs/internal/15-skill-evaluations.md eval map checked")
else:
    ok("docs/internal/15-skill-evaluations.md (file moved or restructured)")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
print()
if failures:
    print(f"  {failures} FAIL(s) — fix before committing.")
    sys.exit(1)
else:
    print("  All consistency checks passed ✓")
    sys.exit(0)
