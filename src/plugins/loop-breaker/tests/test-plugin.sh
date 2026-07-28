#!/usr/bin/env sh
# Tests for loop-breaker plugin v2.1 (graduated response)
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PLUGIN_ROOT/scripts/count-failures.sh"

FAILS=0

pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; FAILS=$((FAILS + 1)); }

# Guard: script must be executable
[ -x "$SCRIPT" ] || { echo "FAIL: count-failures.sh not executable"; exit 1; }

# Guard: jq must be available for meaningful tests
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq not available"; exit 0; }

# Use an isolated session ID for each test run
SESSION="test-$$"

cleanup() {
  rm -f "/tmp/goose-fail-ctr-${SESSION}"*
  rm -f "/tmp/goose-tool-ctr-${SESSION}"*
  rm -f "/tmp/goose-err-ctr-${SESSION}"*
  rm -f "/tmp/goose-last-tool-${SESSION}"*
  rm -f "/tmp/goose-last-err-${SESSION}"*
  rm -f "/tmp/goose-correction-${SESSION}"*
}
cleanup

# ──────────────────────────────────────────────────────────────────────────────
# Test 1: 3 semantic errors → inject guidance (not block)
# ──────────────────────────────────────────────────────────────────────────────
test_inject_at_third_semantic_error() {
  SID="${SESSION}-t1"
  cleanup
  decision=""
  
  for i in 1 2 3; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  done
  
  [ "$decision" = "inject" ] \
    && pass "test_inject_at_third_semantic_error: inject on 3rd error" \
    || fail "test_inject_at_third_semantic_error: expected inject, got '$decision'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 2: 5 semantic errors → delegate_correction (not block)
# ──────────────────────────────────────────────────────────────────────────────
test_delegate_at_fifth_semantic_error() {
  SID="${SESSION}-t2"
  cleanup
  decision=""
  action=""
  
  for i in 1 2 3 4 5; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    action=$(printf '%s' "$out" | jq -r '.action // empty' 2>/dev/null)
  done
  
  [ "$decision" = "pause" ] && [ "$action" = "delegate_correction" ] \
    && pass "test_delegate_at_fifth_semantic_error: pause+delegate on 5th error" \
    || fail "test_delegate_at_fifth_semantic_error: expected pause+delegate_correction, got '$decision'+'$action'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 3: 8 semantic errors → hard block
# ──────────────────────────────────────────────────────────────────────────────
test_block_at_eighth_semantic_error() {
  SID="${SESSION}-t3"
  cleanup
  decision=""
  
  for i in 1 2 3 4 5 6 7 8; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  done
  
  [ "$decision" = "block" ] \
    && pass "test_block_at_eighth_semantic_error: hard block on 8th error" \
    || fail "test_block_at_eighth_semantic_error: expected block, got '$decision'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 4: 4 hard failures → delegate_correction
# ──────────────────────────────────────────────────────────────────────────────
test_delegate_at_fourth_hard_failure() {
  SID="${SESSION}-t4"
  cleanup
  decision=""
  action=""
  
  for i in 1 2 3 4; do
    payload=$(jq -cn --arg sid "$SID" '{event:"PostToolUseFailure",session_id:$sid,tool_name:"shell"}')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    action=$(printf '%s' "$out" | jq -r '.action // empty' 2>/dev/null)
  done
  
  [ "$decision" = "pause" ] && [ "$action" = "delegate_correction" ] \
    && pass "test_delegate_at_fourth_hard_failure: pause+delegate on 4th failure" \
    || fail "test_delegate_at_fourth_hard_failure: expected pause+delegate_correction, got '$decision'+'$action'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 5: 6 hard failures → block
# ──────────────────────────────────────────────────────────────────────────────
test_block_at_sixth_hard_failure() {
  SID="${SESSION}-t5"
  cleanup
  decision=""
  
  for i in 1 2 3 4 5 6; do
    payload=$(jq -cn --arg sid "$SID" '{event:"PostToolUseFailure",session_id:$sid,tool_name:"shell"}')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  done
  
  [ "$decision" = "block" ] \
    && pass "test_block_at_sixth_hard_failure: hard block on 6th failure" \
    || fail "test_block_at_sixth_hard_failure: expected block, got '$decision'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 6: Success resets counters
# ──────────────────────────────────────────────────────────────────────────────
test_reset_on_success() {
  SID="${SESSION}-t6"
  cleanup
  decision=""
  
  # 4 semantic errors (would trigger inject, then pause)
  for i in 1 2 3 4; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null > /dev/null
  done

  # 1 success — resets error counter
  payload=$(jq -cn --arg sid "$SID" '{
    event:"PostToolUse",
    session_id:$sid,
    tool_name:"shell",
    output:"command completed successfully"
  }')
  printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null > /dev/null

  # 2 more semantic errors — should NOT trigger (counter reset)
  for i in 1 2; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  done

  [ -z "$decision" ] \
    && pass "test_reset_on_success: counter reset by success, no decision after reset" \
    || fail "test_reset_on_success: expected no decision, got '$decision'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 7: Correction guidance includes specific help for run() error
# ──────────────────────────────────────────────────────────────────────────────
test_correction_guidance_content() {
  SID="${SESSION}-t7"
  cleanup
  message=""
  
  for i in 1 2 3; do
    payload=$(jq -cn --arg sid "$SID" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:"ReferenceError: run is not defined"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    message=$(printf '%s' "$out" | jq -r '.message // empty' 2>/dev/null)
  done
  
  # Accept either full guidance (TS) or short guidance (shell fallback)
  case "$message" in
    *"async function run()"*|*"run()"*|*"Wrap in run()"*)
      pass "test_correction_guidance_content: guidance includes run() reference"
      ;;
    *)
      fail "test_correction_guidance_content: guidance missing run() reference, got: ${message:0:100}..."
      ;;
  esac
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 8: 11 same-tool repetitions (success) → block
# ──────────────────────────────────────────────────────────────────────────────
test_same_tool_repetition_block() {
  SID="${SESSION}-t8"
  cleanup
  decision=""
  
  for i in 1 2 3 4 5 6 7 8 9 10 11; do
    payload=$(jq -cn --arg sid "$SID" --arg i "$i" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:"execute_typescript",
      output:("success output " + $i)
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
  done

  [ "$decision" = "block" ] \
    && pass "test_same_tool_repetition_block: blocked on 11th consecutive same-tool call" \
    || fail "test_same_tool_repetition_block: expected block, got '$decision'"
}

# ──────────────────────────────────────────────────────────────────────────────
# Test 9: Different tools interleaved → no decision
# ──────────────────────────────────────────────────────────────────────────────
test_different_tools_no_decision() {
  SID="${SESSION}-t9"
  cleanup
  decisions=0

  for i in 1 2 3 4 5 6 7 8 9 10; do
    if [ $((i % 2)) -eq 0 ]; then
      tool="shell"
    else
      tool="write"
    fi
    payload=$(jq -cn --arg sid "$SID" --arg t "$tool" '{
      event:"PostToolUse",
      session_id:$sid,
      tool_name:$t,
      output:"ok"
    }')
    out=$(printf '%s' "$payload" | sh "$SCRIPT" 2>/dev/null)
    decision=$(printf '%s' "$out" | jq -r '.decision // empty' 2>/dev/null)
    [ -n "$decision" ] && decisions=$((decisions + 1))
  done

  [ "$decisions" -eq 0 ] \
    && pass "test_different_tools_no_decision: alternating tools, no decisions" \
    || fail "test_different_tools_no_decision: expected 0 decisions, got $decisions"
}

# ──────────────────────────────────────────────────────────────────────────────
# Run all tests
# ──────────────────────────────────────────────────────────────────────────────
echo "=== loop-breaker plugin v2.1 tests ==="
echo ""

test_inject_at_third_semantic_error
test_delegate_at_fifth_semantic_error
test_block_at_eighth_semantic_error
test_delegate_at_fourth_hard_failure
test_block_at_sixth_hard_failure
test_reset_on_success
test_correction_guidance_content
test_same_tool_repetition_block
test_different_tools_no_decision

cleanup

echo ""
if [ "$FAILS" -eq 0 ]; then
  echo "All loop-breaker plugin tests passed (9/9)."
else
  echo "$FAILS test(s) FAILED."
fi

exit "$FAILS"
