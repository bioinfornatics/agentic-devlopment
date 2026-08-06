#!/usr/bin/env sh
# budget-tracker: increment tool-call counter and output-size proxy on PostToolUse/PostToolUseFailure.
# output_chars is a rough proxy for context growth (each tool output stays in context).
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session" ] || exit 0
case "$session" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

# Approximate output size in chars (JSON-encoded tool_output or message)
output_text=$(printf '%s' "$payload" | jq -r '(.tool_output // .message // "") | tostring' 2>/dev/null) || output_text=""
out_chars=${#output_text}

DATA_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/goose-budget"
SESSION_FILE="$DATA_DIR/$session"
[ -f "$SESSION_FILE" ] || printf '%s\n' "calls=0 output_chars=0 started=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DATA_DIR/$SESSION_FILE" 2>/dev/null || true
mkdir -p "$DATA_DIR"
[ -f "$SESSION_FILE" ] || printf '%s\n' "calls=0 output_chars=0 started=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SESSION_FILE"

# Read and increment atomically using a lock file
LOCK="$SESSION_FILE.lock"
(
  flock -n 9 || exit 0
  . "$SESSION_FILE" 2>/dev/null || { calls=0; output_chars=0; }
  calls=$((calls + 1))
  output_chars=$((output_chars + out_chars))
  printf 'calls=%d output_chars=%d started=%s\n' "$calls" "$output_chars" "${started:-unknown}" > "$SESSION_FILE"
) 9>"$LOCK"
exit 0
