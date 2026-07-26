#!/bin/sh
# show-trace.sh — Display loop-trace JSONL entries in a human-readable format.
# Usage: show-trace.sh [--session SESSION_ID] [--date YYYY-MM-DD] [--agents-only]
set -u

command -v jq >/dev/null 2>&1 || { echo "jq not found; cannot display traces." >&2; exit 0; }

TRACE_BASE="$HOME/.local/state/goose/logs/loop-trace"

session_filter=""
date_filter=""
agents_only=0

# Parse arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --session)
      shift
      session_filter="${1:-}"
      ;;
    --date)
      shift
      date_filter="${1:-}"
      ;;
    --agents-only)
      agents_only=1
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: show-trace.sh [--session SESSION_ID] [--date YYYY-MM-DD] [--agents-only]" >&2
      exit 0
      ;;
  esac
  shift
done

# Resolve date
if [ -z "$date_filter" ]; then
  date_filter=$(date -u +%Y-%m-%d)
fi

target_dir="$TRACE_BASE/$date_filter"

if [ ! -d "$target_dir" ]; then
  echo "No traces found for date: $date_filter"
  exit 0
fi

# Build file list
if [ -n "$session_filter" ]; then
  # Validate session_filter (path safety)
  case "$session_filter" in
    *[!A-Za-z0-9._-]*)
      echo "Invalid session ID." >&2
      exit 0
      ;;
  esac
  file_list="$target_dir/${session_filter}.jsonl"
  if [ ! -f "$file_list" ]; then
    echo "No trace file found for session: $session_filter (date: $date_filter)"
    exit 0
  fi
else
  file_list=$(find "$target_dir" -name '*.jsonl' | sort)
  if [ -z "$file_list" ]; then
    echo "No trace files found for date: $date_filter"
    exit 0
  fi
fi

# Format and display each entry
format_entry() {
  line="$1"
  event=$(printf '%s' "$line" | jq -r '.event // "unknown"' 2>/dev/null)
  ts=$(printf '%s' "$line" | jq -r '.ts // ""' 2>/dev/null)
  sid=$(printf '%s' "$line" | jq -r '.session_id // ""' 2>/dev/null)

  # Apply agents-only filter
  if [ "$agents_only" -eq 1 ] && [ "$event" != "agent_delegated" ]; then
    return
  fi

  case "$event" in
    session_start)
      wd=$(printf '%s' "$line" | jq -r '.working_dir // ""' 2>/dev/null)
      printf '▶ SESSION START [%s] (%s)\n' "$sid" "$wd"
      ;;
    session_end)
      printf '■ SESSION END   [%s]\n' "$sid"
      ;;
    agent_delegated)
      stage=$(printf '%s' "$line" | jq -r '.stage // ""' 2>/dev/null)
      agent=$(printf '%s' "$line" | jq -r '.agent // ""' 2>/dev/null)
      tier=$(printf '%s' "$line" | jq -r '.model_tier // ""' 2>/dev/null)
      status=$(printf '%s' "$line" | jq -r '.status // ""' 2>/dev/null)
      preview=$(printf '%s' "$line" | jq -r '.instructions_preview // ""' 2>/dev/null)
      printf '🤖 [%s] AGENT   stage=%s agent=%s tier=%s status=%s\n' \
        "$ts" "$stage" "$agent" "$tier" "$status"
      printf '   └─ %s\n' "$preview"
      ;;
    tool_use)
      tool=$(printf '%s' "$line" | jq -r '.tool // ""' 2>/dev/null)
      category=$(printf '%s' "$line" | jq -r '.category // ""' 2>/dev/null)
      status=$(printf '%s' "$line" | jq -r '.status // ""' 2>/dev/null)
      if [ "$status" = "failure" ]; then
        printf '✗  [%s] FAILURE %s\n' "$ts" "$tool"
      else
        printf '⚙  [%s] TOOL    %s [%s] %s\n' "$ts" "$tool" "$category" "$status"
      fi
      ;;
    *)
      printf '?  [%s] %s\n' "$ts" "$event"
      ;;
  esac
}

# Process each file
for f in $file_list; do
  [ -f "$f" ] || continue
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    format_entry "$line"
  done < "$f"
done

exit 0
