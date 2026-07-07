#!/usr/bin/env python3
"""Export evaluation.db → evals/history/runs.json for GitHub Pages trend reporting.

Run after every suite run to persist results:
    python scripts/export-eval-history.py
    git add evals/history/runs.json
    git commit -m "chore: update eval history"
    git push
"""
from __future__ import annotations
import argparse, json, pathlib, sqlite3, sys

ROOT     = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_DB  = ROOT / "dist" / "evals" / "evaluation.db"
DEFAULT_OUT = ROOT / "evals" / "history" / "runs.json"


def export(db_path: pathlib.Path, out_file: pathlib.Path, merge: bool = True) -> int:
    if not db_path.exists():
        print(f"WARNING: {db_path} not found — nothing exported", file=sys.stderr)
        return 0

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row

    runs: list[dict] = []
    for row in con.execute("""
        SELECT run_id, kind, subject, content_hash,
               git_commit, git_dirty, provider, model,
               turns_used_mean, max_turns_mean, max_turns_reached_rate,
               created_at
        FROM eval_runs ORDER BY created_at
    """).fetchall():
        d = dict(row)
        d["scenarios"] = [dict(s) for s in con.execute("""
            SELECT eval_id, configuration, pass_rate, turns_used,
                   max_turns, max_turns_reached
            FROM eval_run_results WHERE run_id = ?
            ORDER BY eval_id, configuration
        """, (d["run_id"],)).fetchall()]
        # Attach scenario_hash from eval_scenario_analysis for comparability tracking
        d["scenario_hashes"] = {
            str(r[0]): r[1]
            for r in con.execute("""
                SELECT eval_id, scenario_hash FROM eval_scenario_analysis
                WHERE run_id = ? AND scenario_hash IS NOT NULL
                GROUP BY eval_id
            """, (d["run_id"],)).fetchall()
        }
        d["improvements"] = [dict(i) for i in con.execute("""
            SELECT metric, baseline, candidate, delta
            FROM eval_improvements WHERE run_id = ?
        """, (d["run_id"],)).fetchall()]
        runs.append(d)
    con.close()

    # Merge with existing history (deduplicate by run_id)
    existing: list[dict] = []
    if merge and out_file.exists():
        try:
            existing = json.loads(out_file.read_text())
        except Exception:
            existing = []
    existing_ids = {r["run_id"] for r in existing}
    new_runs = [r for r in runs if r["run_id"] not in existing_ids]
    merged = existing + new_runs
    merged.sort(key=lambda r: r.get("created_at", ""))

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(merged, indent=2) + "\n")
    print(f"History: {len(existing)} existing + {len(new_runs)} new = {len(merged)} total runs → {out_file}")
    return len(new_runs)


def main() -> int:
    p = argparse.ArgumentParser(description="Export evaluation.db to evals/history/runs.json")
    p.add_argument("--db",  type=pathlib.Path, default=DEFAULT_DB)
    p.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    p.add_argument("--no-merge", action="store_true", help="Overwrite instead of merging")
    args = p.parse_args()
    return 0 if export(args.db, args.out, merge=not args.no_merge) >= 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
