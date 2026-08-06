#!/usr/bin/env sh
# Best-effort lifecycle telemetry. Beads remains authoritative; hook failure must not block Goose.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0
command -v bd >/dev/null 2>&1 || exit 0
event="$(printf '%s' "$payload" | jq -r '.event // "Unknown"' 2>/dev/null)" || exit 0
session_id="$(printf '%s' "$payload" | jq -r '.session_id // "unknown"' 2>/dev/null)" || session_id=unknown
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null)" || tool_name=
working_dir="$(printf '%s' "$payload" | jq -r '.working_dir // empty' 2>/dev/null)" || working_dir=
[ -n "$working_dir" ] && [ -d "$working_dir" ] && cd "$working_dir" 2>/dev/null || true
run_id=${GOOSE_LOOP_RUN_ID:-}
# Auto-discover the in-progress run when env var is not set
if [ -z "$run_id" ]; then
  run_id="$(bd list --type=epic --status=in_progress --json 2>/dev/null | jq -r 'map(select(.title | test("loop|engineering|run"; "i"))) | .[0].id // empty' 2>/dev/null)" || run_id=
fi
[ -n "$run_id" ] || exit 0
case "$run_id" in *[!A-Za-z0-9._-]*|'') exit 0 ;; esac
run_json="$(bd show "$run_id" --json 2>/dev/null)" || exit 0
summary="$(jq -cn --arg event "$event" --arg session "$session_id" --arg tool "$tool_name" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{event:$event,session_id:$session,tool_name:(if $tool=="" then null else $tool end),timestamp:$ts}')" || exit 0
bd create "Goose lifecycle: $event" --type event --event-category "goose.lifecycle" --event-target "$run_id" --event-actor "goose-session:$session_id" --event-payload "$summary" --ephemeral --silent >/dev/null 2>&1 || true
exit 0
