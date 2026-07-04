#!/usr/bin/env python3
"""Shared helpers for harness eval runners."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVAL_KIND = "skills"
DEFAULT_HISTORY_DB = ROOT / "dist" / "evals" / "eval-history.sqlite3"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def git_commit(root: Path = ROOT) -> str | None:
    proc = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def git_is_dirty(root: Path = ROOT) -> bool | None:
    proc = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    if proc.returncode != 0:
        return None
    return bool(proc.stdout.strip())


def iter_files(paths: Iterable[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if not path.exists():
            continue
        if path.is_file():
            files.append(path)
            continue
        if path.is_dir():
            for child in path.rglob("*"):
                if child.is_file() and not any(part in {"__pycache__", ".pytest_cache"} for part in child.parts):
                    files.append(child)
    return sorted({path.resolve() for path in files}, key=lambda item: item.as_posix())


def content_hash(paths: Iterable[Path], *, root: Path = ROOT, length: int = 16) -> str:
    digest = hashlib.sha256()
    for path in iter_files(paths):
        try:
            rel = path.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            rel = path.resolve().as_posix()
        digest.update(rel.encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:length]


def skills_referenced_by_eval(eval_file: Path) -> list[str]:
    data = read_json(eval_file)
    names: set[str] = set()
    if isinstance(data, list):
        for scenario in data:
            if isinstance(scenario, dict):
                for name in scenario.get("skills", []):
                    if isinstance(name, str):
                        names.add(name)
    return sorted(names)


def skill_eval_hash_inputs(skill: str, eval_file: Path, *, root: Path = ROOT) -> list[Path]:
    paths = [eval_file]
    names = set(skills_referenced_by_eval(eval_file)) or {skill}
    names.add(skill)
    for name in sorted(names):
        paths.append(root / ".agents" / "skills" / name)
    return paths


def suite_hash_inputs(skills: list[str], evals_dir: Path, *, root: Path = ROOT) -> list[Path]:
    paths: list[Path] = []
    for skill in skills:
        eval_file = evals_dir / f"{skill}.json"
        paths.extend(skill_eval_hash_inputs(skill, eval_file, root=root))
    return paths


def default_workspace_root(run_id: str, kind: str = DEFAULT_EVAL_KIND, *, root: Path = ROOT) -> Path:
    return root / "dist" / "evals" / run_id / kind


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_history_db(path: Path = DEFAULT_HISTORY_DB) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                subject TEXT NOT NULL,
                content_hash TEXT,
                git_commit TEXT,
                git_dirty INTEGER,
                workspace TEXT NOT NULL,
                summary_json TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_improvements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                subject TEXT NOT NULL,
                metric TEXT NOT NULL,
                baseline REAL,
                candidate REAL,
                delta REAL,
                git_commit TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def record_eval_run(
    *,
    db_path: Path,
    run_id: str,
    kind: str,
    subject: str,
    content_hash_value: str | None,
    workspace: Path,
    summary: dict[str, Any] | None,
) -> None:
    init_history_db(db_path)
    commit = git_commit()
    dirty = git_is_dirty()
    created = utc_now()
    summary_json = json.dumps(summary or {}, sort_keys=True)
    with sqlite3.connect(db_path) as db:
        db.execute(
            """
            INSERT INTO eval_runs(run_id, kind, subject, content_hash, git_commit, git_dirty, workspace, summary_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                kind,
                subject,
                content_hash_value,
                str(commit) if commit else None,
                None if dirty is None else int(dirty),
                str(workspace),
                summary_json,
                created,
            ),
        )
        _record_improvements(db, run_id, kind, subject, summary or {}, commit, created)


def _record_improvements(
    db: sqlite3.Connection,
    run_id: str,
    kind: str,
    subject: str,
    summary: dict[str, Any],
    commit: str | None,
    created: str,
) -> None:
    run_summary = summary.get("run_summary", summary) if isinstance(summary, dict) else {}
    if not isinstance(run_summary, dict):
        return
    configs = [name for name in run_summary.keys() if name != "delta"]
    if "with_skill" in configs and "without_skill" in configs:
        baseline_name, candidate_name = "without_skill", "with_skill"
    elif "old_skill" in configs and "new_skill" in configs:
        baseline_name, candidate_name = "old_skill", "new_skill"
    else:
        return
    baseline = _metric_mean(run_summary, baseline_name, "pass_rate")
    candidate = _metric_mean(run_summary, candidate_name, "pass_rate")
    if baseline is None or candidate is None:
        return
    db.execute(
        """
        INSERT INTO eval_improvements(run_id, kind, subject, metric, baseline, candidate, delta, git_commit, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (run_id, kind, subject, "pass_rate", baseline, candidate, candidate - baseline, commit, created),
    )


def _metric_mean(run_summary: dict[str, Any], config: str, metric: str) -> float | None:
    value = run_summary.get(config, {}).get(metric, {}).get("mean")
    return float(value) if value is not None else None
