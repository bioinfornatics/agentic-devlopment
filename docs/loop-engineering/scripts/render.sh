#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_DIR="$ROOT_DIR/diagrams"
OUTPUT_DIR="$ROOT_DIR/generated"

mkdir -p "$OUTPUT_DIR"

if command -v plantuml >/dev/null 2>&1; then
  plantuml -charset UTF-8 -tsvg -o ../generated "$SOURCE_DIR"/*.puml
  exit 0
fi

if command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
elif command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
else
  echo "Erreur: PlantUML, Podman ou Docker est requis." >&2
  exit 1
fi

"$RUNTIME" run --rm \
  -v "$ROOT_DIR:/workspace:Z" \
  -w /workspace \
  plantuml/plantuml:latest \
  -charset UTF-8 -tsvg -o ../generated diagrams/*.puml
