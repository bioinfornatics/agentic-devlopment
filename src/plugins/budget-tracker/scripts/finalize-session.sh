#!/usr/bin/env sh
# budget-tracker: write per-session summary on SessionEnd.
# Output is appended to XDG_DATA_HOME/goose-budget/sessions.jsonl for FinOps analysis.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session" ] || exit 0
case "$session" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

DATA_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/goose-budget"
SESSION_FILE="$DATA_DIR/$session"
[ -f "$SESSION_FILE" ] || exit 0

. "$SESSION_FILE" 2>/dev/null || exit 0
ended=$(date -u +%Y-%m-%dT%H:%M:%SZ)

ARCHIVE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/goose-budget"
mkdir -p "$ARCHIVE_DIR"

jq -cn \
  --arg session "$session" \
  --arg started "${started:-unknown}" \
  --arg ended "$ended" \
  --argjson calls "${calls:-0}" \
  --argjson output_chars "${output_chars:-0}" \
  '{session_id:$session,started:$started,ended:$ended,tool_calls:$calls,output_chars:$output_chars}' \
  >> "$ARCHIVE_DIR/sessions.jsonl" 2>/dev/null || true

# Clean up temp file
rm -f "$SESSION_FILE" "$SESSION_FILE.lock" 2>/dev/null || true
exit 0
