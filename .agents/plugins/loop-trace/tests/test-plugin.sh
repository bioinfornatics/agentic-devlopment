#!/usr/bin/env sh
# Tests for loop-trace plugin
set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RECORD_SCRIPT="$PLUGIN_ROOT/scripts/record-trace.sh"
SHOW_SCRIPT="$PLUGIN_ROOT/scripts/show-trace.sh"
TODAY=$(date -u +%Y-%m-%d)
TRACE_DIR="$HOME/.local/state/goose/logs/loop-trace/$TODAY"

# Require jq
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq not available"; exit 0; }

# Scripts are executable
[ -x "$RECORD_SCRIPT" ] || { echo "FAIL: record-trace.sh not executable"; exit 1; }
[ -x "$SHOW_SCRIPT" ]   || { echo "FAIL: show-trace.sh not executable"; exit 1; }

# ─── Test 1: session_start is logged ────────────────────────────────────────
TEST_SESSION_1="test-trace-001"
TEST_FILE_1="$TRACE_DIR/${TEST_SESSION_1}.jsonl"

# Clean up any pre-existing file from a previous run
rm -f "$TEST_FILE_1"

payload='{"event":"SessionStart","session_id":"test-trace-001","working_dir":"/tmp"}'
printf '%s' "$payload" | sh "$RECORD_SCRIPT"

[ -f "$TEST_FILE_1" ] || { echo "FAIL: trace file not created for session_start"; exit 1; }
grep -q '"session_start"' "$TEST_FILE_1" || { echo "FAIL: session_start not found in trace"; exit 1; }

rm -f "$TEST_FILE_1"
echo "PASS: test_session_start_logged"

# ─── Test 2: agent delegation is logged ─────────────────────────────────────
TEST_SESSION_2="test-trace-002"
TEST_FILE_2="$TRACE_DIR/${TEST_SESSION_2}.jsonl"

rm -f "$TEST_FILE_2"

payload='{"event":"PostToolUse","session_id":"test-trace-002","tool_name":"delegate","tool_input":{"source":"change-builder","instructions":"Implement task xyz"}}'
printf '%s' "$payload" | sh "$RECORD_SCRIPT"

[ -f "$TEST_FILE_2" ] || { echo "FAIL: trace file not created for agent delegation"; exit 1; }
grep -q '"agent_delegated"' "$TEST_FILE_2" || { echo "FAIL: agent_delegated not found in trace"; exit 1; }
grep -q '"02-builder"' "$TEST_FILE_2" || { echo "FAIL: stage 02-builder not found in trace"; exit 1; }

rm -f "$TEST_FILE_2"
echo "PASS: test_agent_delegation_logged"

# ─── Test 3: show-trace runs and formats output ──────────────────────────────
TEST_SESSION_3="test-show-001"
TEST_FILE_3="$TRACE_DIR/${TEST_SESSION_3}.jsonl"

mkdir -p "$TRACE_DIR"
printf '%s\n' '{"ts":"2026-01-01T00:00:00Z","event":"session_start","session_id":"test-show-001","working_dir":"/tmp"}' > "$TEST_FILE_3"

output=$(sh "$SHOW_SCRIPT" --session "$TEST_SESSION_3" --date "$TODAY" 2>&1)

printf '%s' "$output" | grep -q "SESSION START" || { echo "FAIL: show-trace output missing SESSION START"; rm -f "$TEST_FILE_3"; exit 1; }

rm -f "$TEST_FILE_3"
echo "PASS: test_show_trace_runs"

echo "All loop-trace plugin tests passed."
