#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$ROOT/scripts/guard-shell.sh"
fail() { echo "FAIL: $*" >&2; exit 1; }
allow="$(printf '%s' '{"event":"PreToolUse","tool_input":{"command":"printf ok"}}' | "$GUARD")"
[[ -z "$allow" ]] || fail "safe command emitted a policy response"
block="$(printf '%s' '{"event":"PreToolUse","tool_input":{"command":"sudo rm -rf /tmp/example"}}' | "$GUARD")"
printf '%s' "$block" | jq -e '.decision == "block" and (.reason | length > 0)' >/dev/null || fail "dangerous command was not blocked"
jq -e '.hooks.PreToolUse[0].matcher == "^developer__shell$"' "$ROOT/hooks/hooks.json" >/dev/null
echo "prevent-catastrophe plugin tests passed"
