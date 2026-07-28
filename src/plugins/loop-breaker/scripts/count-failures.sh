#!/usr/bin/env sh
# loop-breaker v2.4: Shell trampoline to TypeScript/binary implementation
# 
# Execution order:
#   1. Pre-compiled binary (fastest)
#   2. bun (native TS)
#   3. deno (native TS)
#   4. Shell fallback (minimal, jq required)

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
BIN="$PLUGIN_ROOT/bin/loop-breaker"
TS_SCRIPT=""

# Cache stdin for potential fallback
_stdin_cache=$(cat)

# 1. Try pre-compiled binary
if [ -x "$BIN" ]; then
  result=$(printf '%s' "$_stdin_cache" | "$BIN" 2>/dev/null) && {
    [ -n "$result" ] && printf '%s' "$result"
    exit 0
  }
fi

# Runtime packages contain only the compiled binary plus shell fallback.
# Application source lives in src/app/loop-breaker and is never projected.

# ═
# FALLBACK: Pure shell implementation (when no TS runtime available)
# ═══════════════════════════════════════════════════════════════════════════

payload="$_stdin_cache"
[ -z "$payload" ] && payload='{}'
command -v jq >/dev/null 2>&1 || exit 0

event=$(printf '%s' "$payload" | jq -r '.event // empty' 2>/dev/null) || exit 0
[ -n "$event" ] || exit 0

session_id=$(printf '%s' "$payload" | jq -r '.session_id // "unknown"' 2>/dev/null) || exit 0
tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // .tool // empty' 2>/dev/null) || exit 0
tool_output=$(printf '%s' "$payload" | jq -r '.output // .result // .stdout // .stderr // empty' 2>/dev/null) || exit 0

case "$session_id" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

# Use temp directory for counters (plugin DB handles persistence in TS version)
DATA_DIR="${TMPDIR:-/tmp}"

FAIL_CTR="$DATA_DIR/goose-fail-ctr-${session_id}"
ERR_CTR="$DATA_DIR/goose-err-ctr-${session_id}"
TOOL_CTR="$DATA_DIR/goose-tool-ctr-${session_id}"
LAST_TOOL="$DATA_DIR/goose-last-tool-${session_id}"

is_err() {
  case "$1" in
    *"ReferenceError"*|*"is not defined"*|*"TypeError"*|*"SyntaxError"*|*"Error:"*|*"ENOENT"*|*"Permission denied"*|*"command not found"*) return 0 ;;
  esac
  return 1
}

read_ctr() { [ -f "$1" ] && read -r v < "$1" 2>/dev/null && printf '%s' "$v" || printf '0'; }

case "$event" in
  PostToolUse)
    if is_err "$tool_output"; then
      c=$(read_ctr "$ERR_CTR"); lt=""; [ -f "$LAST_TOOL" ] && read -r lt < "$LAST_TOOL"
      [ "$lt" = "$tool_name" ] && c=$((c + 1)) || c=1
      printf '%s\n' "$c" > "$ERR_CTR"; printf '%s\n' "$tool_name" > "$LAST_TOOL"
      
      [ "$c" -ge 8 ] && jq -cn --argjson c "$c" --arg t "$tool_name" \
        '{decision:"block",reason:("LOOP-BREAKER: "+$t+" failed "+($c|tostring)+" times. Hard stop.")}'
      [ "$c" -ge 5 ] && [ "$c" -lt 8 ] && jq -cn --argjson c "$c" --arg t "$tool_name" \
        '{decision:"pause",action:"delegate_correction",reason:("LOOP-BREAKER: "+$t+" failed "+($c|tostring)+" times.")}'
      [ "$c" -ge 3 ] && [ "$c" -lt 5 ] && jq -cn --argjson c "$c" \
        '{decision:"inject",message:"LOOP-BREAKER: Check code structure. Wrap in run() for execute_typescript."}'
    else
      rm -f "$FAIL_CTR" "$ERR_CTR" 2>/dev/null
    fi
    
    c=$(read_ctr "$TOOL_CTR"); lt=""; [ -f "$LAST_TOOL" ] && read -r lt < "$LAST_TOOL"
    [ "$lt" = "$tool_name" ] && c=$((c + 1)) || c=1
    printf '%s\n' "$c" > "$TOOL_CTR"; printf '%s\n' "$tool_name" > "$LAST_TOOL"
    [ "$c" -gt 10 ] && jq -cn --argjson c "$c" --arg t "$tool_name" \
      '{decision:"block",reason:("LOOP-BREAKER: "+$t+" called "+($c|tostring)+" times. Loop detected.")}'
    ;;
    
  PostToolUseFailure)
    c=$(read_ctr "$FAIL_CTR"); c=$((c + 1)); printf '%s\n' "$c" > "$FAIL_CTR"
    [ "$c" -ge 6 ] && jq -cn --argjson c "$c" '{decision:"block",reason:("LOOP-BREAKER: "+($c|tostring)+" failures. Hard stop.")}'
    [ "$c" -ge 4 ] && [ "$c" -lt 6 ] && jq -cn --argjson c "$c" '{decision:"pause",action:"delegate_correction"}'
    ;;
    
  SessionEnd)
    rm -f "$DATA_DIR/goose-"*"-${session_id}" 2>/dev/null
    ;;
esac

exit 0