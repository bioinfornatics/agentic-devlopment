#!/usr/bin/env python3
"""Validate the active recipe contract against its schema and recipe YAML."""
from __future__ import annotations

import json
import pathlib
import re
import sys
from typing import Any

try:
    import jsonschema
except ImportError:
    sys.exit("FAIL recipe metadata: missing required Python module 'jsonschema'")
try:
    import yaml
except ImportError:
    sys.exit("FAIL recipe metadata: missing required Python module 'yaml' (PyYAML)")

ROOT = pathlib.Path(__file__).resolve().parents[1]
METADATA = ROOT / ".specs/harness/recipe-workflow-metadata.json"
SCHEMA = ROOT / ".specs/schemas/recipe-workflow-metadata.schema.json"
ERRORS: list[str] = []


def load_json(path: pathlib.Path) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        ERRORS.append(f"missing {path.relative_to(ROOT)}")
    except (OSError, json.JSONDecodeError) as exc:
        ERRORS.append(f"cannot read {path.relative_to(ROOT)}: {exc}")
    return None


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


metadata = load_json(METADATA)
schema = load_json(SCHEMA)
if metadata is not None and schema is not None:
    try:
        jsonschema.Draft202012Validator.check_schema(schema)
        validator = jsonschema.Draft202012Validator(schema)
        for error in sorted(validator.iter_errors(metadata), key=lambda e: list(e.absolute_path)):
            where = ".".join(str(part) for part in error.absolute_path) or "<root>"
            ERRORS.append(f"schema {where}: {error.message}")
    except jsonschema.SchemaError as exc:
        ERRORS.append(f"invalid JSON Schema: {exc.message}")

if isinstance(metadata, dict):
    agents = metadata.get("agents", {})
    agent_names = sorted(path.stem for path in (ROOT / ".agents/agents").glob("*.md"))
    skill_names = sorted(path.name for path in (ROOT / ".agents/skills").iterdir() if path.is_dir())
    if not isinstance(agents, dict) or set(agents) != set(agent_names):
        names = sorted(agents) if isinstance(agents, dict) else []
        ERRORS.append(f"metadata agents {names} != active agents {agent_names}")
    entries = metadata.get("recipes", {})
    recipe_paths = sorted((ROOT / ".goose/recipes").glob("*.yaml"))
    active_names = [path.stem for path in recipe_paths]
    if not isinstance(entries, dict) or set(entries) != set(active_names):
        names = sorted(entries) if isinstance(entries, dict) else []
        ERRORS.append(f"metadata recipes {names} != active recipes {active_names}")
    for path in recipe_paths:
        name = path.stem
        item = entries.get(name) if isinstance(entries, dict) else None
        if not isinstance(item, dict):
            continue
        expected_path = f".goose/recipes/{name}.yaml"
        if item.get("source_path") != expected_path:
            ERRORS.append(f"{name} source_path must be {expected_path}")
        try:
            recipe = yaml.safe_load(path.read_text())
        except (OSError, yaml.YAMLError) as exc:
            ERRORS.append(f"cannot parse {expected_path}: {exc}")
            continue
        if not isinstance(recipe, dict):
            ERRORS.append(f"{expected_path} must contain a YAML object")
            continue
        instructions = recipe.get("instructions")
        if not isinstance(instructions, str):
            ERRORS.append(f"{name} instructions must be text")
            continue
        marker = re.search(r"^\s*##\s*AD-001 pattern:\s*(.+?)\s*$", instructions, re.MULTILINE)
        actual_pattern = normalized(marker.group(1)) if marker else None
        if actual_pattern != item.get("ad001_pattern"):
            ERRORS.append(f"{name} ad001_pattern {actual_pattern!r} != metadata {item.get('ad001_pattern')!r}")
        for field in ("phase", "entry_criteria", "exit_criteria"):
            values = item.get(field)
            values = values if isinstance(values, list) else [values]
            for declaration in values:
                if isinstance(declaration, str) and declaration not in instructions:
                    ERRORS.append(f"{name} {field} declaration not found in recipe: {declaration!r}")
        for field in ("retry", "session"):
            if recipe.get(field) != item.get(field):
                ERRORS.append(f"{name} {field} {recipe.get(field)!r} != metadata {item.get(field)!r}")
        extensions = recipe.get("extensions", [])
        has_skills = any(isinstance(ext, dict) and ext.get("type") == "platform" and ext.get("name") == "skills" for ext in extensions if isinstance(extensions, list))
        if item.get("skills_extension_required") and not has_skills:
            ERRORS.append(f"{name} missing required skills platform extension")
        references = [(entry.get("skill"), f"{name} controller skill") for entry in item.get("controller_skills", []) if isinstance(entry, dict)]
        for delegate in item.get("delegates", []):
            if not isinstance(delegate, dict): continue
            agent = delegate.get("agent")
            if agent not in agent_names: ERRORS.append(f"{name} delegate references unknown agent {agent!r}")
            required = delegate.get("mandatory_skills", [])
            baseline = agents.get(agent, {}).get("mandatory_skills") if isinstance(agents, dict) and isinstance(agents.get(agent), dict) else None
            if baseline != required: ERRORS.append(f"{name} delegate {agent!r} mandatory_skills {required!r} != agent baseline {baseline!r}")
            references.extend((skill, f"{name} delegate {agent!r} skill") for skill in required)
        for skill, context in references:
            if not isinstance(skill, str) or "/" in skill or chr(92) in skill:
                ERRORS.append(f"{context} must be a name-only reference: {skill!r}")
            elif skill not in skill_names:
                ERRORS.append(f"{context} references unknown skill {skill!r}")
    if isinstance(agents, dict):
        for agent, declaration in agents.items():
            if not isinstance(declaration, dict):
                continue
            for skill in declaration.get("mandatory_skills", []):
                if not isinstance(skill, str) or "/" in skill or chr(92) in skill:
                    ERRORS.append(f"agent {agent!r} skill must be a name-only reference: {skill!r}")
                elif skill not in skill_names:
                    ERRORS.append(f"agent {agent!r} references unknown skill {skill!r}")

if ERRORS:
    print("FAIL recipe metadata")
    for error in ERRORS:
        print(f"- {error}")
    sys.exit(1)
print(f"PASS recipe metadata/schema and YAML contract for {len(metadata['recipes'])} active recipes")
