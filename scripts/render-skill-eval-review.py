#!/usr/bin/env python3
"""Render project skill eval definitions in the skill-creator review viewer.

This script does not execute model runs. It converts the canonical eval
scenarios under evals/skills/*.json into a viewer workspace so humans can
review prompts, baseline gaps, and expected behavior before/after running
real skill evaluations.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def slug(value: str, limit: int = 72) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return (text or "eval")[:limit]


def load_scenarios(evals_dir: Path) -> list[tuple[str, int, dict]]:
    scenarios: list[tuple[str, int, dict]] = []
    for eval_file in sorted(evals_dir.glob("*.json")):
        data = json.loads(eval_file.read_text())
        if not isinstance(data, list):
            raise ValueError(f"{eval_file} must contain a JSON array")
        for index, scenario in enumerate(data):
            if not isinstance(scenario, dict):
                raise ValueError(f"{eval_file}[{index}] must be an object")
            scenarios.append((eval_file.stem, index, scenario))
    return scenarios


def write_workspace(evals_dir: Path, workspace: Path) -> int:
    scenarios = load_scenarios(evals_dir)
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    for eval_id, (skill_name, scenario_id, scenario) in enumerate(scenarios):
        query = scenario.get("query", "")
        eval_name = f"{skill_name}-{scenario_id}-{slug(query)}"
        run_dir = workspace / eval_name / "definition_review"
        outputs_dir = run_dir / "outputs"
        outputs_dir.mkdir(parents=True, exist_ok=True)

        expected = scenario.get("expected_behavior", [])
        metadata = {
            "eval_id": eval_id,
            "eval_name": f"{skill_name} / scenario {scenario_id}",
            "prompt": query,
            "assertions": [{"text": item} for item in expected],
        }
        (run_dir / "eval_metadata.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n"
        )

        files = scenario.get("files", [])
        skills = scenario.get("skills", [])
        baseline_gaps = scenario.get("baseline_gaps", [])
        lines = [
            f"# Skill eval definition: {skill_name} / scenario {scenario_id}",
            "",
            f"**Skills:** {', '.join(skills) if skills else 'none listed'}",
            f"**Input files:** {', '.join(files) if files else 'none'}",
            "",
            "## User query",
            query or "(empty query)",
            "",
            "## Baseline gaps",
        ]
        lines.extend(f"- {gap}" for gap in baseline_gaps)
        lines.extend(["", "## Expected behavior / assertions"])
        lines.extend(f"- {item}" for item in expected)
        lines.extend(
            [
                "",
                "## Review note",
                "This page renders the eval definition only. It is not a with-skill/without-skill model run. After executing real runs, keep the same workspace shape and add outputs plus grading.json files, then rerun generate_review.py.",
            ]
        )
        (outputs_dir / "scenario.md").write_text("\n".join(lines) + "\n")

    return len(scenarios)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render evals/skills/*.json with skill-creator's visual review viewer."
    )
    parser.add_argument("--evals-dir", type=Path, default=Path("evals/skills"))
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path("dist/skill-eval-review/iteration-1"),
        help="Generated viewer workspace directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/skill-eval-review/index.html"),
        help="Standalone HTML review output.",
    )
    parser.add_argument(
        "--skill-creator-dir",
        type=Path,
        default=Path.home() / ".agents" / "skills" / "skill-creator",
        help="Path to the installed skill-creator skill directory.",
    )
    args = parser.parse_args()

    generate_review = args.skill_creator_dir / "eval-viewer" / "generate_review.py"
    if not generate_review.exists():
        print(
            f"skill-creator generate_review.py not found at {generate_review}. "
            "Install skill-creator or pass --skill-creator-dir.",
            file=sys.stderr,
        )
        return 2

    count = write_workspace(args.evals_dir, args.workspace)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            str(generate_review),
            str(args.workspace),
            "--skill-name",
            "Project skill eval definitions",
            "--static",
            str(args.output),
        ],
        check=True,
    )
    print(f"Rendered {count} eval scenarios to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
