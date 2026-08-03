#!/usr/bin/env sh
# budget-tracker: block PreToolUse when tool-call budget is exceeded.
# Budget is read from GOOSE_TOOL_BUDGET env var (default: unlimited = 0).
# GOOSE_TOOL_BUDGET=150 blocks the 151st tool call in the session.
# Set GOOSE_CONTEXT_WARN_CHARS to emit a warning (non-blocking) at that output size.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

BUDGET=${GOOSE_TOOL_BUDGET:-0}
[ "$BUDGET" -gt 0 ] 2>/dev/null || exit 0   # 0 or unset = unlimited

session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session" ] || exit 0
case "$session" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

DATA_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/goose-budget"
SESSION_FILE="$DATA_DIR/$session"
[ -f "$SESSION_FILE" ] || exit 0   # no data yet = allow

. "$SESSION_FILE" 2>/dev/null || exit 0
current_calls=${calls:-0}

if [ "$current_calls" -gt "$BUDGET" ]; then
  printf '%s' "{\"decision\":\"block\",\"reason\":\"budget-tracker: GOOSE_TOOL_BUDGET=$BUDGET reached (session tool calls=$current_calls). Stop, produce partial result, and save resume state in Beads.\"}"
fi
exit 0
