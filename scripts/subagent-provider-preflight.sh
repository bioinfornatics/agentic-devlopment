#!/usr/bin/env bash
set -euo pipefail
exec python3 scripts/subagent-provider-preflight.py "$@"
