#!/usr/bin/env sh
# loop-breaker: counts consecutive PostToolUseFailure events per session.
# Emits {"decision":"block"} when count exceeds 3.
# A single PostToolUse success resets the counter.
# All technical errors exit 0 — never block Goose for infrastructure reasons.
set -u

payload=$(cat 2>/dev/null || printf '{}')

# Require jq
command -v jq >/dev/null 2>&1 || exit 0

# Parse event type
event=$(printf '%s' "$payload" | jq -r '.event // empty' 2>/dev/null) || exit 0
[ -n "$event" ] || exit 0

# Parse session_id with a safe default
session_id=$(printf '%s' "$payload" | jq -r '.session_id // "unknown"' 2>/dev/null) || exit 0
[ -n "$session_id" ] || session_id="unknown"

# Validate session_id against safe character set to prevent path traversal
case "$session_id" in
  *[!A-Za-z0-9._-]*)
    # Contains dangerous characters — fail safe
    exit 0
    ;;
esac

COUNTER_FILE="/tmp/goose-fail-ctr-${session_id}"

case "$event" in
  PostToolUse)
    # Successful tool use — reset the failure counter
    rm -f "$COUNTER_FILE"
    exit 0
    ;;

  PostToolUseFailure)
    # Read existing count (default 0)
    count=0
    if [ -f "$COUNTER_FILE" ]; then
      read -r count < "$COUNTER_FILE" 2>/dev/null || count=0
      # Ensure count is a non-negative integer
      case "$count" in
        ''|*[!0-9]*) count=0 ;;
      esac
    fi

    count=$((count + 1))

    # Persist updated count
    printf '%s\n' "$count" > "$COUNTER_FILE" 2>/dev/null || true

    if [ "$count" -gt 3 ]; then
      jq -cn \
        --argjson c "$count" \
        --arg sid "$session_id" \
        '{
          decision: "block",
          reason: ("LOOP-BREAKER: " + ($c|tostring) + " consecutive tool failures in session " + $sid + ". Stopping to prevent infinite failure loop. Review the last tool error and adjust the approach.")
        }'
    fi
    exit 0
    ;;

  *)
    # Unknown event — ignore
    exit 0
    ;;
esac
