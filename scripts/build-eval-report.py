#!/usr/bin/env python3
"""Generate eval trend dashboard HTML from evals/history/runs.json.

Output: dist/evals/report/index.html  (standalone — no server needed)
Called by build-docs.sh and the GitHub Pages workflow.
"""
from __future__ import annotations
import argparse, html as _html, json, pathlib, sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT     = pathlib.Path(__file__).resolve().parents[1]
HISTORY  = ROOT / "evals" / "history" / "runs.json"
OUT_DIR  = ROOT / "dist" / "evals" / "report"
OUT_FILE = OUT_DIR / "index.html"

PALETTE = {
    "positive": "#22c55e", "neutral": "#f59e0b",
    "negative": "#ef4444", "bg": "#f8fafc",
    "border": "#e2e8f0",   "text": "#1e293b",
    "muted": "#64748b",    "card": "#ffffff",
}

CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0 }}
body {{ font-family: system-ui,-apple-system,sans-serif; background:{PALETTE['bg']}; color:{PALETTE['text']}; padding: 1.5rem }}
h1 {{ font-size: 1.5rem; font-weight: 700; margin-bottom: .25rem }}
h2 {{ font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 .75rem }}
.meta {{ color:{PALETTE['muted']}; font-size:.85rem; margin-bottom:1.5rem }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1rem; margin-bottom:1.5rem }}
.card {{ background:{PALETTE['card']}; border:1px solid {PALETTE['border']}; border-radius:.5rem; padding:1rem }}
.card h3 {{ font-size:.95rem; font-weight:600; margin-bottom:.5rem }}
.badge {{ display:inline-block; padding:.15rem .45rem; border-radius:.25rem; font-size:.75rem; font-weight:600 }}
.pos {{ background:#dcfce7; color:#166534 }}
.neu {{ background:#fef3c7; color:#92400e }}
.neg {{ background:#fee2e2; color:#991b1b }}
table {{ width:100%; border-collapse:collapse; font-size:.85rem }}
th,td {{ border:1px solid {PALETTE['border']}; padding:.4rem .6rem; text-align:left; vertical-align:top }}
th {{ background:#f1f5f9; font-weight:600 }}
tr:hover {{ background:#f8fafc }}
.spark {{ display:flex; gap:3px; align-items:flex-end; height:32px; margin-top:.5rem }}
.bar {{ width:10px; border-radius:2px 2px 0 0; min-height:2px }}
nav {{ margin-bottom:1.5rem }}
nav a {{ color:#3b82f6; text-decoration:none; margin-right:1rem; font-size:.9rem }}
nav a:hover {{ text-decoration:underline }}
"""

def load_history(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text())

def skill_delta(scenarios: list[dict]) -> float | None:
    """Average (with_skill - without_skill) pass_rate across scenario pairs."""
    with_map: dict[int, float] = {}
    without_map: dict[int, float] = {}
    for s in scenarios:
        cfg = s.get("configuration", "")
        eid = s.get("eval_id", -1)
        pr  = s.get("pass_rate") or 0.0
        if "with" in cfg and "without" not in cfg:
            with_map[eid] = pr
        elif "without" in cfg:
            without_map[eid] = pr
    pairs = [(with_map[k] - without_map[k])
             for k in with_map if k in without_map]
    return round(sum(pairs) / len(pairs), 3) if pairs else None

def sat_rate(scenarios: list[dict]) -> float | None:
    hits = [s.get("max_turns_reached") for s in scenarios]
    vals = [1 if h else 0 for h in hits if h is not None]
    return round(sum(vals) / len(vals), 2) if vals else None

def delta_badge(v: float | None) -> str:
    if v is None: return ""
    cls = "pos" if v > 0.05 else ("neg" if v < -0.05 else "neu")
    sign = "+" if v > 0 else ""
    return f"<span class='badge {cls}'>{sign}{v:.0%}</span>"

def sat_badge(v: float | None) -> str:
    if v is None: return ""
    cls = "neg" if v > 0.5 else ("neu" if v > 0.2 else "pos")
    return f"<span class='badge {cls}'>⚡{v:.0%} sat</span>"

def sparkline(values: list[float], color: str) -> str:
    if not values: return ""
    mx = max(abs(v) for v in values) or 1
    bars = ""
    for v in values[-12:]:   # last 12 points
        h = max(2, int(abs(v) / mx * 28))
        c = PALETTE["positive"] if v > 0.05 else (PALETTE["negative"] if v < -0.05 else PALETTE["neutral"])
        bars += f"<div class='bar' style='height:{h}px;background:{c}' title='{v:+.1%}'></div>"
    return f"<div class='spark'>{bars}</div>"

def render(runs: list[dict]) -> str:
    # Collate per-subject timeline
    by_subject: dict[str, list[dict]] = defaultdict(list)
    for r in runs:
        subj = r.get("subject", "?")
        if subj == "__suite__": continue
        by_subject[subj].append(r)

    # Build subject cards
    cards = ""
    for subj in sorted(by_subject):
        history = by_subject[subj]
        deltas  = [skill_delta(r.get("scenarios", [])) for r in history]
        sats    = [sat_rate(r.get("scenarios", []))    for r in history]
        latest  = history[-1]
        ld = skill_delta(latest.get("scenarios", []))
        ls = sat_rate(latest.get("scenarios", []))
        runs_count = len(history)
        sparkl = sparkline([d for d in deltas if d is not None], PALETTE["positive"])
        cards += (
            f"<div class='card'>"
            f"<h3>{_html.escape(subj)}</h3>"
            f"{delta_badge(ld)} {sat_badge(ls)}"
            f"<div style='color:{PALETTE['muted']};font-size:.8rem;margin-top:.35rem'>"
            f"{runs_count} run(s) · last: {latest.get('created_at','')[:10]}</div>"
            f"{sparkl}"
            f"</div>"
        )

    # Build full runs table
    table_rows = ""
    for r in reversed(runs):
        if r.get("subject") == "__suite__": continue
        subj    = _html.escape(r.get("subject", "?"))
        dt      = r.get("created_at", "")[:16].replace("T", " ")
        commit  = _html.escape(str(r.get("git_commit", ""))[:7])
        model   = _html.escape(str(r.get("model", "?"))[:30])
        delta   = skill_delta(r.get("scenarios", []))
        sat     = sat_rate(r.get("scenarios", []))
        dirty   = " 🔧" if r.get("git_dirty") else ""
        table_rows += (
            f"<tr>"
            f"<td>{dt}</td>"
            f"<td>{subj}</td>"
            f"<td><code>{commit}{dirty}</code></td>"
            f"<td>{model}</td>"
            f"<td>{delta_badge(delta)}</td>"
            f"<td>{sat_badge(sat)}</td>"
            f"</tr>"
        )

    # Per-scenario breakdown table (latest run per subject)
    scenario_rows = ""
    for subj in sorted(by_subject):
        latest = by_subject[subj][-1]
        sc_pairs: dict[int, dict] = {}
        for s in latest.get("scenarios", []):
            eid = s.get("eval_id", -1)
            cfg = s.get("configuration", "")
            sc_pairs.setdefault(eid, {})
            sc_pairs[eid][cfg] = s
        for eid in sorted(sc_pairs):
            pair    = sc_pairs[eid]
            with_s  = pair.get("with_skill", pair.get("new_skill", {}))
            wo_s    = pair.get("without_skill", pair.get("old_skill", {}))
            w_pr    = with_s.get("pass_rate")
            b_pr    = wo_s.get("pass_rate")
            delta_v = round(w_pr - b_pr, 3) if (w_pr is not None and b_pr is not None) else None
            w_turns = with_s.get("turns_used", "?")
            w_sat   = "⚠" if with_s.get("max_turns_reached") else ""
            scenario_rows += (
                f"<tr>"
                f"<td>{_html.escape(subj)}</td>"
                f"<td style='text-align:center'>{eid}</td>"
                f"<td style='text-align:center'>{f'{w_pr:.0%}' if w_pr is not None else '—'}</td>"
                f"<td style='text-align:center'>{f'{b_pr:.0%}' if b_pr is not None else '—'}</td>"
                f"<td style='text-align:center'>{delta_badge(delta_v)}</td>"
                f"<td style='text-align:center'>{w_turns}{w_sat}</td>"
                f"</tr>"
            )

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total_runs = len([r for r in runs if r.get("subject") != "__suite__"])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harness Eval Trends</title>
<style>{CSS}</style>
</head>
<body>
<h1>🧪 Harness Eval Trends</h1>
<p class="meta">Generated {generated} · {total_runs} skill eval run(s) in history</p>
<nav>
<a href="../../docs/html/index.html">📖 Documentation</a>
<a href="../skills/index.html">🔬 Suite index</a>
<a href="../skills/analysis-index.html">📊 Analysis</a>
</nav>

<h2>Skill quality at a glance</h2>
<div class="grid">{cards}</div>

<h2>Per-scenario breakdown (latest run per skill)</h2>
<table>
<thead><tr>
<th>Skill</th><th>Eval</th>
<th>With skill</th><th>Without skill</th><th>Δ</th><th>Turns</th>
</tr></thead>
<tbody>{scenario_rows}</tbody>
</table>

<h2>All runs</h2>
<table>
<thead><tr>
<th>Date</th><th>Skill</th><th>Commit</th><th>Model</th><th>Skill Δ</th><th>Saturation</th>
</tr></thead>
<tbody>{table_rows}</tbody>
</table>

<p style="color:{PALETTE['muted']};font-size:.8rem;margin-top:2rem">
Legend: <span class="badge pos">+X%</span> skill delta positive ·
<span class="badge neu">~0%</span> neutral ·
<span class="badge neg">−X%</span> negative ·
<span class="badge neg">⚡X% sat</span> max-turns saturation ·
Sparklines show delta trend over last 12 runs.
</p>
</body>
</html>
"""

def main() -> int:
    p = argparse.ArgumentParser(description="Build eval trend dashboard HTML")
    p.add_argument("--history", type=pathlib.Path, default=HISTORY)
    p.add_argument("--out",     type=pathlib.Path, default=OUT_FILE)
    args = p.parse_args()
    runs = load_history(args.history)
    html = render(runs)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    print(f"Eval trend report → {args.out}  ({len(html)//1024} KB,  {len([r for r in runs if r.get('subject')!='__suite__'])} runs)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
