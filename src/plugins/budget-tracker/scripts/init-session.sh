#!/usr/bin/env sh
# budget-tracker: initialise per-session counters on SessionStart.
# Files are keyed by session_id and stored in XDG_RUNTIME_DIR or /tmp.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session" ] || exit 0
case "$session" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

DATA_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/goose-budget"
mkdir -p "$DATA_DIR"

SESSION_FILE="$DATA_DIR/$session"
# Only initialise if the file doesn't exist (resume-safe)
if [ ! -f "$SESSION_FILE" ]; then
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s\n' "calls=0 output_chars=0 started=$started" > "$SESSION_FILE"
fi
exit 0
