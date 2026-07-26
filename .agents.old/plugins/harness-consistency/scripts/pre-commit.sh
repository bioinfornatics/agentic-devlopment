#!/usr/bin/env bash
# pre-commit.sh — git pre-commit hook
# Source lives in .agents/plugins/harness-consistency/scripts/
# Install with: scripts/install-git-hooks.sh
#
# Regenerates auto-generated doc tables and validates harness consistency
# before every git commit. Mirrors the AfterFileEdit Goose hook for
# changes made outside of a Goose session.
set -e
cd "$(git rev-parse --show-toplevel)"

echo "→ Regenerating documentation tables from source of truth..."
python3 scripts/generate-tables.py

# Stage any files the generator updated
git add README.md docs/15-skill-evaluations.md 2>/dev/null || true

echo "→ Running consistency check..."
python3 scripts/check-consistency.py

echo "✓ Pre-commit checks passed."

