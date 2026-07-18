#!/usr/bin/env bash
# check-and-regenerate.sh — Goose AfterFileEdit hook
# Runs after Goose edits a skill, agent, recipe, or eval file.
# Regenerates auto-generated doc tables and validates harness consistency.
#
# Receives Goose event payload as JSON on stdin.
# PLUGIN_ROOT is set by Goose to the plugin directory path.
set -euo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | jq -r '.matcher_context // empty')"

# Resolve repo root from PLUGIN_ROOT (.agents/plugins/harness-consistency/ → 3 levels up)
REPO_ROOT="$(cd "${PLUGIN_ROOT}/../../.." && pwd)"

echo "[harness-consistency] AfterFileEdit: ${file}" >&2

cd "$REPO_ROOT"
python3 scripts/generate-tables.py >&2
python3 scripts/check-consistency.py >&2

