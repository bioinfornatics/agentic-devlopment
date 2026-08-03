#!/usr/bin/env sh
# budget-tracker smoke tests
set -e
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUDGET_SAVE=${GOOSE_TOOL_BUDGET:-}
export GOOSE_TOOL_BUDGET=3

SESSION="test-budget-$$"
DATA_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/goose-budget"
mkdir -p "$DATA_DIR"

# 1. init
printf '{"event":"SessionStart","session_id":"%s"}' "$SESSION" | bash "$PLUGIN_ROOT/scripts/init-session.sh"
[ -f "$DATA_DIR/$SESSION" ] || { echo "FAIL: init-session did not create counter file"; exit 1; }

# 2. track 3 calls
for i in 1 2 3; do
  printf '{"event":"PostToolUse","session_id":"%s","tool_name":"shell","tool_output":"hello"}' "$SESSION" \
    | bash "$PLUGIN_ROOT/scripts/track-call.sh"
done
. "$DATA_DIR/$SESSION"; [ "$calls" -eq 3 ] || { echo "FAIL: expected calls=3, got calls=$calls"; exit 1; }

# 3. check-budget at limit → must allow (calls==budget, not >)
result=$(printf '{"event":"PreToolUse","session_id":"%s","tool_name":"shell"}' "$SESSION" \
  | bash "$PLUGIN_ROOT/scripts/check-budget.sh")
[ -z "$result" ] || { echo "FAIL: expected allow at limit, got: $result"; exit 1; }

# 4. one more call → now calls=4 > budget=3 → must block
printf '{"event":"PostToolUse","session_id":"%s","tool_name":"shell","tool_output":"x"}' "$SESSION" \
  | bash "$PLUGIN_ROOT/scripts/track-call.sh"
result=$(printf '{"event":"PreToolUse","session_id":"%s","tool_name":"shell"}' "$SESSION" \
  | bash "$PLUGIN_ROOT/scripts/check-budget.sh")
echo "$result" | grep -q '"decision":"block"' || { echo "FAIL: expected block, got: $result"; exit 1; }

# 5. finalize
printf '{"event":"SessionEnd","session_id":"%s"}' "$SESSION" | bash "$PLUGIN_ROOT/scripts/finalize-session.sh"
[ ! -f "$DATA_DIR/$SESSION" ] || { echo "FAIL: finalize-session did not clean up counter file"; exit 1; }

[ -n "$BUDGET_SAVE" ] && export GOOSE_TOOL_BUDGET="$BUDGET_SAVE" || unset GOOSE_TOOL_BUDGET
echo "All budget-tracker plugin tests passed."
