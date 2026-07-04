#!/usr/bin/env python3
"""Open generated skill A/B eval review artifacts in the default browser."""
from __future__ import annotations

import argparse
import re
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVAL_KIND = "skills"
ITERATION_RE = re.compile(r"^iteration-(\d+)$")


def latest_workspace_root() -> Path:
    evals_root = ROOT / "dist" / "evals"
    candidates = []
    if evals_root.exists():
        for path in evals_root.iterdir():
            workspace = path / DEFAULT_EVAL_KIND
            if path.is_dir() and workspace.exists():
                candidates.append((path.name, workspace))
    if candidates:
        return sorted(candidates)[-1][1]

    legacy = evals_root / DEFAULT_EVAL_KIND
    return legacy


def latest_iteration_dir(skill_dir: Path) -> Path | None:
    candidates: list[tuple[int, Path]] = []
    for path in skill_dir.glob("iteration-*"):
        if not path.is_dir():
            continue
        match = ITERATION_RE.match(path.name)
        if match:
            candidates.append((int(match.group(1)), path))
    if not candidates:
        return None
    return sorted(candidates)[-1][1]


def target_path(args: argparse.Namespace) -> Path:
    workspace_root = args.workspace_root
    if args.skill:
        skill_dir = workspace_root / args.skill
        iteration_dir = skill_dir / f"iteration-{args.iteration}" if args.iteration is not None else latest_iteration_dir(skill_dir)
        if iteration_dir is None:
            raise SystemExit(f"No iteration-* directories found for skill: {args.skill}")
        if args.artifact == "benchmark-md":
            return iteration_dir / "benchmark.md"
        if args.artifact == "benchmark-json":
            return iteration_dir / "benchmark.json"
        return iteration_dir / "review.html"

    if args.iteration is not None:
        return workspace_root / f"iteration-{args.iteration}-index.html"
    return workspace_root / "index.html"


def open_file(path: Path, *, print_path: bool) -> int:
    resolved = path.resolve()
    if not resolved.exists():
        print(f"Review artifact not found: {resolved}", file=sys.stderr)
        print("Run an eval first, for example:", file=sys.stderr)
        print("  python scripts/run-skill-ab-suite.py --iteration 1 --continue-on-failure", file=sys.stderr)
        print("Then open the latest timestamped workspace with:", file=sys.stderr)
        print("  python scripts/open-skill-eval-review.py", file=sys.stderr)
        return 1

    print(resolved)
    if print_path:
        return 0

    if webbrowser.open(resolved.as_uri(), new=2):
        return 0

    print(f"Could not open browser automatically. Open this file manually: {resolved}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Open generated skill A/B eval suite review artifacts.")
    parser.add_argument("--workspace-root", type=Path, help="Default: latest dist/evals/<timestamp>/skills workspace, falling back to legacy dist/evals/skills")
    parser.add_argument("--skill", help="Open a single skill review instead of the suite index.")
    parser.add_argument("--iteration", type=int, help="Iteration to open. Defaults to latest suite index, or latest skill iteration.")
    parser.add_argument(
        "--artifact",
        choices=["review", "benchmark-md", "benchmark-json"],
        default="review",
        help="Artifact to open when --skill is provided.",
    )
    parser.add_argument("--print-path", action="store_true", help="Only print the resolved artifact path; do not open a browser.")
    args = parser.parse_args()
    if args.workspace_root is None:
        args.workspace_root = latest_workspace_root()
    return open_file(target_path(args), print_path=args.print_path)


if __name__ == "__main__":
    raise SystemExit(main())
