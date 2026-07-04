#!/usr/bin/env python3
"""Run real A/B evaluations for project skills.

The canonical eval definitions live in evals/skills/<skill>.json. This runner
executes each scenario with two configurations and writes a workspace compatible
with skill-creator's eval viewer and benchmark aggregator.

Supported comparisons:
- with-without: with_skill vs without_skill
- old-new:      new_skill vs old_skill

Runs execute in copied worktrees under the eval workspace so prompts that edit
files do not mutate the source checkout.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shlex
import re
import shutil
import subprocess
import sys
import tarfile
import textwrap
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from eval_utils import (  # noqa: E402
    DEFAULT_EVAL_KIND,
    DEFAULT_HISTORY_DB,
    content_hash,
    default_workspace_root,
    git_commit,
    git_is_dirty,
    record_eval_run,
    skill_eval_hash_inputs,
)

DEFAULT_SKILL_CREATOR_DIR = Path.home() / ".agents" / "skills" / "skill-creator"
DEFAULT_GOOSE_CLI_ENV = "GOOSE_EVAL_CLI"


@dataclass(frozen=True)
class Config:
    name: str
    description: str
    skill_dirs: tuple[Path, ...] = ()
    baseline_note: str = ""
    include_grading_hints: bool = False


def slug(value: str, limit: int = 64) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return (text or "eval")[:limit]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def copy_minimal_goose_config(home: Path) -> None:
    """Create an isolated Goose home with provider config but no project skills/agents/recipes."""
    config_src = Path.home() / ".config" / "goose"
    config_dst = home / ".config" / "goose"
    agents_dst = home / ".agents"
    (agents_dst / "skills").mkdir(parents=True, exist_ok=True)
    (agents_dst / "agents").mkdir(parents=True, exist_ok=True)
    config_dst.mkdir(parents=True, exist_ok=True)

    # Copy only lightweight config needed for provider setup. Do not copy recipes,
    # sessions, caches, or installed skill/agent directories.
    for name in ["config.yaml", "permission.yaml"]:
        src = config_src / name
        if src.exists():
            shutil.copy2(src, config_dst / name)
    custom_src = config_src / "custom_providers"
    if custom_src.exists():
        shutil.copytree(custom_src, config_dst / "custom_providers", dirs_exist_ok=True)


def prepare_goose_environment(args: argparse.Namespace, run_dir: Path) -> tuple[dict[str, str], Path, Path | None]:
    """Return env, neutral cwd, and optional isolated home for a Goose subprocess.

    The isolated cwd intentionally lives under the temporary HOME, not under the
    repository. Goose discovers project-local `.agents` and `.goose` by walking
    from the current directory, so a cwd under `dist/` would still expose this
    repo's installed skills/agents/recipes to the baseline.
    """
    env = os.environ.copy()
    if args.ambient_goose:
        neutral_cwd = run_dir / "goose-cwd"
        neutral_cwd.mkdir(parents=True, exist_ok=True)
        return env, neutral_cwd, None

    home = run_dir / "goose-home"
    if home.exists():
        shutil.rmtree(home)
    copy_minimal_goose_config(home)
    neutral_cwd = home / "cwd"
    neutral_cwd.mkdir(parents=True, exist_ok=True)
    env["HOME"] = str(home)
    env["XDG_CONFIG_HOME"] = str(home / ".config")
    return env, neutral_cwd, home


def safe_extract_tar(data: bytes, dest: Path) -> None:
    """Extract a git archive tar into dest without allowing path traversal."""
    dest = dest.resolve()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as tar:
        for member in tar.getmembers():
            target = (dest / member.name).resolve()
            if not str(target).startswith(str(dest) + os.sep) and target != dest:
                raise RuntimeError(f"Refusing unsafe tar member: {member.name}")
        tar.extractall(dest)


def materialize_skill_from_git(ref: str, skill: str, dest_root: Path) -> Path:
    """Export .agents/skills/<skill> from a git ref into dest_root and return the skill dir."""
    rel = Path(".agents") / "skills" / skill
    if dest_root.exists():
        shutil.rmtree(dest_root)
    dest_root.mkdir(parents=True, exist_ok=True)

    # Verify the path exists at the requested ref so git archive errors are clearer.
    check = subprocess.run(
        ["git", "cat-file", "-e", f"{ref}:{rel.as_posix()}/SKILL.md"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if check.returncode != 0:
        raise SystemExit(f"Skill {rel} not found at git ref {ref!r}")

    archive = subprocess.run(
        ["git", "archive", "--format=tar", ref, rel.as_posix()],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    safe_extract_tar(archive.stdout, dest_root)
    skill_dir = dest_root / rel
    if not (skill_dir / "SKILL.md").exists():
        raise SystemExit(f"Git ref {ref!r} did not produce {skill_dir / 'SKILL.md'}")
    return skill_dir.resolve()


def resolve_old_new_skill_dirs(args: argparse.Namespace, workspace: Path) -> tuple[Path, Path]:
    """Resolve candidate and baseline skill dirs for old-new mode."""
    if args.candidate_git_ref and args.candidate_skill_dir:
        raise SystemExit("Use either --candidate-git-ref or --candidate-skill-dir, not both")
    if args.baseline_git_ref and args.baseline_skill_dir:
        raise SystemExit("Use either --baseline-git-ref or --baseline-skill-dir, not both")

    if args.candidate_git_ref:
        candidate = materialize_skill_from_git(
            args.candidate_git_ref,
            args.skill,
            workspace / "_git-candidate" / slug(args.candidate_git_ref, 32),
        )
    else:
        candidate = (args.candidate_skill_dir or (ROOT / ".agents" / "skills" / args.skill)).resolve()

    if args.baseline_git_ref:
        baseline = materialize_skill_from_git(
            args.baseline_git_ref,
            args.skill,
            workspace / "_git-baseline" / slug(args.baseline_git_ref, 32),
        )
    else:
        baseline = (args.baseline_skill_dir or (Path.home() / ".agents" / "skills" / args.skill)).resolve()

    if not candidate.exists():
        raise SystemExit(f"Candidate skill directory not found: {candidate}")
    if not baseline.exists():
        raise SystemExit(
            f"Baseline skill directory not found: {baseline}. "
            "Pass --baseline-skill-dir, --baseline-git-ref, or install the original skill under ~/.agents/skills."
        )
    return candidate, baseline


def load_skill_bundle(skill_dir: Path) -> str:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        raise FileNotFoundError(f"Missing SKILL.md in {skill_dir}")
    sections = [f"## Skill: {skill_dir.name}\n\n```markdown\n{skill_md.read_text()}\n```"]
    # Keep bundled references available, but cap size to avoid huge prompts.
    references = skill_dir / "references"
    if references.exists():
        for ref in sorted(references.rglob("*")):
            if ref.is_file() and ref.stat().st_size <= 40_000:
                sections.append(
                    f"## Reference: {skill_dir.name}/{ref.relative_to(skill_dir)}\n\n"
                    f"```text\n{ref.read_text(errors='replace')}\n```"
                )
    return "\n\n".join(sections)


def scenario_assertions(scenario: dict[str, Any]) -> list[dict[str, str]]:
    return [{"text": item} for item in scenario.get("expected_behavior", [])]


def build_eval_prompt(
    *,
    skill_name: str,
    scenario: dict[str, Any],
    config: Config,
    repo_root: Path,
) -> str:
    skill_content = ""
    if config.skill_dirs:
        skill_content = "\n\n".join(load_skill_bundle(path) for path in config.skill_dirs)
    else:
        skill_content = (
            "No project skill content is provided for this baseline run. "
            "Do not load or intentionally follow the target project skill."
        )

    files = scenario.get("files", [])
    grading_hints = ""
    if getattr(config, "include_grading_hints", False):
        grading_hints = textwrap.dedent(
            f"""

            Expected behaviors that the grader will check:
            {json.dumps(scenario.get("expected_behavior", []), indent=2, ensure_ascii=False)}

            Baseline gaps this scenario is meant to expose:
            {json.dumps(scenario.get("baseline_gaps", []), indent=2, ensure_ascii=False)}
            """
        )

    return textwrap.dedent(
        f"""
        You are running a controlled A/B evaluation for the `{skill_name}` skill in this repository.

        Configuration: {config.name}
        Configuration description: {config.description}
        {config.baseline_note}

        Repository worktree: {repo_root}

        Safety and isolation rules:
        - You are inside an isolated copied worktree for this eval run.
        - Complete the user task as realistically as possible for this configuration.
        - If the task asks for repository changes, make only the minimum relevant changes in the isolated worktree.
        - Do not access or modify the source checkout outside the isolated worktree.
        - When you finish, report exactly what you did, what evidence you inspected, validation commands run, and remaining risks.

        Skill material for this configuration:
        {skill_content}

        Eval input files or paths of interest:
        {json.dumps(files, indent=2, ensure_ascii=False)}
        {grading_hints}

        User task:
        {scenario.get('query', '')}
        """
    ).strip()


def build_grader_prompt(
    *,
    scenario: dict[str, Any],
    config_name: str,
    stdout: str,
    stderr: str,
    returncode: int,
) -> str:
    expectations = scenario.get("expected_behavior", [])
    return textwrap.dedent(
        f"""
        Grade this skill evaluation run. Return JSON only, with no Markdown fences.

        Configuration: {config_name}
        User query: {scenario.get('query', '')}

        Expected behaviors to grade:
        {json.dumps(expectations, indent=2, ensure_ascii=False)}

        Run return code: {returncode}

        Run stdout:
        ```text
        {stdout[-24000:]}
        ```

        Run stderr:
        ```text
        {stderr[-8000:]}
        ```

        Required JSON schema:
        {{
          "expectations": [
            {{"text": "same expected behavior text", "passed": true, "evidence": "brief concrete evidence from the run output"}}
          ],
          "notes": ["brief note if useful"]
        }}

        Grade strictly. A behavior passes only if the run output demonstrates it. If the process failed before producing a usable answer, mark expectations false unless the output still proves them.
        """
    ).strip()


def extract_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text:
        return None
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        return None
    return None



def summarize_grading(expectations: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(expectations)
    passed = sum(1 for exp in expectations if exp.get("passed") is True)
    failed = total - passed
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": round(passed / total, 4) if total else 0.0,
    }


def run_command(
    cmd: list[str],
    *,
    cwd: Path,
    timeout: int,
    env: dict[str, str] | None = None,
) -> tuple[int, str, str, float]:
    started = time.monotonic()
    proc = subprocess.run(
        cmd,
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    duration = time.monotonic() - started
    return proc.returncode, proc.stdout, proc.stderr, duration


def resolve_goose_cli(args: argparse.Namespace) -> str:
    cli = args.goose_cli or os.environ.get(DEFAULT_GOOSE_CLI_ENV) or "goose"
    if not any(sep in cli for sep in (os.sep, "/")):
        return cli
    path = Path(cli).expanduser()
    return str(path.resolve() if path.is_absolute() else (ROOT / path).resolve())


def goose_cmd(args: argparse.Namespace, prompt: str) -> list[str]:
    cmd = [resolve_goose_cli(args), "run", "--no-session", "--text", prompt, "--max-turns", str(args.max_turns)]
    if args.no_profile:
        cmd.append("--no-profile")
    if args.provider:
        cmd.extend(["--provider", args.provider])
    if args.model:
        cmd.extend(["--model", args.model])
    if args.quiet:
        cmd.append("--quiet")
    return cmd


def copy_worktree(source: Path, dest: Path) -> None:
    ignore_names = {
        ".git",
        "dist/evals",
        "dist/skill-eval-review",
        "__pycache__",
        ".pytest_cache",
        "node_modules",
    }

    def ignore(dir_path: str, names: list[str]) -> set[str]:
        ignored: set[str] = set()
        base = Path(dir_path)
        for name in names:
            rel = (base / name).relative_to(source) if (base / name).is_relative_to(source) else Path(name)
            rel_posix = rel.as_posix()
            if name in {".git", "__pycache__", ".pytest_cache", "node_modules"} or rel_posix in ignore_names:
                ignored.add(name)
        return ignored

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source, dest, ignore=ignore)


def prepare_configs(args: argparse.Namespace, scenario: dict[str, Any]) -> list[Config]:
    if args.mode == "with-without":
        skill_names = scenario.get("skills") or [args.skill]
        skill_dirs = tuple(ROOT / ".agents" / "skills" / name for name in skill_names)
        return [
            Config(
                name="with_skill",
                description=f"Run with project skill material for: {', '.join(skill_names)}.",
                skill_dirs=skill_dirs,
            ),
            Config(
                name="without_skill",
                description="Baseline run without project skill material injected into the prompt.",
                baseline_note=f"Do not load or intentionally follow `{args.skill}` or the scenario's listed project skills.",
            ),
        ]
    if args.mode == "old-new":
        candidate = args._resolved_candidate_skill_dir
        baseline = args._resolved_baseline_skill_dir
        return [
            Config(
                name="new_skill",
                description=f"Candidate skill from {candidate}.",
                skill_dirs=(candidate,),
            ),
            Config(
                name="old_skill",
                description=f"Baseline/original skill from {baseline}.",
                skill_dirs=(baseline,),
            ),
        ]
    raise SystemExit(f"Unsupported mode: {args.mode}")


def grade_run(
    *,
    args: argparse.Namespace,
    scenario: dict[str, Any],
    config_name: str,
    stdout: str,
    stderr: str,
    returncode: int,
    goose_cwd: Path,
    goose_env: dict[str, str],
) -> dict[str, Any]:
    prompt = build_grader_prompt(
        scenario=scenario,
        config_name=config_name,
        stdout=stdout,
        stderr=stderr,
        returncode=returncode,
    )
    try:
        rc, out, err, _duration = run_command(
            goose_cmd(args, prompt),
            cwd=goose_cwd,
            timeout=args.grade_timeout,
            env=goose_env,
        )
    except Exception as exc:  # noqa: BLE001 - preserve eval output instead of crashing late
        return {
            "expectations": [
                {"text": item, "passed": False, "evidence": f"LLM grader failed to start: {exc}"}
                for item in scenario.get("expected_behavior", [])
            ],
            "notes": ["LLM grader failed to start"],
        }

    parsed = extract_json_object(out)
    if rc != 0 or not parsed or "expectations" not in parsed:
        return {
            "expectations": [
                {
                    "text": item,
                    "passed": False,
                    "evidence": "LLM grader failed or returned invalid JSON; no automatic grade was produced.",
                }
                for item in scenario.get("expected_behavior", [])
            ],
            "notes": [f"LLM grader failed or returned invalid JSON; grader_rc={rc}; grader_stderr={err[-500:]}"]
        }
    return parsed


def write_run_artifacts(
    *,
    run_dir: Path,
    metadata: dict[str, Any],
    prompt: str,
    stdout: str,
    stderr: str,
    returncode: int,
    duration: float,
    grading: dict[str, Any],
) -> None:
    outputs_dir = run_dir / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    write_json(run_dir / "eval_metadata.json", metadata)
    (outputs_dir / "prompt.md").write_text(prompt)
    (outputs_dir / "response.md").write_text(stdout or "")
    if stderr:
        (outputs_dir / "stderr.txt").write_text(stderr)
    write_json(
        run_dir / "timing.json",
        {
            "duration_ms": round(duration * 1000),
            "total_duration_seconds": round(duration, 3),
            "total_tokens": max(0, len(stdout) // 4),
            "returncode": returncode,
        },
    )
    expectations = grading.get("expectations", [])
    normalized = []
    for exp in expectations:
        if not isinstance(exp, dict):
            continue
        normalized.append(
            {
                "text": str(exp.get("text", "")),
                "passed": bool(exp.get("passed", False)),
                "evidence": str(exp.get("evidence", "")),
            }
        )
    # Preserve missing expectations as failed so pass rates stay meaningful.
    seen = {exp["text"] for exp in normalized}
    for assertion in metadata.get("assertions", []):
        text = assertion.get("text", "")
        if text and text not in seen:
            normalized.append({"text": text, "passed": False, "evidence": "No grade returned for this assertion."})

    grading_out = {
        "summary": summarize_grading(normalized),
        "expectations": normalized,
        "user_notes_summary": {"needs_review": grading.get("notes", [])},
        "execution_metrics": {
            "output_chars": len(stdout),
            "stderr_chars": len(stderr),
            "errors_encountered": 0 if returncode == 0 else 1,
        },
    }
    write_json(run_dir / "grading.json", grading_out)


def aggregate_and_render(args: argparse.Namespace, workspace: Path) -> None:
    skill_creator_dir = args.skill_creator_dir.resolve()
    aggregate = skill_creator_dir / "scripts" / "aggregate_benchmark.py"
    generate_review = skill_creator_dir / "eval-viewer" / "generate_review.py"
    if not aggregate.exists() or not generate_review.exists():
        print(f"warning: skill-creator scripts not found under {skill_creator_dir}; skipping viewer", file=sys.stderr)
        return

    subprocess.run(
        [sys.executable, "-m", "scripts.aggregate_benchmark", str(workspace.resolve()), "--skill-name", args.skill],
        cwd=skill_creator_dir,
        check=True,
    )

    # Patch eval names into benchmark.json for a clearer per-eval table.
    benchmark_path = workspace / "benchmark.json"
    if benchmark_path.exists():
        benchmark = read_json(benchmark_path)
        id_to_name = {}
        for meta in workspace.glob("eval-*/eval_metadata.json"):
            try:
                data = read_json(meta)
                id_to_name[data.get("eval_id")] = data.get("eval_name")
            except Exception:
                pass
        for run in benchmark.get("runs", []):
            if run.get("eval_id") in id_to_name:
                run["eval_name"] = id_to_name[run.get("eval_id")]
        write_json(benchmark_path, benchmark)

    review_output = args.review_output or (workspace / "review.html")
    cmd = [
        sys.executable,
        str(generate_review),
        str(workspace),
        "--skill-name",
        args.skill,
        "--benchmark",
        str(benchmark_path),
        "--static",
        str(review_output),
    ]
    if args.previous_workspace:
        cmd.extend(["--previous-workspace", str(args.previous_workspace)])
    subprocess.run(cmd, check=True)
    print(f"Review written to {review_output}")


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
    return content_hash(skill_eval_hash_inputs(args.skill, eval_file))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run real A/B evals for one project skill.")
    parser.add_argument("--skill", required=True, help="Skill/eval name, e.g. code-review")
    parser.add_argument("--eval-file", type=Path, help="Defaults to evals/skills/<skill>.json")
    parser.add_argument("--mode", choices=["with-without", "old-new"], default="with-without")
    parser.add_argument("--baseline-skill-dir", type=Path, help="Old skill directory for old-new mode. Mutually exclusive with --baseline-git-ref.")
    parser.add_argument("--candidate-skill-dir", type=Path, help="New skill directory for old-new mode. Mutually exclusive with --candidate-git-ref.")
    parser.add_argument("--baseline-git-ref", help="Git ref to use as old_skill in old-new mode, e.g. HEAD, HEAD~1, origin/main, or a tag.")
    parser.add_argument("--candidate-git-ref", help="Git ref to use as new_skill in old-new mode. Defaults to the working-tree skill directory.")
    parser.add_argument("--runs-per-config", type=int, default=1)
    parser.add_argument("--workspace-root", type=Path, help="Default: dist/evals/<content-hash>/skills")
    parser.add_argument("--run-id", help="Run id used for metadata/history. Usually passed by the suite runner.")
    parser.add_argument("--run-id-source", choices=["content", "git"], default="content", help="How to derive the default dist/evals/<run-id> directory. Default: content hash of this eval definition and referenced skills.")
    parser.add_argument("--require-clean-git", action="store_true", help="Fail if the git working tree is dirty before running evals.")
    parser.add_argument("--history-db", type=Path, default=DEFAULT_HISTORY_DB, help="SQLite DB used to record eval history. Default: dist/evals/eval-history.sqlite3")
    parser.add_argument("--no-history", action="store_true", help="Do not record this run in the eval history database.")
    parser.add_argument("--skill-creator-dir", type=Path, default=DEFAULT_SKILL_CREATOR_DIR)
    parser.add_argument("--previous-workspace", type=Path)
    parser.add_argument("--review-output", type=Path)
    parser.add_argument("--max-turns", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--grade-timeout", type=int, default=300)
    parser.add_argument("--provider")
    parser.add_argument("--model")
    parser.add_argument(
        "--goose-cli",
        default=os.environ.get(DEFAULT_GOOSE_CLI_ENV),
        help=f"Goose CLI binary to execute. Defaults to ${DEFAULT_GOOSE_CLI_ENV} when set, otherwise 'goose'.",
    )
    parser.add_argument("--no-profile", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--ambient-goose",
        action="store_true",
        help="Use the caller's normal Goose HOME/cwd discovery. By default runs use an isolated Goose home and neutral cwd so installed skills, agents, and recipes are hidden.",
    )
    parser.add_argument("--keep-goose-home", action="store_true", help="Keep the temporary isolated Goose home for debugging.")
    parser.add_argument("--keep-worktrees", action="store_true")
    parser.add_argument(
        "--include-grading-hints",
        action="store_true",
        help="Debug mode: include expected_behavior and baseline_gaps in task prompts. By default these are grader-only to avoid contaminating the baseline.",
    )
    args = parser.parse_args()

    eval_file = args.eval_file or (ROOT / "evals" / "skills" / f"{args.skill}.json")
    run_id = resolve_run_id(args, eval_file)
    content_hash_value = content_hash(skill_eval_hash_inputs(args.skill, eval_file))
    if args.workspace_root is None:
        args.workspace_root = default_workspace_root(run_id, DEFAULT_EVAL_KIND)
    scenarios = read_json(eval_file)
    if not isinstance(scenarios, list):
        raise SystemExit(f"{eval_file} must contain a JSON array")

    workspace = args.workspace_root / args.skill
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    if args.mode == "old-new":
        candidate, baseline = resolve_old_new_skill_dirs(args, workspace)
        args._resolved_candidate_skill_dir = candidate
        args._resolved_baseline_skill_dir = baseline
        write_json(
            workspace / "comparison.json",
            {
                "mode": args.mode,
                "skill": args.skill,
                "candidate_skill_dir": str(candidate),
                "baseline_skill_dir": str(baseline),
                "candidate_git_ref": args.candidate_git_ref,
                "baseline_git_ref": args.baseline_git_ref,
            },
        )

    for eval_id, scenario in enumerate(scenarios):
        query = scenario.get("query", "")
        eval_name = f"{args.skill}-{eval_id}-{slug(query)}"
        eval_dir = workspace / f"eval-{eval_id}"
        eval_dir.mkdir(parents=True, exist_ok=True)
        metadata = {
            "eval_id": eval_id,
            "eval_name": eval_name,
            "prompt": query,
            "assertions": scenario_assertions(scenario),
        }
        write_json(eval_dir / "eval_metadata.json", metadata)

        for config in prepare_configs(args, scenario):
            if args.include_grading_hints:
                config = Config(
                    name=config.name,
                    description=config.description,
                    skill_dirs=config.skill_dirs,
                    baseline_note=config.baseline_note,
                    include_grading_hints=True,
                )
            for run_number in range(1, args.runs_per_config + 1):
                run_dir = eval_dir / config.name / f"run-{run_number}"
                worktree = run_dir / "worktree"
                copy_worktree(ROOT, worktree)
                goose_env, goose_cwd, goose_home = prepare_goose_environment(args, run_dir)
                prompt = build_eval_prompt(
                    skill_name=args.skill,
                    scenario=scenario,
                    config=config,
                    repo_root=worktree,
                )

                try:
                    returncode, stdout, stderr, duration = run_command(
                        goose_cmd(args, prompt),
                        cwd=goose_cwd,
                        timeout=args.timeout,
                        env=goose_env,
                    )
                except subprocess.TimeoutExpired as exc:
                    returncode = 124
                    stdout = exc.stdout or ""
                    stderr = (exc.stderr or "") + f"\nTimed out after {args.timeout}s"
                    duration = float(args.timeout)

                grading = grade_run(
                    args=args,
                    scenario=scenario,
                    config_name=config.name,
                    stdout=stdout,
                    stderr=stderr,
                    returncode=returncode,
                    goose_cwd=goose_cwd,
                    goose_env=goose_env,
                )
                write_run_artifacts(
                    run_dir=run_dir,
                    metadata=metadata,
                    prompt=prompt,
                    stdout=stdout,
                    stderr=stderr,
                    returncode=returncode,
                    duration=duration,
                    grading=grading,
                )
                if goose_home and goose_home.exists() and not args.keep_goose_home:
                    shutil.rmtree(goose_home)
                if not args.keep_worktrees and worktree.exists():
                    shutil.rmtree(worktree)

    aggregate_and_render(args, workspace)
    benchmark_path = workspace / "benchmark.json"
    benchmark = read_json(benchmark_path) if benchmark_path.exists() else {}
    if not args.no_history:
        record_eval_run(
            db_path=args.history_db,
            run_id=run_id,
            kind=DEFAULT_EVAL_KIND,
            subject=args.skill,
            content_hash_value=content_hash_value,
            workspace=workspace,
            summary=benchmark,
        )
    print(f"Workspace: {workspace}")
    print(f"Mode: {args.mode}; grader=llm; ambient_goose={args.ambient_goose}")
    print(f"Goose CLI: {shlex.quote(resolve_goose_cli(args))}")
    print(f"Run id: {run_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
