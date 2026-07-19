#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then echo "FAIL: not inside a git repository" >&2; exit 2; fi
cd "$ROOT"
echo "Repository: $ROOT"
echo "Execution mode: ${HARNESS_AUDIT_MODE:-AUDIT_ONLY}"
status="$(git status --short)"
if [[ -n "$status" && "${ALLOW_DIRTY_AUDIT:-0}" != "1" ]]; then echo "FAIL: working tree is dirty. Set ALLOW_DIRTY_AUDIT=1 to record-but-allow." >&2; echo "$status" >&2; exit 3; fi
if [[ -n "$status" ]]; then echo "WARN: dirty working tree allowed by ALLOW_DIRTY_AUDIT=1" >&2; echo "$status" >&2; fi
if command -v bd >/dev/null 2>&1; then echo "Beads: $(bd --version 2>/dev/null || true)"; bd list --json >/tmp/harness-audit-bd-list.json; fi
for f in .goose/recipes/*.yaml; do goose recipe validate "$f" >/dev/null; echo "recipe valid: $f"; done
python3 scripts/check-consistency.py
echo "PASS: harness audit preflight complete"
