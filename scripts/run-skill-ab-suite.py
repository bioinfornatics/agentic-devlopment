#!/usr/bin/env python3
"""Run the full project skill A/B eval suite and generate an HTML index."""
from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GOOSE_CLI_ENV = "GOOSE_EVAL_CLI"
DEFAULT_EVAL_KIND = "skills"


def current_eval_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def default_workspace_root() -> Path:
    return ROOT / "dist" / "evals" / current_eval_timestamp() / DEFAULT_EVAL_KIND


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def discover_skills(evals_dir: Path) -> list[str]:
    return sorted(path.stem for path in evals_dir.glob("*.json"))


def relative_link(from_file: Path, target: Path) -> str:
    return target.resolve().relative_to(from_file.resolve().parent).as_posix()


def load_benchmark(workspace: Path) -> dict[str, Any] | None:
    path = workspace / "benchmark.json"
    if not path.exists():
        return None
    try:
        data = read_json(path)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def fmt_pct(value: float | int | None) -> str:
    if value is None:
        return "—"
    return f"{float(value) * 100:.0f}%"


def generate_index(
    *,
    output: Path,
    skills: list[str],
    iteration: int,
    workspace_root: Path,
    results: dict[str, dict[str, Any]],
    command: list[str],
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    rows: list[str] = []
    cards: list[str] = []
    overall_rates: list[float] = []

    for skill in skills:
        workspace = workspace_root / skill / f"iteration-{iteration}"
        benchmark = load_benchmark(workspace)
        review = workspace / "review.html"
        benchmark_md = workspace / "benchmark.md"
        run_status = results.get(skill, {})
        rc = run_status.get("returncode")
        status_label = "pass" if rc == 0 else "fail"
        status_class = "ok" if rc == 0 else "bad"

        config_cells = []
        config_summary = "No benchmark"
        if benchmark:
            summary = benchmark.get("run_summary", {})
            configs = [name for name in summary.keys() if name != "delta"]
            for config in configs:
                stat = summary.get(config, {}).get("pass_rate", {})
                mean = stat.get("mean")
                if mean is not None:
                    overall_rates.append(float(mean))
                config_cells.append(f"<strong>{html.escape(config)}</strong>: {fmt_pct(mean)}")
            delta = summary.get("delta", {}).get("pass_rate", "—")
            config_summary = "<br>".join(config_cells) + f"<br><span class='muted'>Δ pass-rate: {html.escape(str(delta))}</span>"

        review_link = relative_link(output, review) if review.exists() else ""
        bench_link = relative_link(output, benchmark_md) if benchmark_md.exists() else ""
        links = []
        if review_link:
            links.append(f"<a href='{html.escape(review_link)}'>review</a>")
        if bench_link:
            links.append(f"<a href='{html.escape(bench_link)}'>benchmark.md</a>")

        rows.append(
            "<tr>"
            f"<td><code>{html.escape(skill)}</code></td>"
            f"<td><span class='{status_class}'>{status_label}</span></td>"
            f"<td>{config_summary}</td>"
            f"<td>{' · '.join(links) if links else '—'}</td>"
            "</tr>"
        )
        cards.append(
            f"<li><strong>{html.escape(skill)}</strong>: {config_summary.replace('<br>', '; ')}</li>"
        )

    overall = sum(overall_rates) / len(overall_rates) if overall_rates else None
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    command_text = " ".join(command)
    content = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skill A/B eval suite — iteration {iteration}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 2rem; line-height: 1.5; color: #1f2937; }}
    h1 {{ margin-bottom: 0.25rem; }}
    .muted {{ color: #6b7280; }}
    .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 1.5rem 0; }}
    .card {{ border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem; background: #f9fafb; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 1rem; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 0.75rem; vertical-align: top; }}
    th {{ background: #f3f4f6; text-align: left; }}
    code {{ background: #f3f4f6; padding: 0.1rem 0.25rem; border-radius: 0.25rem; }}
    pre {{ background: #111827; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow: auto; }}
    a {{ color: #2563eb; }}
    .ok {{ color: #047857; font-weight: 700; }}
    .bad {{ color: #b91c1c; font-weight: 700; }}
  </style>
</head>
<body>
  <h1>Skill A/B eval suite</h1>
  <p class="muted">Iteration {iteration} · generated {html.escape(generated)}</p>
  <div class="summary">
    <div class="card"><strong>Skills</strong><br>{len(skills)}</div>
    <div class="card"><strong>Mean pass rate across configs</strong><br>{fmt_pct(overall)}</div>
    <div class="card"><strong>Workspace root</strong><br><code>{html.escape(str(workspace_root))}</code></div>
  </div>
  <h2>Results</h2>
  <table>
    <thead><tr><th>Skill</th><th>Runner status</th><th>Benchmark summary</th><th>Links</th></tr></thead>
    <tbody>
      {''.join(rows)}
    </tbody>
  </table>
  <h2>Command</h2>
  <pre>{html.escape(command_text)}</pre>
  <h2>How to read this</h2>
  <ul>
    <li>Open each <em>review</em> link for qualitative outputs and per-assertion grading.</li>
    <li>Use the benchmark summary to compare configurations, for example <code>with_skill</code> vs <code>without_skill</code>.</li>
    <li>Low or noisy scores may indicate a skill gap, an eval-design issue, or an insufficiently isolated baseline.</li>
  </ul>
</body>
</html>
"""
    output.write_text(content)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run all skill A/B evals and build a visual index.")
    parser.add_argument("--evals-dir", type=Path, default=ROOT / "evals" / "skills")
    parser.add_argument("--workspace-root", type=Path, help="Default: dist/evals/<timestamp>/skills")
    parser.add_argument("--iteration", type=int, default=1)
    parser.add_argument("--runs-per-config", type=int, default=1)
    parser.add_argument("--skills", nargs="*", help="Optional subset. Defaults to every evals/skills/*.json file.")
    parser.add_argument("--mode", choices=["with-without"], default="with-without", help="Suite currently supports the with/without baseline mode.")
    parser.add_argument("--max-turns", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--grade-timeout", type=int, default=300)
    parser.add_argument("--provider")
    parser.add_argument("--model")
    parser.add_argument(
        "--goose-cli",
        default=os.environ.get(DEFAULT_GOOSE_CLI_ENV),
        help=f"Goose CLI binary forwarded to per-skill runs. Defaults to ${DEFAULT_GOOSE_CLI_ENV} when set, otherwise 'goose'.",
    )
    parser.add_argument("--no-profile", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--ambient-goose",
        action="store_true",
        help="Forward --ambient-goose to per-skill runs. By default runs use isolated Goose homes that hide installed skills, agents, and recipes.",
    )
    parser.add_argument("--continue-on-failure", action="store_true", help="Continue remaining skills if one runner exits non-zero.")
    parser.add_argument(
        "--include-grading-hints",
        action="store_true",
        help="Debug mode: forward expected_behavior and baseline_gaps into task prompts. Default keeps them grader-only.",
    )
    parser.add_argument("--output", type=Path, help="Default: <workspace-root>/iteration-<N>-index.html")
    args = parser.parse_args()
    if args.workspace_root is None:
        args.workspace_root = default_workspace_root()

    skills = args.skills or discover_skills(args.evals_dir)
    if not skills:
        raise SystemExit(f"No skill evals found under {args.evals_dir}")

    runner = ROOT / "scripts" / "run-skill-ab-eval.py"
    if not runner.exists():
        raise SystemExit(f"Runner not found: {runner}")

    results: dict[str, dict[str, Any]] = {}
    for skill in skills:
        cmd = [
            sys.executable,
            str(runner),
            "--skill",
            skill,
            "--iteration",
            str(args.iteration),
            "--runs-per-config",
            str(args.runs_per_config),
            "--workspace-root",
            str(args.workspace_root),
            "--max-turns",
            str(args.max_turns),
            "--timeout",
            str(args.timeout),
            "--grade-timeout",
            str(args.grade_timeout),
        ]
        if args.provider:
            cmd.extend(["--provider", args.provider])
        if args.model:
            cmd.extend(["--model", args.model])
        if args.goose_cli:
            cmd.extend(["--goose-cli", args.goose_cli])
        if args.no_profile:
            cmd.append("--no-profile")
        if args.quiet:
            cmd.append("--quiet")
        if args.ambient_goose:
            cmd.append("--ambient-goose")
        if args.include_grading_hints:
            cmd.append("--include-grading-hints")

        print(f"== Running skill eval suite item: {skill} ==")
        proc = subprocess.run(cmd, cwd=ROOT)
        results[skill] = {"returncode": proc.returncode, "command": cmd}
        if proc.returncode != 0 and not args.continue_on_failure:
            output = args.output or (args.workspace_root / f"iteration-{args.iteration}-index.html")
            generate_index(output=output, skills=skills, iteration=args.iteration, workspace_root=args.workspace_root, results=results, command=sys.argv)
            latest = args.workspace_root / "index.html"
            latest.write_text(output.read_text())
            raise SystemExit(proc.returncode)

    output = args.output or (args.workspace_root / f"iteration-{args.iteration}-index.html")
    generate_index(output=output, skills=skills, iteration=args.iteration, workspace_root=args.workspace_root, results=results, command=sys.argv)
    latest = args.workspace_root / "index.html"
    latest.write_text(output.read_text())
    print(f"Suite index written to {output}")
    print(f"Latest suite index written to {latest}")
    return 0 if all(item["returncode"] == 0 for item in results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
