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

if ERRORS:
    print("FAIL recipe metadata")
    for error in ERRORS:
        print(f"- {error}")
    sys.exit(1)
print(f"PASS recipe metadata/schema and YAML contract for {len(metadata['recipes'])} active recipes")
