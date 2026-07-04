#!/usr/bin/env python3
"""Open generated skill A/B eval review artifacts in the default browser."""
from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVAL_KIND = "skills"


def latest_workspace_root() -> Path:
    return ROOT / "dist" / "evals" / DEFAULT_EVAL_KIND


def latest_artifact_dir(skill_dir: Path) -> Path | None:
    candidates: list[tuple[float, Path]] = []
    if (skill_dir / "review.html").exists():
        candidates.append(((skill_dir / "review.html").stat().st_mtime, skill_dir))
    for path in skill_dir.iterdir() if skill_dir.exists() else []:
        if path.is_dir() and (path / "review.html").exists():
            candidates.append(((path / "review.html").stat().st_mtime, path))
    for path in skill_dir.glob("iteration-*") if skill_dir.exists() else []:
        if path.is_dir() and (path / "review.html").exists():
            candidates.append(((path / "review.html").stat().st_mtime, path))
    if not candidates:
        return None
    return sorted(candidates)[-1][1]


def target_path(args: argparse.Namespace) -> Path:
    workspace_root = args.workspace_root
    if args.skill:
        skill_dir = workspace_root / args.skill
        artifact_root = latest_artifact_dir(skill_dir)
        if artifact_root is None:
            raise SystemExit(f"No review artifacts found for skill: {args.skill}")
        if args.artifact == "benchmark-md":
            return artifact_root / "benchmark.md"
        if args.artifact == "benchmark-json":
            return artifact_root / "benchmark.json"
        return artifact_root / "review.html"

    return workspace_root / "index.html"


def open_file(path: Path, *, print_path: bool) -> int:
    resolved = path.resolve()
    if not resolved.exists():
        print(f"Review artifact not found: {resolved}", file=sys.stderr)
        print("Run an eval first, for example:", file=sys.stderr)
        print("  python scripts/run-skill-ab-suite.py --continue-on-failure", file=sys.stderr)
        print("Then open the latest eval workspace with:", file=sys.stderr)
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
    parser.add_argument("--workspace-root", type=Path, help="Default: dist/evals/skills")
    parser.add_argument("--skill", help="Open a single skill review instead of the suite index.")
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
