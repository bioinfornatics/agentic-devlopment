#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "error: pandoc is required" >&2
  echo "Fedora: sudo dnf install pandoc texlive-xetex" >&2
  exit 127
fi

mkdir -p dist

DOCS=(
  README.md
  INSTALL.md
  USE_CASES.md
  docs/00-index.md
  docs/01-init-project.md
  docs/02-code-review.md
  docs/03-security-review.md
  docs/04-uxr-simulation.md
  docs/05-ui-review.md
  docs/06-test-review.md
  docs/07-spec-review.md
  docs/08-project-judge-score.md
  docs/09-implementation-loop.md
  docs/10-release-readiness.md
  docs/11-incident-sre.md
  docs/12-multi-agent-research.md
  docs/13-documentation-review.md
  docs/14-memory.md
  AGENTS.md
)

pandoc "${DOCS[@]}" \
  --from gfm \
  --toc \
  --standalone \
  --metadata title="Agentic Development Harness" \
  -o dist/agentic-development-harness.html

if command -v xelatex >/dev/null 2>&1; then
  pandoc "${DOCS[@]}" \
    --from gfm \
    --toc \
    --number-sections \
    --pdf-engine=xelatex \
    --metadata title="Agentic Development Harness" \
    -o dist/agentic-development-harness.pdf
  echo "wrote dist/agentic-development-harness.pdf"
elif command -v chromium >/dev/null 2>&1; then
  chromium --headless --disable-gpu \
    --print-to-pdf="$ROOT/dist/agentic-development-harness.pdf" \
    "file://$ROOT/dist/agentic-development-harness.html" >/dev/null 2>&1 || true
  if [ -f dist/agentic-development-harness.pdf ]; then
    echo "wrote dist/agentic-development-harness.pdf"
  else
    echo "warning: PDF generation via chromium failed; HTML was generated" >&2
  fi
else
  echo "warning: xelatex/chromium not found; generated HTML only" >&2
  echo "Fedora PDF option: sudo dnf install texlive-xetex" >&2
fi

echo "wrote dist/agentic-development-harness.html"
