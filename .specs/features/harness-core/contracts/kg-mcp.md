# Contract - @harness/kg-visualizer MCP

Type: MCP stdio | Implementation: apps/kg-visualizer/dist/server.js

## Tool: show_kg_visualizer

Input:  filter optional string (entityType to show)
Output: { content: [{ type: resource, resource: { uri: kg://visualizer, mimeType: text/html, text: HTML }}]}

## Visual Contract

Nodes by entityType (background-color):
  harness:recipe       -> blue   #4299e1
  harness:skill        -> violet #9f7aea
  harness:agent        -> green  #48bb78
  harness:doc          -> gray   #718096
  epic                 -> orange #f6ad55
  feature              -> red    #fc8181
  acceptance_criterion -> green  #68d391
  test                 -> teal   #4fd1c5
  code_file            -> purple #b794f4
  derived_status       -> red    #e53e3e
  (any other)          -> gray   #a0aec0

Border:
  derived nodes  -> dashed orange border (#f6ad55, width 2)
  asserted nodes -> no border

Edges:
  asserté (derived: false) -> solid dark-gray #4a5568
  inféré  (derived: true)  -> dashed orange   #f6ad55

Data: memory.jsonl + derived.jsonl embedded as base64 in HTML.
