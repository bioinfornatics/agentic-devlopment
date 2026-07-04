#!/usr/bin/env python3
"""Shared helpers for harness eval runners."""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVAL_KIND = "skills"
DEFAULT_HISTORY_DB = ROOT / "dist" / "evals" / "evaluation.db"


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


def resolve_provider_model(provider: str | None = None, model: str | None = None) -> tuple[str | None, str | None]:
    resolved_provider = provider or os.environ.get("GOOSE_PROVIDER")
    resolved_model = model or os.environ.get("GOOSE_MODEL")
    config = _read_goose_config()
    if not resolved_provider:
        resolved_provider = config.get("active_provider")
    if not resolved_model and resolved_provider:
        resolved_model = config.get(f"providers.{resolved_provider}.model")
    return resolved_provider, resolved_model


def _read_goose_config() -> dict[str, str]:
    config_path = Path.home() / ".config" / "goose" / "config.yaml"
    if not config_path.exists():
        return {}
    result: dict[str, str] = {}
    current_provider: str | None = None
    in_providers = False
    provider_indent: int | None = None
    try:
        lines = config_path.read_text(errors="replace").splitlines()
    except OSError:
        return {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line.startswith(" "):
            in_providers = stripped == "providers:"
            current_provider = None
            provider_indent = None
            match = re.match(r"active_provider:\s*['\"]?([^'\"]+)['\"]?\s*$", stripped)
            if match:
                result["active_provider"] = match.group(1)
            continue
        if not in_providers:
            continue
        indent = len(line) - len(line.lstrip(" "))
        provider_match = re.match(r"([A-Za-z0-9_.-]+):\s*$", stripped)
        if provider_match and indent >= 2:
            current_provider = provider_match.group(1)
            provider_indent = indent
            continue
        if current_provider and provider_indent is not None and indent > provider_indent:
            model_match = re.match(r"model:\s*['\"]?([^'\"]+)['\"]?\s*$", stripped)
            if model_match:
                result[f"providers.{current_provider}.model"] = model_match.group(1)
    return result


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


def skill_eval_hash_inputs(skill: str, eval_file: Path | None = None, *, root: Path = ROOT) -> list[Path]:
    return [root / ".agents" / "skills" / skill]


def suite_hash_inputs(skills: list[str], evals_dir: Path, *, root: Path = ROOT) -> list[Path]:
    paths: list[Path] = []
    for skill in skills:
        eval_file = evals_dir / f"{skill}.json"
        paths.extend(skill_eval_hash_inputs(skill, eval_file, root=root))
    return paths


def default_collection_root(kind: str = DEFAULT_EVAL_KIND, *, root: Path = ROOT) -> Path:
    return root / "dist" / "evals" / kind


def default_subject_workspace(subject: str, run_id: str, kind: str = DEFAULT_EVAL_KIND, *, root: Path = ROOT) -> Path:
    return default_collection_root(kind, root=root) / subject / run_id


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_history_db(path: Path = DEFAULT_HISTORY_DB) -> None:
    legacy = path.with_name("eval-history.sqlite3")
    if path.name == "evaluation.db" and legacy.exists() and not path.exists():
        legacy.rename(path)
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
                provider TEXT,
                model TEXT,
                turns_used_mean REAL,
                max_turns_mean REAL,
                max_turns_reached INTEGER,
                max_turns_reached_rate REAL,
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
                provider TEXT,
                model TEXT,
                baseline_turns_used_mean REAL,
                candidate_turns_used_mean REAL,
                baseline_max_turns_reached_rate REAL,
                candidate_max_turns_reached_rate REAL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_run_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                subject TEXT NOT NULL,
                eval_id INTEGER,
                configuration TEXT,
                run_number INTEGER,
                pass_rate REAL,
                turns_used INTEGER,
                max_turns INTEGER,
                max_turns_reached INTEGER,
                git_commit TEXT,
                provider TEXT,
                model TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_column(db, "eval_runs", "provider", "TEXT")
        _ensure_column(db, "eval_runs", "model", "TEXT")
        _ensure_column(db, "eval_runs", "turns_used_mean", "REAL")
        _ensure_column(db, "eval_runs", "max_turns_mean", "REAL")
        _ensure_column(db, "eval_runs", "max_turns_reached", "INTEGER")
        _ensure_column(db, "eval_runs", "max_turns_reached_rate", "REAL")
        _ensure_column(db, "eval_improvements", "provider", "TEXT")
        _ensure_column(db, "eval_improvements", "model", "TEXT")
        _ensure_column(db, "eval_improvements", "baseline_turns_used_mean", "REAL")
        _ensure_column(db, "eval_improvements", "candidate_turns_used_mean", "REAL")
        _ensure_column(db, "eval_improvements", "baseline_max_turns_reached_rate", "REAL")
        _ensure_column(db, "eval_improvements", "candidate_max_turns_reached_rate", "REAL")
        _ensure_column(db, "eval_run_results", "turns_used", "INTEGER")
        _ensure_column(db, "eval_run_results", "max_turns", "INTEGER")
        _ensure_column(db, "eval_run_results", "max_turns_reached", "INTEGER")
        _ensure_column(db, "eval_run_results", "provider", "TEXT")
        _ensure_column(db, "eval_run_results", "model", "TEXT")


def _ensure_column(db: sqlite3.Connection, table: str, column: str, column_type: str) -> None:
    columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")


def extract_turn_summary(summary: dict[str, Any]) -> dict[str, Any]:
    run_summary = summary.get("run_summary", summary) if isinstance(summary, dict) else {}
    if not isinstance(run_summary, dict):
        return {}
    configs = [value for key, value in run_summary.items() if key != "delta" and isinstance(value, dict)]
    turns = [_stat_mean(config, "turns_used") for config in configs]
    max_turns = [_stat_mean(config, "max_turns") for config in configs]
    hit_rates = [_stat_mean(config, "max_turns_reached") for config in configs]
    turns = [value for value in turns if value is not None]
    max_turns = [value for value in max_turns if value is not None]
    hit_rates = [value for value in hit_rates if value is not None]
    hit_rate = _mean(hit_rates)
    return {
        "turns_used_mean": _mean(turns),
        "max_turns_mean": _mean(max_turns),
        "max_turns_reached": None if hit_rate is None else int(hit_rate > 0),
        "max_turns_reached_rate": hit_rate,
    }


def record_eval_run(
    *,
    db_path: Path,
    run_id: str,
    kind: str,
    subject: str,
    content_hash_value: str | None,
    workspace: Path,
    summary: dict[str, Any] | None,
    provider: str | None = None,
    model: str | None = None,
) -> None:
    init_history_db(db_path)
    commit = git_commit()
    dirty = git_is_dirty()
    created = utc_now()
    resolved_provider, resolved_model = resolve_provider_model(provider, model)
    turn_summary = extract_turn_summary(summary or {})
    summary_json = json.dumps(summary or {}, sort_keys=True)
    with sqlite3.connect(db_path) as db:
        db.execute(
            """
            INSERT INTO eval_runs(
                run_id, kind, subject, content_hash, git_commit, git_dirty, provider, model,
                turns_used_mean, max_turns_mean, max_turns_reached, max_turns_reached_rate,
                workspace, summary_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                kind,
                subject,
                content_hash_value,
                str(commit) if commit else None,
                None if dirty is None else int(dirty),
                resolved_provider,
                resolved_model,
                turn_summary.get("turns_used_mean"),
                turn_summary.get("max_turns_mean"),
                turn_summary.get("max_turns_reached"),
                turn_summary.get("max_turns_reached_rate"),
                str(workspace),
                summary_json,
                created,
            ),
        )
        _record_improvements(db, run_id, kind, subject, summary or {}, commit, created, resolved_provider, resolved_model)
        _record_run_results(db, run_id, kind, subject, summary or {}, commit, created, resolved_provider, resolved_model)


def _record_run_results(
    db: sqlite3.Connection,
    run_id: str,
    kind: str,
    subject: str,
    summary: dict[str, Any],
    commit: str | None,
    created: str,
    provider: str | None,
    model: str | None,
) -> None:
    runs = summary.get("runs", []) if isinstance(summary, dict) else []
    if not isinstance(runs, list):
        return
    for run in runs:
        if not isinstance(run, dict):
            continue
        result = run.get("result", {}) if isinstance(run.get("result"), dict) else {}
        db.execute(
            """
            INSERT INTO eval_run_results(
                run_id, kind, subject, eval_id, configuration, run_number, pass_rate,
                turns_used, max_turns, max_turns_reached, git_commit, provider, model, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                kind,
                subject,
                run.get("eval_id"),
                run.get("configuration"),
                run.get("run_number"),
                result.get("pass_rate"),
                result.get("turns_used"),
                result.get("max_turns"),
                None if result.get("max_turns_reached") is None else int(bool(result.get("max_turns_reached"))),
                commit,
                provider,
                model,
                created,
            ),
        )


def _record_improvements(
    db: sqlite3.Connection,
    run_id: str,
    kind: str,
    subject: str,
    summary: dict[str, Any],
    commit: str | None,
    created: str,
    provider: str | None,
    model: str | None,
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
    baseline_turns = _metric_mean(run_summary, baseline_name, "turns_used")
    candidate_turns = _metric_mean(run_summary, candidate_name, "turns_used")
    baseline_hit_rate = _metric_mean(run_summary, baseline_name, "max_turns_reached")
    candidate_hit_rate = _metric_mean(run_summary, candidate_name, "max_turns_reached")
    db.execute(
        """
        INSERT INTO eval_improvements(
            run_id, kind, subject, metric, baseline, candidate, delta, git_commit, provider, model,
            baseline_turns_used_mean, candidate_turns_used_mean,
            baseline_max_turns_reached_rate, candidate_max_turns_reached_rate,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run_id, kind, subject, "pass_rate", baseline, candidate, candidate - baseline,
            commit, provider, model, baseline_turns, candidate_turns, baseline_hit_rate, candidate_hit_rate, created,
        ),
    )


def _metric_mean(run_summary: dict[str, Any], config: str, metric: str) -> float | None:
    return _stat_mean(run_summary.get(config, {}), metric)


def _stat_mean(config_summary: dict[str, Any], metric: str) -> float | None:
    value = config_summary.get(metric, {}).get("mean")
    return float(value) if value is not None else None


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 4) if values else None
