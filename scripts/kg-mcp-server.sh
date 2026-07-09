#!/usr/bin/env bash
# KG MCP wrapper — localise memory.jsonl dans le projet le plus proche
DIR="$(pwd)"
while [[ "$DIR" != "/" ]]; do
  if [[ -d "$DIR/.knowledge" ]]; then
    export MEMORY_FILE_PATH="$DIR/.knowledge/memory.jsonl"
    break
  fi
  DIR="$(dirname "$DIR")"
done
if [[ -z "$MEMORY_FILE_PATH" ]]; then
  mkdir -p .knowledge
  export MEMORY_FILE_PATH="$(pwd)/.knowledge/memory.jsonl"
fi
exec npx -y @modelcontextprotocol/server-memory
