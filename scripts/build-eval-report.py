#!/usr/bin/env python3
"""Build eval trend dashboard from evaluation.db (preferred) or evals/history/runs.json.

Priority:
  1. dist/evals/evaluation.db  — local DB, richest data (6 tables)
  2. evals/history/runs.json   — committed JSON export, available in CI

Output: dist/evals/report/index.html  (standalone, no CDN dependencies)
"""
from __future__ import annotations
import argparse, html as _html, json, pathlib, sqlite3, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

ROOT    = pathlib.Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "dist" / "evals" / "evaluation.db"
JSON_PATH = ROOT / "evals" / "history" / "runs.json"
OUT_DIR  = ROOT / "dist" / "evals" / "report"
OUT_FILE = OUT_DIR / "index.html"

# ─── colour tokens ─────────────────────────────────────────────────────────
C = {
    "pos":    "#22c55e", "pos_bg":  "#dcfce7", "pos_fg":  "#166534",
    "neu":    "#f59e0b", "neu_bg":  "#fef3c7", "neu_fg":  "#92400e",
    "neg":    "#ef4444", "neg_bg":  "#fee2e2", "neg_fg":  "#991b1b",
    "bg":     "#f8fafc", "card":    "#ffffff",
    "border": "#e2e8f0", "text":    "#1e293b", "muted":   "#64748b",
    "code_bg":"#f1f5f9",
}

CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:system-ui,-apple-system,sans-serif;
      background:{C['bg']};color:{C['text']};padding:1.5rem 2rem}}
h1{{font-size:1.6rem;font-weight:700;margin-bottom:.25rem}}
h2{{font-size:1.05rem;font-weight:600;margin:1.75rem 0 .75rem;
    border-bottom:1px solid {C['border']};padding-bottom:.35rem}}
h3{{font-size:.9rem;font-weight:600;margin-bottom:.4rem}}
.meta{{color:{C['muted']};font-size:.82rem;margin-bottom:1.5rem}}
.source{{display:inline-block;padding:.1rem .4rem;background:{C['code_bg']};
         border-radius:.2rem;font-size:.75rem;font-family:monospace;margin-left:.5rem}}
nav{{margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap}}
nav a{{color:#3b82f6;text-decoration:none;font-size:.88rem}}
nav a:hover{{text-decoration:underline}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.85rem;margin-bottom:1.5rem}}
.card{{background:{C['card']};border:1px solid {C['border']};border-radius:.5rem;padding:.9rem}}
.card h3{{margin-bottom:.3rem}}
.badge{{display:inline-block;padding:.15rem .45rem;border-radius:.25rem;font-size:.75rem;font-weight:600}}
.pos{{background:{C['pos_bg']};color:{C['pos_fg']}}}
.neu{{background:{C['neu_bg']};color:{C['neu_fg']}}}
.neg{{background:{C['neg_bg']};color:{C['neg_fg']}}}
.spark{{display:flex;gap:3px;align-items:flex-end;height:28px;margin-top:.5rem}}
.bar{{width:9px;border-radius:2px 2px 0 0;min-height:2px}}
table{{width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:1rem}}
th,td{{border:1px solid {C['border']};padding:.35rem .55rem;vertical-align:top;text-align:left}}
th{{background:{C['code_bg']};font-weight:600}}
tr:hover{{background:{C['bg']}}}
.rc{{font-family:monospace;font-size:.75rem;background:{C['code_bg']};
     padding:.1rem .3rem;border-radius:.2rem;display:inline-block;margin:.1rem}}
details summary{{cursor:pointer;color:#3b82f6;font-size:.85rem;padding:.2rem 0}}
.fb-high{{border-left:3px solid {C['neg']};padding-left:.5rem;margin:.3rem 0;font-size:.82rem}}
.fb-med {{border-left:3px solid {C['neu']};padding-left:.5rem;margin:.3rem 0;font-size:.82rem}}
"""

# ─── helpers ───────────────────────────────────────────────────────────────
def badge(v: float | None, *, fmt: str = "+.0%") -> str:
    if v is None: return ""
    cls = "pos" if v > 0.05 else ("neg" if v < -0.05 else "neu")
    sign = "+" if v > 0 else ""
    label = f"{sign}{v:{fmt[1:]}}" if fmt.startswith("+") else f"{v:{fmt}}"
    return f"<span class='badge {cls}'>{_html.escape(label)}</span>"

def sat_badge(v: float | None) -> str:
    if v is None: return ""
    cls = "neg" if v > 0.5 else ("neu" if v > 0.2 else "pos")
    return f"<span class='badge {cls}'>⚡{v:.0%}</span>"

def sparkline(values: list[float]) -> str:
    if not values: return ""
    mx = max(abs(v) for v in values) or 1
    bars = ""
    for v in values[-14:]:
        h  = max(2, int(abs(v) / mx * 24))
        c  = C["pos"] if v > 0.05 else (C["neg"] if v < -0.05 else C["neu"])
        bars += f"<div class='bar' style='height:{h}px;background:{c}' title='{v:+.1%}'></div>"
    return f"<div class='spark'>{bars}</div>"

def esc(v: Any) -> str:
    return _html.escape(str(v)) if v is not None else "—"

# ─── data loading ──────────────────────────────────────────────────────────
class EvalData:
    source: str = ""
    # runs: list of {run_id, subject, created_at, git_commit, model, ...}
    runs: list[dict]
    # scenario_analysis: list of {run_id, subject, eval_id, scenario_hash, with_score,
    #                              without_score, skill_impact, scenario_quality, root_cause, created_at}
    scenarios: list[dict]
    # improvements: list of {run_id, subject, metric, baseline, candidate, delta, created_at}
    improvements: list[dict]
    # feedback: list of {run_id, subject, eval_id, severity, recommendation_type, message, evidence}
    feedback: list[dict]
    # analysis: list of {run_id, subject, eval_id, configuration, skill_impact, root_causes_json,
    #                    confidence, scenario_quality, efficiency_json}
    analysis: list[dict]

def load_from_db(path: pathlib.Path) -> EvalData | None:
    if not path.exists(): return None
    d = EvalData()
    d.source = f"DB ({path.name}, {path.stat().st_size // 1024} KB)"
    con = sqlite3.connect(path); con.row_factory = sqlite3.Row
    d.runs         = [dict(r) for r in con.execute("""
        SELECT run_id, kind, subject, content_hash, git_commit, git_dirty,
               provider, model, turns_used_mean, max_turns_mean,
               max_turns_reached_rate, created_at
        FROM eval_runs WHERE subject != '__suite__' ORDER BY created_at
    """).fetchall()]
    d.scenarios    = [dict(r) for r in con.execute("""
        SELECT run_id, kind, subject, eval_id, scenario_hash, with_score, without_score,
               with_turns, without_turns, root_cause, skill_impact,
               scenario_quality, recommended_action, created_at
        FROM eval_scenario_analysis ORDER BY created_at
    """).fetchall()]
    d.improvements = [dict(r) for r in con.execute("""
        SELECT run_id, kind, subject, metric, baseline, candidate, delta,
               baseline_turns_used_mean, candidate_turns_used_mean,
               baseline_max_turns_reached_rate, candidate_max_turns_reached_rate,
               created_at
        FROM eval_improvements ORDER BY created_at
    """).fetchall()]
    d.feedback     = [dict(r) for r in con.execute("""
        SELECT run_id, kind, subject, eval_id, configuration,
               recommendation_type, severity, message, evidence, created_at
        FROM eval_feedback ORDER BY created_at
    """).fetchall()]
    d.analysis     = [dict(r) for r in con.execute("""
        SELECT run_id, kind, subject, eval_id, configuration, run_number,
               skill_impact, scenario_quality, root_causes_json,
               bad_actions_json, confidence, efficiency_json
        FROM eval_analysis
    """).fetchall()]
    con.close()
    return d

def load_from_json(path: pathlib.Path) -> EvalData | None:
    if not path.exists(): return None
    raw = json.loads(path.read_text())
    d = EvalData()
    d.source = f"JSON ({path.name})"
    d.runs, d.improvements, d.feedback, d.analysis = [], [], [], []
    d.scenarios = []
    for r in raw:
        if r.get("subject") == "__suite__": continue
        d.runs.append(r)
        for s in r.get("scenarios", []):
            w  = next((x for x in r.get("scenarios", []) if x.get("configuration","").startswith("with") and not x.get("configuration","").startswith("without") and x.get("eval_id") == s.get("eval_id")), None)
            wo = next((x for x in r.get("scenarios", []) if x.get("configuration","").startswith("without") and x.get("eval_id") == s.get("eval_id")), None)
            ws = w.get("pass_rate") if w else None
            bs = wo.get("pass_rate") if wo else None
            if ws is not None and bs is not None:
                d.scenarios.append({
                    "run_id": r.get("run_id"), "subject": r.get("subject"),
                    "eval_id": s.get("eval_id"),
                    "with_score": ws, "without_score": bs,
                    "skill_impact": ("positive" if ws>bs+0.05 else ("negative" if ws<bs-0.05 else "neutral")),
                    "created_at": r.get("created_at",""),
                })
        for imp in r.get("improvements", []):
            d.improvements.append({**imp, "run_id": r.get("run_id"), "subject": r.get("subject"), "created_at": r.get("created_at","")})
    return d

def load(db: pathlib.Path, js: pathlib.Path) -> EvalData:
    return load_from_db(db) or load_from_json(js) or EvalData()

# ─── render sections ───────────────────────────────────────────────────────
def render_cards(d: EvalData) -> str:
    by_subj: dict[str, list[dict]] = defaultdict(list)
    for r in d.runs: by_subj[r["subject"]].append(r)

    delta_by_run: dict[str, float] = {}
    for imp in d.improvements:
        if imp.get("metric") == "pass_rate":
            key = f"{imp['run_id']}::{imp['subject']}"
            delta_by_run[key] = imp.get("delta") or 0.0

    cards = ""
    for subj in sorted(by_subj):
        hist  = by_subj[subj]
        deltas= [delta_by_run.get(f"{r['run_id']}::{subj}") for r in hist]
        deltas= [d for d in deltas if d is not None]
        latest= hist[-1]
        ld    = delta_by_run.get(f"{latest['run_id']}::{subj}")
        ls    = latest.get("max_turns_reached_rate")
        cards += (
            f"<div class='card'><h3>{esc(subj)}</h3>"
            f"{badge(ld)} {sat_badge(ls)}"
            f"<div style='color:{C['muted']};font-size:.78rem;margin-top:.3rem'>"
            f"{len(hist)} run(s) · {str(latest.get('created_at',''))[:10]} "
            f"· <code style='font-size:.72rem'>{str(latest.get('git_commit',''))[:7]}</code></div>"
            f"{sparkline(deltas)}</div>"
        )
    return cards

def render_scenario_table(d: EvalData) -> str:
    # Latest run per subject
    latest_run: dict[str, str] = {}
    for r in d.runs: latest_run[r["subject"]] = r["run_id"]

    # Detect scenario version changes: group all historical hashes per (subject, eval_id)
    hash_history: dict[tuple, set] = {}
    for s in d.scenarios:
        key = (s.get("subject",""), s.get("eval_id", -1))
        h = s.get("scenario_hash") or ""
        if h:
            hash_history.setdefault(key, set()).add(h)

    rows = ""
    for s in sorted(d.scenarios, key=lambda x: (x.get("subject",""), x.get("eval_id",0))):
        if s.get("run_id") != latest_run.get(s.get("subject","")): continue
        ws  = s.get("with_score"); bs = s.get("without_score")
        dv  = round(ws - bs, 3) if (ws is not None and bs is not None) else None
        sq  = s.get("scenario_quality","")
        rc  = s.get("root_cause","") or ""
        rc_tags = " ".join(f"<span class='rc'>{esc(c)}</span>" for c in rc.split(",") if c.strip())
        shash = s.get("scenario_hash") or ""
        key   = (s.get("subject",""), s.get("eval_id", -1))
        n_versions = len(hash_history.get(key, set()))
        # Warn if this scenario has multiple historical hashes → scores are not all comparable
        hash_cell = f"<code style='font-size:.72rem'>{esc(shash[:8])}</code>"
        if n_versions > 1:
            hash_cell += f" <span class='badge neg' title='{n_versions} different scenario versions in history — older scores may not be comparable'>⚠{n_versions}v</span>"
        rows += (
            f"<tr><td>{esc(s.get('subject'))}</td>"
            f"<td style='text-align:center'>{esc(s.get('eval_id'))}</td>"
            f"<td style='text-align:center'>{hash_cell}</td>"
            f"<td style='text-align:center'>{f'{ws:.0%}' if ws is not None else '—'}</td>"
            f"<td style='text-align:center'>{f'{bs:.0%}' if bs is not None else '—'}</td>"
            f"<td style='text-align:center'>{badge(dv)}</td>"
            f"<td>{esc(sq)}</td>"
            f"<td>{rc_tags or '—'}</td></tr>"
        )
    return rows

def render_improvements(d: EvalData) -> str:
    rows = ""
    for imp in reversed(d.improvements):
        if imp.get("metric") != "pass_rate": continue
        delta_v = imp.get("delta"); bl = imp.get("baseline"); cand = imp.get("candidate")
        bt = imp.get("baseline_turns_used_mean"); ct = imp.get("candidate_turns_used_mean")
        bs = imp.get("baseline_max_turns_reached_rate"); cs = imp.get("candidate_max_turns_reached_rate")
        rows += (
            f"<tr><td>{esc(str(imp.get('created_at',''))[:16])}</td>"
            f"<td>{esc(imp.get('subject'))}</td>"
            f"<td style='text-align:center'>{f'{bl:.0%}' if bl is not None else '—'}</td>"
            f"<td style='text-align:center'>{f'{cand:.0%}' if cand is not None else '—'}</td>"
            f"<td style='text-align:center'>{badge(delta_v)}</td>"
            f"<td style='text-align:center'>{f'{bt:.0f}' if bt else '—'} / {f'{ct:.0f}' if ct else '—'}</td>"
            f"<td style='text-align:center'>{sat_badge(bs)} {sat_badge(cs)}</td>"
            f"</tr>"
        )
    return rows

def render_root_causes(d: EvalData) -> str:
    counts: Counter = Counter()
    by_subj: dict[str, Counter] = defaultdict(Counter)
    for a in d.analysis:
        try:
            causes = json.loads(a.get("root_causes_json") or "[]")
        except Exception:
            causes = []
        for c in causes:
            counts[c] += 1
            by_subj[a.get("subject","?")][c] += 1
    if not counts: return "<p style='color:#64748b'>No root cause data yet.</p>"
    rows = ""
    for cause, total in counts.most_common(12):
        per = " ".join(f"<span class='rc'>{esc(s)}({n})</span>"
                       for s, n in by_subj.items() if n[cause])
        rows += f"<tr><td><span class='rc'>{esc(cause)}</span></td><td style='text-align:center'>{total}</td><td>{per}</td></tr>"
    return f"<table><thead><tr><th>Root cause</th><th>Total</th><th>Per skill</th></tr></thead><tbody>{rows}</tbody></table>"

def render_feedback(d: EvalData) -> str:
    if not d.feedback: return "<p style='color:#64748b'>No feedback data yet.</p>"
    high = [f for f in d.feedback if f.get("severity") == "high"][-20:]
    med  = [f for f in d.feedback if f.get("severity") == "medium"][-10:]
    html = ""
    for fb in reversed(high):
        html += (
            f"<div class='fb-high'><strong>{esc(fb.get('subject'))}</strong> "
            f"[{esc(fb.get('recommendation_type',''))}] "
            f"{esc(fb.get('message',''))[:180]}"
            f"{'…' if len(str(fb.get('message',''))) > 180 else ''}</div>"
        )
    if med:
        html += "<details><summary>Medium severity recommendations</summary>"
        for fb in reversed(med):
            html += (
                f"<div class='fb-med'><strong>{esc(fb.get('subject'))}</strong> "
                f"[{esc(fb.get('recommendation_type',''))}] "
                f"{esc(fb.get('message',''))[:160]}</div>"
            )
        html += "</details>"
    return html

def render_runs_table(d: EvalData) -> str:
    rows = ""
    for r in reversed(d.runs):
        subj  = esc(r.get("subject",""))
        dt    = str(r.get("created_at",""))[:16].replace("T"," ")
        commit= esc(str(r.get("git_commit",""))[:7])
        model = esc(str(r.get("model","?"))[:28])
        dirty = " 🔧" if r.get("git_dirty") else ""
        imp   = next((i for i in reversed(d.improvements)
                      if i.get("run_id")==r.get("run_id") and i.get("metric")=="pass_rate"), None)
        dv    = imp.get("delta") if imp else None
        sat   = r.get("max_turns_reached_rate")
        rows += (
            f"<tr><td>{dt}</td><td>{subj}</td>"
            f"<td><code>{commit}{dirty}</code></td><td>{model}</td>"
            f"<td style='text-align:center'>{badge(dv)}</td>"
            f"<td style='text-align:center'>{sat_badge(sat)}</td></tr>"
        )
    return rows

# ─── page assembly ─────────────────────────────────────────────────────────
def render_efficiency(d: EvalData) -> str:
    """Show turn-efficiency diagnostics for high-budget runs (budget > 40%)."""
    rows = ""
    seen: set[str] = set()
    for a in d.analysis:
        raw = a.get("efficiency_json")
        if not raw:
            continue
        try:
            eff = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            continue
        budget = eff.get("budget_used_pct")
        if budget is None or budget < 0.4:
            continue
        key = f"{a.get('run_id')}::{a.get('eval_id')}::{a.get('configuration')}"
        if key in seen:
            continue
        seen.add(key)

        budget_cls  = "neg" if budget > 0.85 else ("neu" if budget > 0.6 else "pos")
        failed      = eff.get("failed_tool_calls", 0)
        recovery    = eff.get("recovery_attempts", 0)
        repeated    = eff.get("repeated_commands_count", 0)
        explore_pct = eff.get("explore_pct", 0)
        t2write     = eff.get("turns_to_first_write")
        ratio       = eff.get("tool_calls_per_file_changed")
        phases      = eff.get("phase_breakdown", {})
        phase_str   = " ".join(
            f"<span class='rc'>{esc(k)}={v}</span>"
            for k, v in sorted(phases.items(), key=lambda x: -x[1])[:5]
        )
        # Build signal badges
        signals = ""
        if failed > 0:
            signals += f" <span class='badge neg'>✗ {failed} errors</span>"
        if recovery > 0:
            signals += f" <span class='badge neu'>↻ {recovery} retries</span>"
        if repeated > 0:
            signals += f" <span class='badge neu'>⟳ {repeated} repeated cmds</span>"
        if explore_pct > 0.4:
            signals += f" <span class='badge neu'>🔍 {explore_pct:.0%} explore</span>"
        if ratio and ratio > 20:
            signals += f" <span class='badge neg'>{ratio:.0f} calls/file</span>"

        rows += (
            f"<tr>"
            f"<td>{esc(a.get('subject'))}</td>"
            f"<td style='text-align:center'>{esc(a.get('eval_id'))}</td>"
            f"<td>{esc(a.get('configuration','').replace('_skill',''))}</td>"
            f"<td style='text-align:center'>"
            f"<span class='badge {budget_cls}'>{budget:.0%}</span></td>"
            f"<td>{esc(eff.get('tool_calls_total','?'))}</td>"
            f"<td>{phase_str}</td>"
            f"<td>{signals or '—'}</td>"
            f"<td style='text-align:center'>{t2write if t2write is not None else '—'}</td>"
            f"</tr>"
        )

    if not rows:
        return "<p style='color:#64748b'>No high-budget runs yet, or efficiency data not populated.</p>"
    return (
        "<table><thead><tr>"
        "<th>Skill</th><th>Eval</th><th>Config</th><th>Budget</th>"
        "<th>Tool calls</th><th>Phases</th><th>Signals</th><th>1st write turn</th>"
        "</tr></thead><tbody>" + rows + "</tbody></table>"
    )


def render(d: EvalData) -> str:
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    n_runs    = len(d.runs)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harness Eval Trends</title>
<style>{CSS}</style>
</head>
<body>
<h1>🧪 Harness Eval Trends</h1>
<p class="meta">
  Generated {generated} · {n_runs} skill run(s)
  <span class="source">source: {esc(d.source)}</span>
</p>
<nav>
  <a href="../../docs/html/index.html">📖 Documentation</a>
  <a href="../skills/index.html">🔬 Suite index</a>
  <a href="../skills/analysis-index.html">📊 Analysis</a>
</nav>

<h2>Skill quality at a glance</h2>
<p style="color:{C['muted']};font-size:.82rem;margin-bottom:.75rem">
Sparkline = skill delta per run (last 14). Badge = latest run.
<span class='badge pos'>+X%</span> skill helps &nbsp;
<span class='badge neu'>~0%</span> neutral &nbsp;
<span class='badge neg'>−X%</span> skill hurts &nbsp;
<span class='badge neg'>⚡X%</span> max-turn saturation
</p>
<div class="grid">{render_cards(d)}</div>

<h2>Skill delta over runs</h2>
<table>
<thead><tr>
  <th>Date</th><th>Skill</th><th>Commit</th><th>Model</th>
  <th>Baseline</th><th>Candidate</th><th>Δ pass-rate</th><th>Turns (base/cand)</th><th>Saturation</th>
</tr></thead>
<tbody>{"".join(
    f"<tr><td>{str(i.get('created_at',''))[:16].replace('T',' ')}</td>"
    f"<td>{esc(i.get('subject'))}</td>"
    f"<td><code>{esc(str(i.get('git_commit',''))[:7])}</code></td>"
    f"<td>{esc(str(i.get('model','?'))[:25])}</td>"
    f"<td style='text-align:center'>{f"{i.get('baseline',0):.0%}" if i.get('baseline') is not None else '—'}</td>"
    f"<td style='text-align:center'>{f"{i.get('candidate',0):.0%}" if i.get('candidate') is not None else '—'}</td>"
    f"<td style='text-align:center'>{badge(i.get('delta'))}</td>"
    f"<td style='text-align:center'>{f"{i.get('baseline_turns_used_mean',0):.0f}" if i.get('baseline_turns_used_mean') else '—'} / {f"{i.get('candidate_turns_used_mean',0):.0f}" if i.get('candidate_turns_used_mean') else '—'}</td>"
    f"<td style='text-align:center'>{sat_badge(i.get('baseline_max_turns_reached_rate'))} {sat_badge(i.get('candidate_max_turns_reached_rate'))}</td></tr>"
    for i in reversed(d.improvements) if i.get("metric")=="pass_rate"
)}</tbody>
</table>

<h2>Scenario breakdown — latest run per skill</h2>
<table>
<thead><tr>
  <th>Skill</th><th>Eval</th><th>With</th><th>Without</th><th>Δ</th>
  <th>Scenario quality</th><th>Root causes</th>
</tr></thead>
<tbody>{render_scenario_table(d)}</tbody>
</table>

<h2>Turn efficiency diagnostics</h2>
<p style="color:{C['muted']};font-size:.82rem;margin-bottom:.75rem">
Runs that used &gt;40% of their turn budget. High budget use is not always bad — it depends on signals:
<span class='badge neg'>✗ errors</span> failed tool calls ·
<span class='badge neu'>↻ retries</span> calls after failure ·
<span class='badge neu'>⟳ repeated</span> same command ≥3× ·
<span class='badge neu'>🔍 explore</span> &gt;40% turns = file reads ·
<span class='badge neg'>N calls/file</span> &gt;20 = over-exploration
</p>
{render_efficiency(d)}

<h2>Root cause frequency</h2>
{render_root_causes(d)}

<h2>High-severity feedback (latest)</h2>
{render_feedback(d)}

<h2>All runs</h2>
<table>
<thead><tr><th>Date</th><th>Skill</th><th>Commit</th><th>Model</th><th>Δ</th><th>Saturation</th></tr></thead>
<tbody>{render_runs_table(d)}</tbody>
</table>
</body>
</html>"""

def main() -> int:
    p = argparse.ArgumentParser(description="Build eval trend dashboard from DB or JSON history")
    p.add_argument("--db",   type=pathlib.Path, default=DB_PATH)
    p.add_argument("--json", type=pathlib.Path, default=JSON_PATH)
    p.add_argument("--out",  type=pathlib.Path, default=OUT_FILE)
    args = p.parse_args()

    d = load(args.db, args.json)
    if not d.runs:
        print("WARNING: no eval data found", file=sys.stderr)

    html = render(d)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    print(f"Eval trend report ({d.source}) → {args.out}  {len(html)//1024} KB  {len(d.runs)} runs  {len(d.improvements)} improvements  {len(d.feedback)} feedback rows")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
