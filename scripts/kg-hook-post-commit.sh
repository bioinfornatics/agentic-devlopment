#!/bin/bash
# Auto-update KG on every commit
# Refresh harness layer entities + re-run reasoner

REPO_ROOT="$(git rev-parse --show-toplevel)"
KG_DIR="$REPO_ROOT/.knowledge"

# Only run if .knowledge/ exists in this repo
if [ ! -d "$KG_DIR" ]; then
  exit 0
fi

# Only run if kg scripts exist
if [ ! -f "$REPO_ROOT/scripts/kg-bootstrap.py" ]; then
  exit 0
fi

# Run silently — don't block the commit
(
  cd "$REPO_ROOT"
  python3 scripts/kg-bootstrap.py > /dev/null 2>&1
  python3 scripts/kg-reason.py > /dev/null 2>&1
) &

exit 0
