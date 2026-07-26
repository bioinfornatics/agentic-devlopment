#!/usr/bin/env python3
"""Validate basic structural requirements of a JSONL knowledge-graph export."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED_ENTITY_KEYS = {"name", "entityType"}
REQUIRED_RELATION_KEYS = {"from", "to", "relationType"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    entities: set[str] = set()
    relations: list[tuple[int, dict]] = []

    with path.open("r", encoding="utf-8") as handle:
        for number, raw in enumerate(handle, 1):
            line = raw.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"line {number}: invalid JSON: {exc.msg}")
                continue

            if not isinstance(item, dict):
                errors.append(f"line {number}: expected object")
                continue

            kind = item.get("type") or item.get("kind")
            payload = item.get("entity") or item.get("relation") or item

            if kind in {"entity", "node"} or REQUIRED_ENTITY_KEYS <= payload.keys():
                missing = REQUIRED_ENTITY_KEYS - payload.keys()
                if missing:
                    errors.append(f"line {number}: entity missing {sorted(missing)}")
                    continue
                name = str(payload["name"])
                if name in entities:
                    errors.append(f"line {number}: duplicate entity name {name!r}")
                entities.add(name)
            elif kind in {"relation", "edge"} or REQUIRED_RELATION_KEYS <= payload.keys():
                missing = REQUIRED_RELATION_KEYS - payload.keys()
                if missing:
                    errors.append(f"line {number}: relation missing {sorted(missing)}")
                    continue
                relations.append((number, payload))
            else:
                errors.append(f"line {number}: cannot classify record as entity or relation")

    for number, relation in relations:
        if relation["from"] not in entities:
            errors.append(f"line {number}: unknown relation source {relation['from']!r}")
        if relation["to"] not in entities:
            errors.append(f"line {number}: unknown relation target {relation['to']!r}")
        if not str(relation["relationType"]).strip():
            errors.append(f"line {number}: empty relationType")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("graph", type=Path)
    args = parser.parse_args()

    if not args.graph.is_file():
        print(f"graph file not found: {args.graph}", file=sys.stderr)
        return 2

    errors = validate(args.graph)
    if errors:
        print("Graph validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Graph validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
