# 16 — Eval Trends and GitHub Pages

The harness publishes a live evaluation quality dashboard to GitHub Pages alongside the documentation.

## What is published

```
https://bioinfornatics.github.io/agentic-devlopment/
  index.html                       ← landing page
  docs/html/index.html             ← full documentation (pandoc)
  evals/report/index.html          ← skill quality trend dashboard ← NEW
  evals/skills/index.html          ← latest suite benchmark index
  evals/skills/analysis-index.html ← analysis and recommendations
```

## How it works

### Durable history: `evals/history/runs.json`

Every eval suite run is exported to a committed JSON file:

```bash
python scripts/run-skill-ab-suite.py --continue-on-failure
python scripts/export-eval-history.py
git add evals/history/runs.json
git commit -m "chore: update eval history after suite run"
git push
```

`evals/history/runs.json` accumulates over time (append-only, ~2 KB/run).
It is the source of truth for trends — no SQLite database required in CI.

### Trend dashboard: `scripts/build-eval-report.py`

Reads `evals/history/runs.json` and generates a standalone HTML trend report:
- **Skill cards** with sparklines showing delta trend over the last 12 runs
- **Per-scenario breakdown** (with vs. without skill pass rates, delta badge, saturation)
- **All runs table** (date, skill, commit, model, delta, saturation)

No external dependencies — pure Python stdlib + inline CSS. Runs in < 1 second.

```bash
python scripts/build-eval-report.py
open dist/evals/report/index.html
```

### GitHub Actions (`.github/workflows/pages.yml`)

On every push to `main`:
1. Build docs with pandoc (`build-docs.sh`)
2. Build eval trend report (`build-eval-report.py`) — reads committed JSON, no API calls
3. Upload `dist/` to GitHub Pages

Pages deploy is always fast because no model runs happen in CI.

## Workflow after a suite run

```bash
# 1. Run the suite (1–2 hours, API costs)
python scripts/run-skill-ab-suite.py --continue-on-failure --runs-per-config 1

# 2. Export results to committed history
python scripts/export-eval-history.py
# → prints: "History: N existing + M new = N+M total runs"

# 3. Commit and push — Pages auto-deploys with fresh trends
git add evals/history/runs.json
git commit -m "chore: update eval history"
git push
```

## Consequences and trade-offs

| Decision                          | Consequence                                                          |
|-----------------------------------|----------------------------------------------------------------------|
| History in JSON (not SQLite)      | Git-tracked, survives fresh checkouts, readable by CI                |
| No eval runs in CI                | Pages deploy is free and fast (< 2 min); no API secrets needed       |
| Manual export step                | Trends only update when developer commits after a run                |
| `dist/` gitignored                | Docs and report are regenerated in CI from source; no artifact bloat |
| Standalone HTML (no JS framework) | Works offline, no CDN dependency, no build step                      |

## Trend signal interpretation

| Badge         | Meaning                                                        |
|---------------|----------------------------------------------------------------|
| `+X%` green   | Skill helps — with > without by X%                             |
| `~0%` amber   | Neutral — skill not discriminating this scenario               |
| `−X%` red     | Skill hurts — investigate expected_behavior or confidence gate |
| `⚡X% sat` red | Max-turn saturation — scenario too broad or max_turns too high |

A negative delta is always a P0 — investigate before next suite run.
A saturation rate > 50% is always a P0 — reduce max_turns or add stop rules.
