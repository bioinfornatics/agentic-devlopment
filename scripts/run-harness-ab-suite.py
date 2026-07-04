#!/usr/bin/env python3
"""Run A/B eval suites for skills, agents, or recipes."""
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
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from eval_utils import DEFAULT_HISTORY_DB, default_collection_root  # noqa: E402


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def fmt_pct(value: float | int | None) -> str:
    if value is None:
        return "—"
    return f"{float(value) * 100:.0f}%"


def relative_link(from_file: Path, target: Path) -> str:
    return target.resolve().relative_to(from_file.resolve().parent).as_posix()


def generate_index(*, output: Path, skills: list[str], workspace_root: Path, results: dict[str, dict[str, Any]], command: list[str]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    rates = []
    for subject in skills:
        status = results.get(subject, {})
        workspace = Path(status.get("workspace", workspace_root / subject))
        benchmark_path = workspace / "benchmark.json"
        summary_text = "No benchmark"
        if benchmark_path.exists():
            benchmark = read_json(benchmark_path)
            summary = benchmark.get("run_summary", {})
            cells = []
            for config in [name for name in summary.keys() if name != "delta"]:
                mean = summary.get(config, {}).get("pass_rate", {}).get("mean")
                if mean is not None:
                    rates.append(float(mean))
                cells.append(f"<strong>{html.escape(config)}</strong>: {fmt_pct(mean)}")
            delta = summary.get("delta", {}).get("pass_rate", "—")
            summary_text = "<br>".join(cells) + f"<br><span class='muted'>Δ pass-rate: {html.escape(str(delta))}</span>"
        links = []
        for name, file in [("review", workspace / "review.html"), ("benchmark.md", workspace / "benchmark.md")]:
            if file.exists():
                links.append(f"<a href='{html.escape(relative_link(output, file))}'>{name}</a>")
        rc = status.get("returncode")
        rows.append(f"<tr><td><code>{html.escape(subject)}</code></td><td>{'pass' if rc == 0 else 'fail'}</td><td>{summary_text}</td><td>{' · '.join(links) if links else '—'}</td></tr>")
    overall = sum(rates) / len(rates) if rates else None
    output.write_text(f"""<!doctype html><html><head><meta charset='utf-8'><title>A/B eval suite</title><style>body{{font-family:system-ui;margin:2rem}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ddd;padding:.6rem;vertical-align:top}}.muted{{color:#666}}</style></head><body><h1>A/B eval suite</h1><p>Mean pass rate: {fmt_pct(overall)}</p><p>Workspace root: <code>{html.escape(str(workspace_root))}</code></p><table><thead><tr><th>Subject</th><th>Status</th><th>Benchmark</th><th>Links</th></tr></thead><tbody>{''.join(rows)}</tbody></table><h2>Command</h2><pre>{html.escape(' '.join(command))}</pre></body></html>""")


def discover_subjects(evals_dir: Path) -> list[str]:
    return sorted(path.stem for path in evals_dir.glob("*.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run A/B eval suite for skills, agents, or recipes.")
    parser.add_argument("--kind", choices=["skills", "agents", "recipes"], required=True)
    parser.add_argument("--evals-dir", type=Path)
    parser.add_argument("--workspace-root", type=Path)
    parser.add_argument("--subjects", nargs="*")
    parser.add_argument("--mode", choices=["with-without"], default="with-without")
    parser.add_argument("--runs-per-config", type=int, default=1)
    parser.add_argument("--max-turns", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--grade-timeout", type=int, default=300)
    parser.add_argument("--heartbeat-seconds", type=int, default=30)
    parser.add_argument("--provider")
    parser.add_argument("--model")
    parser.add_argument("--goose-cli", default=os.environ.get("GOOSE_EVAL_CLI"))
    parser.add_argument("--history-db", type=Path, default=DEFAULT_HISTORY_DB)
    parser.add_argument("--no-history", action="store_true")
    parser.add_argument("--no-feedback", action="store_true")
    parser.add_argument("--ambient-goose", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--no-profile", action="store_true")
    parser.add_argument("--continue-on-failure", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    evals_dir = args.evals_dir or (ROOT / "evals" / args.kind)
    workspace_root = args.workspace_root or default_collection_root(args.kind)
    subjects = args.subjects or discover_subjects(evals_dir)
    if not subjects:
        raise SystemExit(f"No {args.kind} evals found under {evals_dir}")
    runner = ROOT / "scripts" / "run-harness-ab-eval.py"
    results: dict[str, dict[str, Any]] = {}
    for subject in subjects:
        cmd = [
            sys.executable,
            str(runner),
            "--kind", args.kind,
            "--subject", subject,
            "--eval-file", str(evals_dir / f"{subject}.json"),
            "--runs-per-config", str(args.runs_per_config),
            "--max-turns", str(args.max_turns),
            "--timeout", str(args.timeout),
            "--grade-timeout", str(args.grade_timeout),
            "--heartbeat-seconds", str(args.heartbeat_seconds),
        ]
        if args.provider:
            cmd.extend(["--provider", args.provider])
        if args.model:
            cmd.extend(["--model", args.model])
        if args.goose_cli:
            cmd.extend(["--goose-cli", args.goose_cli])
        if args.history_db and not args.no_history:
            cmd.extend(["--history-db", str(args.history_db)])
        if args.no_history:
            cmd.append("--no-history")
        if args.no_feedback:
            cmd.append("--no-feedback")
        if args.ambient_goose:
            cmd.append("--ambient-goose")
        if args.quiet:
            cmd.append("--quiet")
        if args.no_profile:
            cmd.append("--no-profile")
        started = datetime.now(timezone.utc)
        print(f"== Running {args.kind} eval suite item: {subject} ==", flush=True)
        proc = subprocess.run(cmd, cwd=ROOT)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        # Find latest workspace for links.
        subject_dir = workspace_root / subject
        workspace = max((p for p in subject_dir.iterdir() if (p / "benchmark.json").exists()), key=lambda p: (p / "benchmark.json").stat().st_mtime, default=subject_dir) if subject_dir.exists() else subject_dir
        results[subject] = {"returncode": proc.returncode, "command": cmd, "workspace": str(workspace)}
        print(f"[done] {args.kind} subject={subject} rc={proc.returncode} duration={elapsed:.1f}s", flush=True)
        if proc.returncode != 0 and not args.continue_on_failure:
            break
    output = args.output or (workspace_root / "index.html")
    generate_index(output=output, skills=subjects, workspace_root=workspace_root, results=results, command=sys.argv)
    print(f"Suite index written to {output}")
    return 0 if all(item["returncode"] == 0 for item in results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
