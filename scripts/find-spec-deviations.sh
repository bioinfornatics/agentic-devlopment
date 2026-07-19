#!/usr/bin/env bash
set -euo pipefail
exec python3 scripts/find-spec-deviations.py "$@"
