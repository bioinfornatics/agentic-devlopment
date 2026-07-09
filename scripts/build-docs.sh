#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "error: pandoc is required" >&2
  echo "Fedora: sudo dnf install pandoc texlive-xetex" >&2
  exit 127
fi

DIST_DIR="dist"
DOCS_DIST_DIR="$DIST_DIR/docs"
HTML_DIR="$DOCS_DIST_DIR/html"
PDF_DIR="$DOCS_DIST_DIR/pdf"
ASSETS_DIR="$HTML_DIR/assets"
HTML_OUT="$HTML_DIR/agentic-development-harness.html"
HTML_INDEX="$HTML_DIR/index.html"
PDF_OUT="$PDF_DIR/agentic-development-harness.pdf"

mkdir -p "$ASSETS_DIR" "$PDF_DIR"

# Remove legacy generated documentation paths so dist/ has one clear docs layout.
rm -f \
  "$DIST_DIR/agentic-development-harness.html" \
  "$DIST_DIR/agentic-development-harness.pdf" \
  "$DIST_DIR/index.html"
rm -rf "$DIST_DIR/assets"

cp docs/assets/site.css "$ASSETS_DIR/site.css"

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
  docs/15-skill-evaluations.md
  AGENTS.md
)

pandoc "${DOCS[@]}" \
  --from gfm \
  --toc \
  --toc-depth=2 \
  --standalone \
  --metadata title="Agentic Development Harness" \
  --metadata lang=fr \
  --css assets/site.css \
  -o "$HTML_OUT"

# WCAG: wrap body content in <main> landmark + fix lang attr
python3 scripts/wcag-postprocess.py "$HTML_OUT"

cp "$HTML_OUT" "$HTML_INDEX"

if command -v xelatex >/dev/null 2>&1; then
  pandoc "${DOCS[@]}" \
    --from gfm \
    --toc \
    --number-sections \
    --pdf-engine=xelatex \
    --metadata title="Agentic Development Harness" \
    -o "$PDF_OUT"
  echo "wrote $PDF_OUT"
elif command -v chromium >/dev/null 2>&1; then
  chromium --headless --disable-gpu \
    --print-to-pdf="$ROOT/$PDF_OUT" \
    "file://$ROOT/$HTML_OUT" >/dev/null 2>&1 || true
  if [ -f "$PDF_OUT" ]; then
    echo "wrote $PDF_OUT"
  else
    echo "warning: PDF generation via chromium failed; HTML was generated" >&2
  fi
else
  echo "warning: xelatex/chromium not found; generated HTML only" >&2
  echo "Fedora PDF option: sudo dnf install texlive-xetex" >&2
fi

echo "wrote $HTML_OUT"

# KG visualizer
mkdir -p dist/kg
cp scripts/kg-visualizer.html dist/kg/index.html
echo "wrote dist/kg/index.html"

# KG pipeline — refresh + reason
if [ -f "scripts/kg-bootstrap.py" ] && [ -d ".knowledge" ]; then
  python3 scripts/kg-bootstrap.py > /dev/null 2>&1 && echo "KG bootstrapped"
  python3 scripts/kg-reason.py > /dev/null 2>&1 && echo "KG reasoned"
fi
echo "wrote $HTML_INDEX"

# Build eval trend dashboard (reads evals/history/runs.json — no API calls)
if command -v python3 >/dev/null 2>&1; then
  python3 "$(dirname "$0")/build-eval-report.py" && true
fi