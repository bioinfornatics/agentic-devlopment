#!/usr/bin/env python3
"""
generate-tables.py — Generate documentation tables from the actual source of truth.

Principle (Matt Pocock, "Delete most of your docs"): Documentation that mirrors
code/config files is a liability — it drifts. Instead, GENERATE it from the
files that are already authoritative: agent specs, skill files, recipe YAMLs,
eval JSONs.

Run after adding/removing/renaming any skill, agent, or recipe:
  python3 scripts/generate-tables.py

Automatically run by .git/hooks/pre-commit.

Injects content between  <!-- BEGIN GENERATED: <section> -->
                      and <!-- END GENERATED: <section> -->  markers.
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ── helpers ──────────────────────────────────────────────────────────────────

def parse_frontmatter(path: Path) -> dict[str, str]:
    """Extract key:value pairs from YAML frontmatter (between --- delimiters)."""
    text = path.read_text()
    m = re.match(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not m:
        return {}
    block = m.group(1)
    result: dict[str, str] = {}
    # simple key: value or key: > (multiline — take first non-empty line)
    for line in block.split('\n'):
        kv = re.match(r'^(\w[\w-]*):\s*(.*)', line)
        if kv:
            result[kv.group(1)] = kv.group(2).strip().strip('"')
    return result

def first_sentence(text: str) -> str:
    """Take first sentence (up to first period) or first 90 chars."""
    text = text.strip().lstrip('> ').strip()
    # Remove YAML flow scalar continuation lines (leading spaces after >)
    text = re.sub(r'\s+', ' ', text)
    dot = text.find('.')
    if 0 < dot < 100:
        return text[:dot + 1]
    return text[:90].rstrip()

def skill_description(skill_dir: Path) -> str:
    """Read the description from a skill's SKILL.md frontmatter."""
    skill_md = skill_dir / 'SKILL.md'
    if not skill_md.exists():
        return ''
    text = skill_md.read_text()
    # Extract multi-line description after 'description: >'
    m = re.search(r'description:\s*>\n((?:  .+\n?)+)', text)
    if m:
        lines = [l.strip() for l in m.group(1).split('\n') if l.strip()]
        return first_sentence(' '.join(lines))
    # Fallback: single-line description
    m2 = re.search(r'description:\s*(.+)', text)
    if m2:
        return first_sentence(m2.group(1).strip().strip('"'))
    return ''

def agent_info(agent_path: Path) -> dict[str, str]:
    """Extract name, description, model from agent frontmatter."""
    fm = parse_frontmatter(agent_path)
    desc = fm.get('description', '')
    return {
        'name': fm.get('name', agent_path.stem),
        'description': first_sentence(desc),
        'model': fm.get('model', ''),
    }

def recipe_info(recipe_path: Path) -> dict[str, str]:
    """Extract title/description from recipe YAML."""
    text = recipe_path.read_text()
    title_m = re.search(r'^title:\s*["\'"]?(.+)["\'"]?$', text, re.MULTILINE)
    desc_m = re.search(r'^description:\s*[>|]?\s*\n?\s*(.+)', text, re.MULTILINE)
    title = title_m.group(1).strip().strip('"') if title_m else recipe_path.stem
    desc = desc_m.group(1).strip().strip('"') if desc_m else ''
    return {'title': title, 'description': first_sentence(desc)}

def eval_layers(kind: str, name: str) -> dict[str, list[str]]:
    """Read the skills/agents arrays from the first scenario of an eval JSON."""
    p = ROOT / 'evals' / kind / f'{name}.json'
    if not p.exists():
        return {}
    scenarios = json.loads(p.read_text())
    if not scenarios:
        return {}
    s = scenarios[0]
    return {
        'skills': s.get('skills', []),
        'agents': s.get('agents', []),
    }

def inject(path: Path, section: str, content: str) -> bool:
    """Replace content between BEGIN/END markers. Returns True if changed."""
    text = path.read_text()
    begin = f'<!-- BEGIN GENERATED: {section} -->'
    end = f'<!-- END GENERATED: {section} -->'
    pattern = re.compile(
        re.escape(begin) + r'.*?' + re.escape(end),
        re.DOTALL
    )
    replacement = f'{begin}\n{content.rstrip()}\n{end}'
    new_text, count = pattern.subn(replacement, text)
    if count == 0:
        print(f'  [WARN] No marker found in {path} for section: {section}')
        return False
    if new_text != text:
        path.write_text(new_text)
        return True
    return False

# ── Sources ───────────────────────────────────────────────────────────────────

SKILLS_DIR = ROOT / '.agents/skills'
AGENTS_DIR = ROOT / '.agents/agents'
RECIPES_DIR = ROOT / '.goose/recipes'

skills = sorted(
    p for p in SKILLS_DIR.iterdir()
    if p.is_dir() and p.name not in ('skill-creator',)
)
agents = sorted(AGENTS_DIR.glob('*.md'), key=lambda p: p.stem)
recipes = sorted(
    p for p in RECIPES_DIR.glob('*.yaml')
    if p.parent.name != 'subrecipes'
)

# ── Generate README skills table ──────────────────────────────────────────────

def gen_readme_skills() -> str:
    rows = []
    rows.append(f'## Skills ({len(skills)})')
    rows.append('')
    rows.append('| Skill | Purpose |')
    rows.append('|-------|---------|')
    for s in skills:
        desc = skill_description(s)
        rows.append(f'| `{s.name}` | {desc} |')
    return '\n'.join(rows)

# ── Generate README agents table ──────────────────────────────────────────────

def gen_readme_agents() -> str:
    rows = []
    rows.append(f'## Named agents ({len(agents)})')
    rows.append('')
    rows.append('Named agents in `.agents/agents/` — invoke with Goose Summon natural language:')
    rows.append('`load agent <name>` (in-session) or `delegate task bd-xxx and into those task load agent <name>` (isolated).')
    rows.append('')
    rows.append('| Agent | Role | Model |')
    rows.append('|-------|------|-------|')
    for a in agents:
        info = agent_info(a)
        desc = info['description'][:80] if info['description'] else ''
        model_short = info['model'].replace('claude-opus-4-5', 'opus-4-5').replace('claude-sonnet-4-5', 'sonnet-4-5')
        rows.append(f'| `{a.stem}` | {desc} | {model_short} |')
    return '\n'.join(rows)

# ── Generate eval map for docs/15-skill-evaluations.md ───────────────────────

def gen_eval_skills() -> str:
    rows = ['| Skill | Eval file |', '| --- | --- |']
    for s in skills:
        if (ROOT / 'evals/skills' / f'{s.name}.json').exists():
            rows.append(f'| `{s.name}` | `evals/skills/{s.name}.json` |')
    return '\n'.join(rows)

def gen_eval_agents() -> str:
    rows = ['| Agent | Eval file | Supporting skills (Layer 1 baseline) |', '| --- | --- | --- |']
    for a in agents:
        name = a.stem
        if (ROOT / 'evals/agents' / f'{name}.json').exists():
            layers = eval_layers('agents', name)
            skills_list = ', '.join(f'`{s}`' for s in layers.get('skills', []))
            rows.append(f'| `{name}` | `evals/agents/{name}.json` | {skills_list} |')
    return '\n'.join(rows)

def gen_eval_recipes() -> str:
    rows = ['| Recipe | Eval file | In-session agents (Layer 2) | Skills (Layer 1) |', '| --- | --- | --- | --- |']
    for r in recipes:
        name = r.stem
        if (ROOT / 'evals/recipes' / f'{name}.json').exists():
            layers = eval_layers('recipes', name)
            agents_list = ', '.join(f'`{a}`' for a in layers.get('agents', [])) or '—'
            skills_list = ', '.join(f'`{s}`' for s in layers.get('skills', []))
            rows.append(f'| `{name}` | `evals/recipes/{name}.json` | {agents_list} | {skills_list} |')
    return '\n'.join(rows)

# ── Run ───────────────────────────────────────────────────────────────────────

changed = 0
readme = ROOT / 'README.md'
doc15 = ROOT / 'docs/internal/15-skill-evaluations.md'

changes = [
    (readme, 'skills-table', gen_readme_skills()),
    (readme, 'agents-table', gen_readme_agents()),
    (doc15, 'eval-skills', gen_eval_skills()),
    (doc15, 'eval-agents', gen_eval_agents()),
    (doc15, 'eval-recipes', gen_eval_recipes()),
]

for path, section, content in changes:
    result = inject(path, section, content)
    status = 'updated' if result else 'unchanged'
    print(f'  [{status:9s}] {path.name}:{section}')
    if result:
        changed += 1

print(f'\n  {changed}/{len(changes)} section(s) updated.')
sys.exit(0)
