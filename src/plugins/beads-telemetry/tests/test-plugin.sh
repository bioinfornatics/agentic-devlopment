#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RECORD="$ROOT/scripts/record-event.sh"
fail() { echo "FAIL: $*" >&2; exit 1; }
env -u GOOSE_LOOP_RUN_ID "$RECORD" <<<'{"event":"SessionStart","session_id":"test"}'
before="$(find "$ROOT/../../.." -maxdepth 1 -name .loop -print 2>/dev/null)"
env -u GOOSE_LOOP_RUN_ID "$RECORD" <<<'{"event":"SessionStart","session_id":"test-2"}'
after="$(find "$ROOT/../../.." -maxdepth 1 -name .loop -print 2>/dev/null)"
[[ "$before" == "$after" ]] || fail "plugin created forbidden .loop state"
if grep -Eq 'last_assistant_message|\.message|tool_input\.command' "$RECORD"; then fail "record-event reads sensitive content"; fi
jq -e '.hooks.SessionStart[0].hooks[0].command == "${PLUGIN_ROOT}/scripts/record-event.sh"' "$ROOT/hooks/hooks.json" >/dev/null
echo "beads-telemetry plugin tests passed"
