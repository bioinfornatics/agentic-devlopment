#!/usr/bin/env sh
# HAR-01 gate: blocks closing a Beads task unless it carries the label env:reviewed.
# Intercepts: bd close <id> and bd update <id> --status=closed
# Failure must never block Goose for non-matching commands.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0
command -v bd >/dev/null 2>&1 || exit 0
command_text=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$command_text" ] || exit 0
# Match: bd close <id> or bd update <id> ... --status=closed
issue_id=
case "$command_text" in
  *"bd close "*)
    issue_id=$(printf '%s' "$command_text" | grep -oE 'bd close [A-Za-z0-9._-]+' | awk '{print $3}')
    ;;
  *"bd update "*"--status=closed"*|*"bd update "*"-s closed"*)
    issue_id=$(printf '%s' "$command_text" | grep -oE 'bd update [A-Za-z0-9._-]+' | awk '{print $3}')
    ;;
esac
[ -n "$issue_id" ] || exit 0
working_dir="$(printf '%s' "$payload" | jq -r '.working_dir // empty' 2>/dev/null)" || working_dir=
[ -n "$working_dir" ] && [ -d "$working_dir" ] && cd "$working_dir" 2>/dev/null || true
labels="$(bd show "$issue_id" --json 2>/dev/null | jq -r '.labels // [] | @csv' 2>/dev/null)" || exit 0
case "$labels" in
  *env:reviewed*)
    exit 0
    ;;
  *)
    jq -cn --arg id "$issue_id" '{decision:"block",reason:("HAR-01: task "+$id+" requires label env:reviewed before closing. Add it with: bd update "+$id+" --add-label env:reviewed")}'
    exit 0
    ;;
esac
