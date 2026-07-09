# @harness/kg-visualizer-app — Goose App HTML

Standalone HTML for the Goose `apps` builtin extension.
Distinct from `@harness/kg-visualizer` (MCP server) — this is just the HTML artifact.

## Usage

In a Goose session with `apps` extension enabled:
```
Show me the knowledge graph app
```

Or via the `create_app` tool using the HTML in `app.html` as the PRD.

## How it works

Goose `apps` extension stores the HTML in `~/.local/share/goose/apps/kg-visualizer.html`
and renders it in a native sandboxed window.

The visualizer loads data via:
1. `window.GOOSE_KG_DATA` if injected by the Goose App context
2. Drag & drop of `.knowledge/memory.jsonl`
3. The `show_kg_visualizer` MCP tool from `@harness/kg-visualizer`
