#!/usr/bin/env sh
# Tests for loop-breaker plugin
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PLUGIN_ROOT/scripts/count-failures.sh"

FAILS=0

pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; FAILS=$((FAILS + 1)); }

# Guard: script must be executable
[ -x "$SCRIPT" ] || { echo "FAIL: count-failures.sh not executable"; exit 1; }

# Guard: jq must be available for meaningful tests
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq not available"; exit 0; }

# Use an isolated session ID for each test run to avoid counter file collisions
SESSION="test-$$"

cleanup() {
  rm -f "/tmp/goose-fail-ctr-${SESSION}"
  rm -f "/tmp/goose-fail-ctr-${SESSION}-reset"
}
cleanup

# ──────────────────────────────────────────────────────────────────────────────
# Test 1: 3 consecutive PostToolUseFailure events → no block emitted
# ──────────────────────────────────────────────────────────────────────────────
test_no_block_below_threshold() {
  rm -f "/tmp/goose-fail-ctr-${SESSION}"
  blocked=0
  for i in 1 2 3; do
    payload=$(jq -cn --arg sid "$SESSION" '{event:"PostToolUseFailure",session_id:$sid}')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    [ "$decision" = "block" ] && blocked=$((blocked + 1))
  done
  [ "$blocked" -eq 0 ] \
    && pass "test_no_block_below_threshold: 3 failures, no block" \
    || fail "test_no_block_below_threshold: expected 0 blocks, got $blocked"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 2: 4th consecutive PostToolUseFailure → block emitted on 4th call
# ──────────────────────────────────────────────────────────────────────────────
test_block_at_fourth_failure() {
  rm -f "/tmp/goose-fail-ctr-${SESSION}"
  blocked=0
  for i in 1 2 3 4; do
    payload=$(jq -cn --arg sid "$SESSION" '{event:"PostToolUseFailure",session_id:$sid}')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    [ "$decision" = "block" ] && blocked=$((blocked + 1))
  done
  [ "$blocked" -eq 1 ] \
    && pass "test_block_at_fourth_failure: exactly 1 block on 4th failure" \
    || fail "test_block_at_fourth_failure: expected 1 block, got $blocked"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 3: 3 failures, then 1 success (PostToolUse), then 1 failure → no block
# ──────────────────────────────────────────────────────────────────────────────
test_reset_on_success() {
  SID="${SESSION}-reset"
  rm -f "/tmp/goose-fail-ctr-${SID}"
  blocked=0

  # 3 failures
  for i in 1 2 3; do
    payload=$(jq -cn --arg sid "$SID" '{event:"PostToolUseFailure",session_id:$sid}')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    [ "$decision" = "block" ] && blocked=$((blocked + 1))
  done

  # 1 success — resets counter
  payload=$(jq -cn --arg sid "$SID" '{event:"PostToolUse",session_id:$sid}')
  printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null

  # 1 more failure — should NOT block (counter was reset)
  payload=$(jq -cn --arg sid "$SID" '{event:"PostToolUseFailure",session_id:$sid}')
  out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
  decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  [ "$decision" = "block" ] && blocked=$((blocked + 1))

  [ "$blocked" -eq 0 ] \
    && pass "test_reset_on_success: counter reset by success, no block after reset" \
    || fail "test_reset_on_success: expected 0 blocks after reset, got $blocked"
}

# ──────────────────────────────────────────────────────────────────────────────
# Run all tests
# ──────────────────────────────────────────────────────────────────────────────
test_no_block_below_threshold
test_block_at_fourth_failure
test_reset_on_success

cleanup

if [ "$FAILS" -eq 0 ]; then
  echo "All loop-breaker plugin tests passed."
else
  echo "$FAILS test(s) FAILED."
fi

exit "$FAILS"
