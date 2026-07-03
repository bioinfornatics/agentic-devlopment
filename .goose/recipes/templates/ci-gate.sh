#!/usr/bin/env bash
set -euo pipefail
# Generic local gate used by harness recipes when a project has no better command.
if [ -f Makefile ] && grep -qE '(^|[[:space:]])test:' Makefile; then
  make test
elif [ -f package.json ]; then
  npm test
elif [ -f Cargo.toml ]; then
  cargo test
elif [ -f go.mod ]; then
  go test ./...
else
  echo "No standard test gate detected; run project-specific validation." >&2
fi
