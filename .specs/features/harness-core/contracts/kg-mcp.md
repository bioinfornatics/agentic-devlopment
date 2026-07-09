# Contract - @harness/kg-visualizer MCP

Type: MCP stdio | Implementation: apps/kg-visualizer/dist/server.js

## Tool: show_kg_visualizer

Input:  filter optional string (entityType to show)
Output: { content: [{ type: resource, resource: { uri: kg://visualizer, mimeType: text/html, text: HTML }}]}

## Visual Contract

Nodes by entityType:
  harness:recipe -> blue #4299e1
  harness:skill  -> violet #9f7aea
  harness:agent  -> green #48bb78
  feature        -> red #fc8181
  derived_status -> red solid #e53e3e

Edges:
  asserté  -> solid gray
  inféré   -> dashed orange

Data: memory.jsonl + derived.jsonl embedded as base64 in HTML.
