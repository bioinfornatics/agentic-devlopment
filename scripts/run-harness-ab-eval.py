#!/usr/bin/env python3
"""Run real A/B evaluations for skills, named agents, and Goose recipes."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from eval_utils import (  # noqa: E402
    DEFAULT_HISTORY_DB,
    content_hash,
    default_subject_workspace,
    git_commit,
    git_is_dirty,
    record_eval_run,
)

SKILL_RUNNER_PATH = ROOT / "scripts" / "run-skill-ab-eval.py"
_spec = importlib.util.spec_from_file_location("run_skill_ab_eval", SKILL_RUNNER_PATH)
skill_runner = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = skill_runner
assert _spec.loader is not None
_spec.loader.exec_module(skill_runner)

KIND_PATHS = {
    "skills": lambda subject: ROOT / ".agents" / "skills" / subject,
    "agents": lambda subject: ROOT / ".agents" / "agents" / f"{subject}.md",
    "recipes": lambda subject: ROOT / ".goose" / "recipes" / f"{subject}.yaml",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def subject_path(kind: str, subject: str) -> Path:
    try:
        return KIND_PATHS[kind](subject)
    except KeyError:
        raise SystemExit(f"Unsupported kind: {kind}") from None


def subject_git_path(kind: str, subject: str) -> str:
    return subject_path(kind, subject).relative_to(ROOT).as_posix()


def load_material(kind: str, subject: str, path: Path | None = None, git_ref: str | None = None) -> str:
    rel = subject_git_path(kind, subject)
    if git_ref:
        proc = subprocess.run(["git", "show", f"{git_ref}:{rel}"], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            raise SystemExit(f"Cannot read {rel} at {git_ref}: {proc.stderr.strip()}")
        content = proc.stdout
    else:
        target = path or subject_path(kind, subject)
        if target.is_dir():
            parts = []
            for file in sorted(p for p in target.rglob("*") if p.is_file()):
                parts.append(f"## File: {file.relative_to(target)}\n\n```text\n{file.read_text(errors='replace')}\n```")
            content = "\n\n".join(parts)
        else:
            content = target.read_text(errors="replace")
    label = kind[:-1] if kind.endswith("s") else kind
    return f"## {label}: {subject}\n\n```text\n{content}\n```"


def resolve_run_id(args: argparse.Namespace, eval_file: Path) -> str:
    if args.run_id:
        return args.run_id
    if args.run_id_source == "git":
        if git_is_dirty():
            raise SystemExit("--run-id-source git requires a clean git working tree; use the default content hash while developing.")
        commit = git_commit()
        if not commit:
            raise SystemExit("Cannot resolve git commit for --run-id-source git")
        return commit[:12]
    if args.require_clean_git and git_is_dirty():
        raise SystemExit("Working tree is dirty; commit/stash changes or omit --require-clean-git.")
    return content_hash([subject_path(args.kind, args.subject)])


def build_prompt(args: argparse.Namespace, scenario: dict[str, Any], config_name: str, config_description: str, material: str, repo_root: Path) -> str:
    files = json.dumps(scenario.get("files", []), indent=2, ensure_ascii=False)
    fixture = scenario.get("fixture_description")
    fixture_section = f"\nFixture setup already applied before this run:\n{fixture}\n" if fixture else ""
    return f"""
You are running a controlled A/B evaluation for `{args.kind}/{args.subject}`.

Configuration: {config_name}
Configuration description: {config_description}

Repository worktree: {repo_root}

Safety and isolation rules:
- You are inside an isolated copied worktree for this eval run.
- Complete the user task as realistically as possible for this configuration.
- If the task asks for repository changes, make only the minimum relevant changes in the isolated worktree.
- Do not access or modify the source checkout outside the isolated worktree.
- When you finish, report exactly what you did, what evidence you inspected, validation commands run, and remaining risks.

Subject material for this configuration:
{material}

Eval input files or paths of interest:
{files}
{fixture_section}
User task:
{scenario.get('query', '')}
""".strip()


def prepare_configs(args: argparse.Namespace) -> list[tuple[str, str, str]]:
    label = args.kind[:-1] if args.kind.endswith("s") else args.kind
    if args.mode == "with-without":
        return [
            (f"with_{label}", f"Run with project {label} material injected into the prompt.", load_material(args.kind, args.subject)),
            (f"without_{label}", f"Baseline run without project {label} material injected into the prompt.", f"No project {label} content is provided for this baseline run. Do not load or intentionally follow `{args.subject}`."),
        ]
    if args.mode == "old-new":
        if not args.baseline_git_ref:
            raise SystemExit("--mode old-new requires --baseline-git-ref for agents/recipes/skills in the generic runner")
        candidate = load_material(args.kind, args.subject, git_ref=args.candidate_git_ref) if args.candidate_git_ref else load_material(args.kind, args.subject)
        baseline = load_material(args.kind, args.subject, git_ref=args.baseline_git_ref)
        return [
            (f"new_{label}", f"Candidate {label} from {args.candidate_git_ref or 'working tree'}.", candidate),
            (f"old_{label}", f"Baseline {label} from {args.baseline_git_ref}.", baseline),
        ]
    raise SystemExit(f"Unsupported mode: {args.mode}")


def run_recipe_checks(args: argparse.Namespace, workspace: Path) -> None:
    if args.kind != "recipes":
        return
    recipe = subject_path(args.kind, args.subject)
    checks: dict[str, Any] = {}
    validate = subprocess.run([args.goose_cli_resolved, "recipe", "validate", str(recipe)], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    checks["validate"] = {"returncode": validate.returncode, "stdout": validate.stdout, "stderr": validate.stderr}
    render_cmd = [args.goose_cli_resolved, "run", "--recipe", str(recipe), "--params", "task=eval render smoke", "--params", "target=eval render smoke", "--params", "repo_path=.", "--params", "constraints=", "--render-recipe"]
    render = subprocess.run(render_cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
    checks["render"] = {"returncode": render.returncode, "stdout": render.stdout[:20000], "stderr": render.stderr[:20000]}
    write_json(workspace / "recipe_checks.json", checks)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run A/B evals for skills, named agents, and Goose recipes.")
    parser.add_argument("--kind", choices=["skills", "agents", "recipes"], required=True)
    parser.add_argument("--subject", required=True, help="Subject name, e.g. code-review, beads-planner, harness-master")
    parser.add_argument("--eval-file", type=Path)
    parser.add_argument("--mode", choices=["with-without", "old-new"], default="with-without")
    parser.add_argument("--baseline-git-ref")
    parser.add_argument("--candidate-git-ref")
    parser.add_argument("--runs-per-config", type=int, default=1)
    parser.add_argument("--workspace-root", type=Path, help="Exact subject workspace. Default: dist/evals/<kind>/<subject>/<content-hash>")
    parser.add_argument("--run-id")
    parser.add_argument("--run-id-source", choices=["content", "git"], default="content")
    parser.add_argument("--require-clean-git", action="store_true")
    parser.add_argument("--history-db", type=Path, default=DEFAULT_HISTORY_DB)
    parser.add_argument("--no-history", action="store_true")
    parser.add_argument("--no-feedback", action="store_true")
    parser.add_argument("--skill-creator-dir", type=Path, default=skill_runner.DEFAULT_SKILL_CREATOR_DIR)
    parser.add_argument("--previous-workspace", type=Path)
    parser.add_argument("--review-output", type=Path)
    parser.add_argument("--max-turns", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--grade-timeout", type=int, default=300)
    parser.add_argument("--heartbeat-seconds", type=int, default=30)
    parser.add_argument("--provider")
    parser.add_argument("--model")
    parser.add_argument("--goose-cli", default=os.environ.get("GOOSE_EVAL_CLI"))
    parser.add_argument("--no-profile", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--ambient-goose", action="store_true")
    parser.add_argument("--keep-goose-home", action="store_true")
    parser.add_argument("--keep-worktrees", action="store_true")
    args = parser.parse_args()
    args.skill = args.subject
    args.goose_cli_resolved = skill_runner.resolve_goose_cli(args)

    eval_file = args.eval_file or (ROOT / "evals" / args.kind / f"{args.subject}.json")
    if not eval_file.exists():
        raise SystemExit(f"Eval file not found: {eval_file}")
    run_id = resolve_run_id(args, eval_file)
    if args.workspace_root is None:
        args.workspace_root = default_subject_workspace(args.subject, run_id, args.kind)
    scenarios = read_json(eval_file)
    if not isinstance(scenarios, list):
        raise SystemExit(f"{eval_file} must contain a JSON array")

    workspace = args.workspace_root
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    run_recipe_checks(args, workspace)

    configs = prepare_configs(args)
    for eval_id, scenario in enumerate(scenarios):
        query = scenario.get("query", "")
        eval_name = f"{args.subject}-{eval_id}-{skill_runner.slug(query)}"
        eval_dir = workspace / f"eval-{eval_id}"
        eval_dir.mkdir(parents=True, exist_ok=True)
        metadata = {
            "eval_id": eval_id,
            "eval_name": eval_name,
            "prompt": query,
            "assertions": skill_runner.scenario_assertions(scenario),
            "fixture_patch": scenario.get("fixture_patch"),
            "max_turns": scenario.get("max_turns", args.max_turns),
        }
        write_json(eval_dir / "eval_metadata.json", metadata)
        for config_name, config_description, material in configs:
            for run_number in range(1, args.runs_per_config + 1):
                run_dir = eval_dir / config_name / f"run-{run_number}"
                worktree = run_dir / "worktree"
                skill_runner.copy_worktree(ROOT, worktree)
                skill_runner.initialize_worktree_git(worktree)
                skill_runner.apply_fixture_patch(scenario, worktree)
                goose_env, goose_cwd, goose_home = skill_runner.prepare_goose_environment(args, run_dir)
                prompt = build_prompt(args, scenario, config_name, config_description, material, worktree)
                task_max_turns = int(scenario.get("max_turns", args.max_turns))
                label = f"{args.kind}/{args.subject} eval-{eval_id} {config_name} run-{run_number} task"
                print(f"[start] {label} max_turns={task_max_turns}", flush=True)
                try:
                    returncode, stdout, stderr, duration = skill_runner.run_command(
                        skill_runner.goose_cmd(args, prompt, max_turns=task_max_turns, output_format="stream-json"),
                        cwd=goose_cwd,
                        timeout=args.timeout,
                        env=goose_env,
                        heartbeat_label=label,
                        heartbeat_seconds=args.heartbeat_seconds,
                    )
                    print(f"[done] {label} rc={returncode} duration={duration:.1f}s", flush=True)
                except subprocess.TimeoutExpired as exc:
                    returncode = 124
                    stdout = exc.stdout or ""
                    stderr = (exc.stderr or "") + f"\nTimed out after {args.timeout}s"
                    duration = float(args.timeout)
                raw_stdout = stdout or ""
                events, transcript, response_text = skill_runner.parse_stream_json_output(raw_stdout)
                stdout = transcript or response_text or raw_stdout
                turns_used, max_turns_reached = skill_runner.count_turns_from_events(events, raw_stdout + "\n" + stdout + "\n" + (stderr or ""), task_max_turns)
                audit = skill_runner.build_audit(
                    events=events,
                    raw_stdout=raw_stdout,
                    transcript=stdout,
                    worktree=worktree,
                    turns_used=turns_used,
                    max_turns=task_max_turns,
                    max_turns_reached=max_turns_reached,
                    returncode=returncode,
                    duration=duration,
                )
                grader_label = f"{args.kind}/{args.subject} eval-{eval_id} {config_name} run-{run_number} grader"
                grading = skill_runner.grade_run(
                    args=args,
                    scenario=scenario,
                    config_name=config_name,
                    stdout=stdout,
                    stderr=stderr,
                    returncode=returncode,
                    goose_cwd=goose_cwd,
                    goose_env=goose_env,
                    heartbeat_label=grader_label,
                )
                feedback = skill_runner.generate_feedback(
                    args=args,
                    scenario=scenario,
                    config_name=config_name,
                    grading=grading,
                    audit=audit,
                    goose_cwd=goose_cwd,
                    goose_env=goose_env,
                    heartbeat_label=f"{args.kind}/{args.subject} eval-{eval_id} {config_name} run-{run_number} feedback",
                )
                skill_runner.write_run_artifacts(
                    run_dir=run_dir,
                    metadata=metadata,
                    prompt=prompt,
                    stdout=stdout,
                    stderr=stderr,
                    returncode=returncode,
                    duration=duration,
                    grading=grading,
                    turns_used=turns_used,
                    max_turns=task_max_turns,
                    max_turns_reached=max_turns_reached,
                    events=events,
                    raw_stdout=raw_stdout,
                    audit=audit,
                    feedback=feedback,
                )
                if goose_home and goose_home.exists() and not args.keep_goose_home:
                    shutil.rmtree(goose_home)
                if not args.keep_worktrees and worktree.exists():
                    shutil.rmtree(worktree)

    skill_runner.aggregate_and_render(args, workspace)
    benchmark_path = workspace / "benchmark.json"
    benchmark = read_json(benchmark_path) if benchmark_path.exists() else {}
    if not args.no_history:
        record_eval_run(
            db_path=args.history_db,
            run_id=run_id,
            kind=args.kind,
            subject=args.subject,
            content_hash_value=run_id if args.run_id_source == "content" else content_hash([subject_path(args.kind, args.subject)]),
            workspace=workspace,
            summary=benchmark,
            provider=args.provider,
            model=args.model,
        )
    print(f"Workspace: {workspace}")
    print(f"Kind: {args.kind}; subject={args.subject}; mode={args.mode}")
    print(f"Run id: {run_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
