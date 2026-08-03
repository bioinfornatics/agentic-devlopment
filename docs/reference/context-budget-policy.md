# Harness context budget policy

Budgets are enforced by the TypeScript consistency checker: skill body warn above 500 and fail above 700 lines; agent file warn above 400 and fail above 500 lines. Recipes and agents load the minimum required skill set first; optional reference or deep-dive skills are loaded only when task evidence triggers them.

UI/UX triggers: accessibility or WCAG uses wcag-accessibility-audit; component taxonomy or tokens uses atomic-design and design-systems-arch; product psychology uses cognitive-ux and ux-quality; implementation handoff uses frontend-blueprint and webapp-testing; visual QA uses ui-quality.

---

## Platform constraints (source-verified 2026-08)

The following constraints are structural limits of the Goose runtime, not
configuration gaps. They cannot be remediated within the harness source.

### FND-003 — No token-budget field in Recipe struct

The `Recipe` struct (`crates/goose/src/recipe/mod.rs`) has no token-count
or cost-budget field. The only mechanical execution controls available in
a recipe are:

| Field | Where | Purpose |
|---|---|---|
| `settings.max_turns` | recipe YAML | Hard ceiling on agent turns |
| `session.max_tool_repetitions` | recipe YAML | Max consecutive identical tool+args calls |
| `retry.max_retries` | recipe YAML | Max recipe-level retry cycles |

All four harness recipes already set these fields:

| Recipe | max_turns | max_tool_repetitions | max_retries |
|---|---|---|---|
| loop-engineering | 80 | 5 | 3 |
| implement | 35 | 5 | 3 |
| research | 25 | 5 | 3 |
| verify | 25 | 5 | 2 |

Token-level budgeting requires either a platform feature not yet in the
`Recipe` struct, or a counting hook. A PostToolUse hook that counts calls and
writes to Beads is the only available mechanical alternative today.

### FND-006 — Recipe `extensions:` field suppresses plugin MCP servers

When a recipe declares `extensions:`, Goose skips the auto-discovery of
plugin-contributed MCP servers (`session/builder.rs:441`):

```rust
if !session_config.no_profile && !session_config.resume && recipe_extensions.is_none() {
    all.extend(goose::plugins::mcp_servers::enabled_plugin_mcp_servers(…));
}
```

All four harness recipes declare `extensions:`. Consequence: if any plugin
contributes an MCP server (via `.mcp.json` or manifest inline config), it
will not be loaded in recipe sessions. **No current harness plugin has an MCP
server**, so this constraint has no immediate functional impact.

If a future plugin needs to contribute MCP tools to a recipe session, declare
the MCP server explicitly in the recipe's `extensions:` block. The plugin's
hooks are not affected — they are loaded independently at agent construction.
