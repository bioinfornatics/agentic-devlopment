#!/usr/bin/env sh
# Open Plugin PreToolUse policy hook. Emit a clean block JSON signal or no output.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0
command_text=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
reason=
case "$command_text" in
  *"rm -rf /"*|*"rm -rf --no-preserve-root"*) reason="recursive deletion of a root path is denied" ;;
  *"mkfs."*|*"wipefs "*) reason="filesystem destruction is denied" ;;
  *"dd if="*" of=/dev/"*) reason="raw device overwrite is denied" ;;
  *":(){ :|:& };:"*) reason="fork bomb is denied" ;;
  *"git reset --hard"*|*"git clean -fd"*) reason="destructive repository reset or clean requires explicit human execution" ;;
  *"sudo "*) reason="privileged shell execution requires explicit human authorization" ;;
esac
[ -z "$reason" ] || jq -cn --arg reason "$reason" '{decision:"block",reason:$reason}'
exit 0
