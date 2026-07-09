# AGENTS.md — apps/kg-visualizer-app/

> Overrides root AGENTS.md. This is a static HTML artifact, no build step.

## Purpose

HTML file for the Goose `apps` builtin extension.
**Not** the MCP server (`apps/kg-visualizer/` handles that).

## Files

```
app.html     # Cytoscape.js+fcose KG visualizer
             # Placeholders: window.GOOSE_KG_DATA injection point
```

## Register as Goose App

```
# In a Goose session with apps extension enabled:
Create a goose app called "kg-visualizer" using the HTML in apps/kg-visualizer-app/app.html
```

## Sync from MCP server

The `app.html` here is kept in sync with:
  `apps/kg-visualizer/src/app.html` (MCP server template)

Run `cp apps/kg-visualizer/src/app.html apps/kg-visualizer-app/app.html` after changes.
