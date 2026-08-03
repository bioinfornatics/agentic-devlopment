---
name: plugin-authoring
description: >
  Design, implement, test, and install Open-Plugins-format Goose plugins with
  correct hook wiring. Use when creating or modifying any plugin that
  contributes hooks, MCP servers, or skills to a Goose session. Do not use
  for recipe or agent authoring.
---

# Plugin authoring

A Goose plugin is a directory installed at `~/.agents/plugins/<name>/` or
`<project-root>/.agents/plugins/<name>/`. Goose discovers it automatically at
agent creation — no recipe field activates or deactivates plugins. Plugins
contribute three independent mechanisms: **hooks**, **MCP servers**, and
**skills**.

---

## Source-verified facts (crates/goose, inspected 2026-08)

These rules are derived from the Goose Rust source. Where documentation and
source code conflict, the source wins.

### Discovery — `crates/goose/src/plugins/discovery.rs`

`HookManager::load(current_dir, …)` is called **once per agent instance** at
construction time (`agent.rs:458`). It runs:

```
discover_enabled_plugins(project_root)
  ├─ scan <cwd>/.agents/plugins/                      ← project scope (wins on conflict)
  ├─ scan ~/.agents/plugins/                          ← user scope
  ├─ apply <project>/.config/goose/settings.local.json  ← local overrides (highest priority)
  ├─ apply <project>/.config/goose/settings.json        ← project overrides
  ├─ apply ~/.config/goose/settings.json                ← user overrides
  └─ apply ~/.config/goose/config.yaml                  ← plugins.{abs-path}.enabled bool
```

**A newly discovered plugin is auto-enabled with no extra configuration.**

Settings file format (`settings.json`):
```json
{ "disabledPlugins": ["loop-gate"], "enabledPlugins": [] }
```
`enabledPlugins` restricts to an allowlist only when it is non-empty.
Priority order: local > project > user.

---

### Hook events — `crates/goose/src/hooks/mod.rs`

Eleven events exist in the `HookEvent` enum. Unknown names in `hooks.json`
are silently ignored at load time.

| Event | Mode | When fired |
|---|---|---|
| `PreToolUse` | **blocking** | Before every tool call |
| `PostToolUse` | fire-and-forget | After successful tool call |
| `PostToolUseFailure` | fire-and-forget | After failed tool call |
| `SessionStart` | fire-and-forget | Session created |
| `SessionEnd` | fire-and-forget | Session ends normally |
| `Stop` | **blocking** | Before session stops |
| `UserPromptSubmit` | fire-and-forget | User sends a message |
| `BeforeReadFile` | fire-and-forget | Before a file is read |
| `AfterFileEdit` | fire-and-forget | After a file is written |
| `BeforeShellExecution` | fire-and-forget | Before a shell command |
| `AfterShellExecution` | fire-and-forget | After a shell command |

**Blocking** means `emit_blocking()` is used — the hook can deny the action
and the result is returned to the model as a policy error. Fire-and-forget
uses `emit()` — failures are logged and swallowed, the session continues.

---

### Hook context — `HookContext` struct (stdin JSON)

```json
{
  "event": "PreToolUse",
  "session_id": "20260803_1",
  "matcher_context": "developer__shell",
  "tool_name":  "developer__shell",
  "tool_input": { "command": "rm -rf /" },
  "tool_output": { "...": "..." },
  "message": "...",
  "last_assistant_message": "...",
  "working_dir": "/home/user/project"
}
```

Fields that do not apply to the event are **omitted** (never null). The
`matcher_context` field holds the tool name for tool events, the file path
for file events, and the command string for shell events — this is what the
`matcher` regex is tested against.

---

### Blocking protocol — `deny_reason()` function

A hook blocks by **either** of two mechanisms (not both):

```sh
# Mechanism 1 — exit code 2 + reason on stderr
echo "destructive operation denied" >&2
exit 2

# Mechanism 2 — JSON block decision on stdout, any exit code
printf '%s' '{"decision":"block","reason":"destructive operation denied"}'
exit 0
```

Any other failure (timeout, spawn error, exit 1, exit 3…) → **fail-open
(Allow)**. A broken hook must never block the session.

---

### Matcher field — regex on `matcher_context`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "developer__shell|developer__text_editor",
        "hooks": [
          {
            "type": "command",
            "command": "${PLUGIN_ROOT}/scripts/guard.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

If `matcher` is absent or empty, the rule fires for **every** call of that
event. Multiple rules per event are evaluated in order; for blocking events,
the **first denial wins**.

Default `timeout` is 30 seconds. Set it explicitly if the script can be
slower (non-blocking only — blocking hooks should never be slow).

---

### Critical: `plugins:` YAML key in recipes does not exist

The `Recipe` struct (`crates/goose/src/recipe/mod.rs`) has **no `plugins`
field**. The struct fields are: `version`, `title`, `description`,
`instructions`, `prompt`, `extensions`, `settings`, `activities`, `author`,
`parameters`, `response`, `sub_recipes`, `retry`. No `plugins`.

serde drops unknown YAML keys by default. `goose recipe validate` passes
because `deny_unknown_fields` is not set. A `plugins:` key in a recipe YAML
is **silently discarded** — it does nothing.

> Never add `plugins:` to a recipe expecting it to activate or configure a
> plugin. Plugins are activated by filesystem presence and `settings.json`.

---

### Critical: `extensions:` in a recipe suppresses plugin MCP servers

```rust
// session/builder.rs:441
if !session_config.no_profile && !session_config.resume && recipe_extensions.is_none() {
    all.extend(goose::plugins::mcp_servers::enabled_plugin_mcp_servers(…));
}
```

When a recipe declares `extensions:`, the auto-discovery of plugin-contributed
MCP servers is **skipped**. Hooks are not affected — they are loaded
independently at agent construction.

Consequence: if your plugin contributes an MCP server and your recipe defines
`extensions:` (most do), the MCP server will **not** be loaded automatically.
Declare it explicitly in the recipe's `extensions:` block, or the plugin MCP
server will be absent from recipe sessions.

---

## Required plugin structure

```
<plugin-name>/
├── plugin.json              # required
├── hooks/
│   └── hooks.json           # optional — hook rules
├── scripts/                 # optional — hook scripts
│   └── <script>.sh
├── skills/                  # optional — skill directories (Gemini format)
│   └── <skill-name>/
│       └── SKILL.md
└── tests/
    └── test-plugin.sh       # smoke test
```

### `plugin.json` — minimum required

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "One sentence describing what this plugin enforces or provides."
}
```

### `hooks/hooks.json` — full schema

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "optional-regex-on-matcher_context",
        "hooks": [
          {
            "type": "command",
            "command": "${PLUGIN_ROOT}/scripts/script.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

`${PLUGIN_ROOT}` is expanded by Goose to the plugin's installation directory
before the command is executed. Only `type: "command"` is supported; other
types are ignored without error.

---

## Hook script templates

### PreToolUse guard (blocking)

```sh
#!/usr/bin/env sh
# Policy guard — denies specific shell operations.
# Blocking hook: must complete fast (< 5 s). Fail-open on any unexpected error.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0   # fail-open if jq absent

command_text=$(printf '%s' "$payload" \
  | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$command_text" ] || exit 0

reason=
case "$command_text" in
  *"rm -rf /"*)                reason="recursive root deletion denied" ;;
  *"mkfs."*|*"wipefs "*)       reason="filesystem destruction denied" ;;
  *":(){ :|:& };:"*)           reason="fork bomb denied" ;;
esac

[ -z "$reason" ] || \
  printf '%s' "{\"decision\":\"block\",\"reason\":\"$reason\"}"
exit 0
```

### PostToolUse telemetry (fire-and-forget)

```sh
#!/usr/bin/env sh
# Best-effort telemetry — must never block, must never crash the session.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

event=$(printf '%s' "$payload"       | jq -r '.event      // "Unknown"' 2>/dev/null) || exit 0
session=$(printf '%s' "$payload"     | jq -r '.session_id // empty'     2>/dev/null) || exit 0
tool=$(printf '%s' "$payload"        | jq -r '.tool_name  // empty'     2>/dev/null) || tool=
working_dir=$(printf '%s' "$payload" | jq -r '.working_dir // empty'    2>/dev/null) || working_dir=
[ -n "$working_dir" ] && [ -d "$working_dir" ] && cd "$working_dir" 2>/dev/null || true

# Side effects here — errors are logged by Goose, not fatal
exit 0
```

### Stop gate (blocking)

```sh
#!/usr/bin/env sh
# Blocks the session from stopping unless a condition is met.
set -u
payload=$(cat 2>/dev/null || printf '{}')
command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session" ] || exit 0

# Example: require a Beads task to be closed before stopping
# Replace with actual condition
condition_met=true
if [ "$condition_met" = "false" ]; then
  printf '%s' '{"decision":"block","reason":"condition not met — complete X before stopping"}'
fi
exit 0
```

---

## Installation

```sh
# Project-local — active only in this repo
cp -r my-plugin <project-root>/.agents/plugins/my-plugin

# User-global — active in every project
cp -r my-plugin ~/.agents/plugins/my-plugin

# Via git (Goose installs and tracks for auto-update)
goose plugin install https://github.com/org/my-plugin

# Make scripts executable
chmod +x ~/.agents/plugins/my-plugin/scripts/*.sh
```

No Goose restart is required — the plugin is loaded at the **next session
start**.

---

## Disable without uninstalling

```sh
# Disable globally
jq '.disabledPlugins += ["my-plugin"]' \
  ~/.config/goose/settings.json | sponge ~/.config/goose/settings.json

# Disable for one project
mkdir -p .config/goose
printf '%s\n' '{"disabledPlugins":["my-plugin"]}' > .config/goose/settings.json

# Disable via config.yaml (keyed by absolute path)
# plugins:
#   /home/user/.agents/plugins/my-plugin:
#     enabled: false
```

---

## Testing

### Smoke-test a PreToolUse guard

```sh
cd ~/.agents/plugins/my-plugin

# Should block — prints {"decision":"block",…}
printf '%s' '{
  "event":"PreToolUse","session_id":"test",
  "matcher_context":"developer__shell",
  "tool_name":"developer__shell",
  "tool_input":{"command":"rm -rf /"},
  "working_dir":"/tmp"
}' | PLUGIN_ROOT=$(pwd) bash scripts/guard.sh
echo "exit: $?"

# Should allow — prints nothing
printf '%s' '{
  "event":"PreToolUse","session_id":"test",
  "matcher_context":"developer__shell",
  "tool_name":"developer__shell",
  "tool_input":{"command":"echo hello"},
  "working_dir":"/tmp"
}' | PLUGIN_ROOT=$(pwd) bash scripts/guard.sh
echo "exit: $?"
```

### Smoke-test a PostToolUse script

```sh
printf '%s' '{
  "event":"PostToolUse","session_id":"test",
  "tool_name":"developer__shell","working_dir":"/tmp"
}' | PLUGIN_ROOT=$(pwd) bash scripts/record.sh
echo "exit: $?"   # must be 0
```

### Validate hooks.json

```sh
jq empty hooks/hooks.json && echo "valid JSON"

# Check event names are spelled correctly (case-sensitive)
jq -r '.hooks | keys[]' hooks/hooks.json
# Valid names: PreToolUse PostToolUse PostToolUseFailure
#              SessionStart SessionEnd UserPromptSubmit
#              BeforeReadFile AfterFileEdit
#              BeforeShellExecution AfterShellExecution Stop
```

---

## Checklist before installing

- [ ] `plugin.json` has `name`, `version`, `description`
- [ ] Hook script reads `stdin` fully as first action (`payload=$(cat …)`)
- [ ] Hook script guards every external dependency with `command -v … || exit 0`
- [ ] Blocking hooks (PreToolUse, Stop) complete in < 5 seconds normally
- [ ] Fire-and-forget hooks exit 0; they never use the block protocol
- [ ] Scripts are executable (`chmod +x scripts/*.sh`)
- [ ] `hooks.json` event names match the enum exactly (case-sensitive)
- [ ] Smoke test passes with `PLUGIN_ROOT=$(pwd) bash scripts/<script>.sh < payload.json`
- [ ] Plugin is installed at `~/.agents/plugins/<name>/` or `<project>/.agents/plugins/<name>/`
- [ ] If the plugin contributes an MCP server needed in a recipe session, the
      MCP server is declared explicitly in the recipe's `extensions:` block
- [ ] No `plugins:` key added to any recipe YAML (silently ignored)

---

## Common mistakes

| Mistake | Effect | Correct approach |
|---|---|---|
| Adding `plugins:` to recipe YAML | Silently ignored — `Recipe` struct has no such field | Rely on filesystem auto-discovery |
| Expecting plugin MCP server in recipe session without explicit declaration | Suppressed by `recipe_extensions.is_none()` guard | Declare MCP server in recipe `extensions:` |
| Blocking hook that calls a slow external service | Session hangs up to timeout (30 s) | Move slow I/O to PostToolUse (fire-and-forget) |
| Hook exits non-zero (not 2) for a non-block reason | Goose logs a warning; operation proceeds | Exit 0 on success; exit 2 only to deny |
| Not reading stdin | Potential broken pipe signal | Always `payload=$(cat 2>/dev/null || printf '{}')` |
| Using PreToolUse for observation/telemetry | Adds latency to every single tool call | Use PostToolUse for observation |
| Shared mutable state between concurrent sessions | Race conditions on multi-session runs | Use atomic file writes or SQLite with WAL |
| Calling `bd`, `jq`, or any tool without a guard | Hook crashes if tool is absent | `command -v tool >/dev/null 2>&1 || exit 0` |
| Misspelling an event name in hooks.json | Rule silently ignored at load time | Validate with `jq -r '.hooks|keys[]' hooks/hooks.json` |
