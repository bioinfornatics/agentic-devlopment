#!/bin/sh
# record-trace.sh — Write a structured JSONL trace entry for loop-engineering events.
# Receives hook payload JSON on stdin.
# All errors are silenced (exit 0) to never block Goose.
set -u

# Require jq
command -v jq >/dev/null 2>&1 || exit 0

# Read stdin payload
payload=$(cat) || exit 0

# Extract common fields
event=$(printf '%s' "$payload" | jq -r '.event // "unknown"' 2>/dev/null) || exit 0
session_id=$(printf '%s' "$payload" | jq -r '.session_id // "unknown"' 2>/dev/null) || exit 0
tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
working_dir=$(printf '%s' "$payload" | jq -r '.working_dir // ""' 2>/dev/null) || exit 0

# Validate session_id (path safety: only allow [A-Za-z0-9._-])
case "$session_id" in
  *[!A-Za-z0-9._-]*) exit 0 ;;
esac

# Set up trace directory and log file
today=$(date -u +%Y-%m-%d)
TRACE_DIR="$HOME/.local/state/goose/logs/loop-trace/$today"
mkdir -p "$TRACE_DIR" 2>/dev/null || exit 0
LOG_FILE="$TRACE_DIR/${session_id}.jsonl"

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Build the trace entry based on event type
case "$event" in
  SessionStart)
    entry=$(jq -cn \
      --arg ts "$ts" \
      --arg sid "$session_id" \
      --arg wd "$working_dir" \
      '{ts: $ts, event: "session_start", session_id: $sid, working_dir: $wd}') || exit 0
    ;;

  SessionEnd)
    entry=$(jq -cn \
      --arg ts "$ts" \
      --arg sid "$session_id" \
      '{ts: $ts, event: "session_end", session_id: $sid}') || exit 0
    ;;

  PostToolUse|PostToolUseFailure)
    # Determine status
    case "$event" in
      PostToolUseFailure) status="failure" ;;
      *)                  status="success" ;;
    esac

    if [ "$tool_name" = "delegate" ]; then
      # Agent delegation path
      source=$(printf '%s' "$payload" | jq -r '.tool_input.source // ""' 2>/dev/null) || exit 0
      raw_instructions=$(printf '%s' "$payload" | jq -r '.tool_input.instructions // ""' 2>/dev/null) || exit 0

      # Truncate instructions to 120 chars and replace newlines with spaces
      instructions_preview=$(printf '%s' "$raw_instructions" | tr '\n' ' ' | cut -c1-120)

      # Infer stage from agent name
      case "$source" in
        repository-researcher)
          stage="01-planner"
          ;;
        change-builder|change-builder-premium)
          stage="02-builder"
          ;;
        independent-verifier|independent-verifier-premium)
          stage="03-verifier"
          ;;
        *)
          stage="unknown"
          ;;
      esac

      # Infer model tier
      case "$source" in
        *premium*) model_tier="premium" ;;
        *)         model_tier="standard" ;;
      esac

      entry=$(jq -cn \
        --arg ts "$ts" \
        --arg sid "$session_id" \
        --arg agent "$source" \
        --arg stage "$stage" \
        --arg tier "$model_tier" \
        --arg status "$status" \
        --arg preview "$instructions_preview" \
        '{ts: $ts, event: "agent_delegated", session_id: $sid, agent: $agent, stage: $stage, model_tier: $tier, status: $status, instructions_preview: $preview}') || exit 0
    else
      # Generic tool use path
      # Categorize tool
      case "$tool_name" in
        shell|*shell*) category="shell" ;;
        *read*|*write*|*edit*|*file*) category="file_op" ;;
        *search*|*web*) category="search" ;;
        load|load_skill) category="skill_load" ;;
        *) category="tool" ;;
      esac

      entry=$(jq -cn \
        --arg ts "$ts" \
        --arg sid "$session_id" \
        --arg tool "$tool_name" \
        --arg cat "$category" \
        --arg status "$status" \
        '{ts: $ts, event: "tool_use", session_id: $sid, tool: $tool, category: $cat, status: $status}') || exit 0
    fi
    ;;

  *)
    # Unknown event — skip silently
    exit 0
    ;;
esac

# Append entry to JSONL log file (one compact JSON line)
printf '%s\n' "$entry" >> "$LOG_FILE" 2>/dev/null || exit 0

exit 0
