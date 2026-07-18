#!/usr/bin/env bash
# install-git-hooks.sh — Install git pre-commit hook from the harness plugin.
# Run once after cloning or updating this repository:
#   ./scripts/install-git-hooks.sh
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_SRC="${REPO_ROOT}/.agents/plugins/harness-consistency/scripts/pre-commit.sh"
HOOK_DEST="${REPO_ROOT}/.git/hooks/pre-commit"

cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"
echo "✓ Pre-commit hook installed: ${HOOK_DEST}"
echo "  Source: ${HOOK_SRC}"

