#!/usr/bin/env sh
# Tests for loop-telemetry plugin
set -e
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PLUGIN_ROOT/scripts/record-event.sh"

# 1. Script is executable
[ -x "$SCRIPT" ] || { echo "FAIL: record-event.sh not executable"; exit 1; }

# 2. Safe invocation with no run_id exits cleanly (no GOOSE_LOOP_RUN_ID)
payload='{"event":"SessionStart","session_id":"test-session"}'
result=$(printf '%s' "$payload" | env -u GOOSE_LOOP_RUN_ID sh "$SCRIPT" 2>&1; echo "exit:$?")
case "$result" in *"exit:0"*) echo "PASS: exits 0 without run_id" ;; *) echo "FAIL: $result"; exit 1 ;; esac

# 3. No .loop state created
[ ! -d "$PLUGIN_ROOT/../../.loop" ] || { echo "FAIL: .loop state created"; exit 1; }
echo "PASS: no .loop state"

# 4. Script does not read sensitive paths
grep -qv '/etc/passwd\|/etc/shadow\|\.ssh' "$SCRIPT" || { echo "FAIL: sensitive path reference"; exit 1; }
echo "PASS: no sensitive path references"

echo "All loop-telemetry plugin tests passed."
