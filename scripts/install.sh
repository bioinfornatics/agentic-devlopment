#!/usr/bin/env bash
# Install the Agentic Development Harness into the current user's Goose config.
# Bash 4 compatible.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/install.sh [options]

Install project-local harness files into:
  ~/.config/goose/recipes
  ~/.agents/skills
  ~/.agents/agents

The installer also adds/upserts harness slash commands in:
  ~/.config/goose/config.yaml

Options:
  --dry-run              Print actions without copying files
  --no-backup            Do not backup existing target directories/config
  --skip-validate        Skip goose recipe validation after copy
  --skip-slash-commands  Do not update slash_commands in config.yaml
  -h, --help             Show this help

Examples:
  ./scripts/install.sh
  ./scripts/install.sh --dry-run
  ./scripts/install.sh --no-backup
USAGE
}

DRY_RUN=0
BACKUP=1
VALIDATE=1
SLASH_COMMANDS=1

while (( $# > 0 )); do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-backup) BACKUP=0 ;;
    --skip-validate) VALIDATE=0 ;;
    --skip-slash-commands) SLASH_COMMANDS=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

script_path="${BASH_SOURCE[0]}"
while [[ -L "$script_path" ]]; do
  script_dir="$(cd -P "$(dirname "$script_path")" >/dev/null 2>&1 && pwd)"
  link_target="$(readlink "$script_path")"
  if [[ "$link_target" == /* ]]; then
    script_path="$link_target"
  else
    script_path="$script_dir/$link_target"
  fi
done
SCRIPT_DIR="$(cd -P "$(dirname "$script_path")" >/dev/null 2>&1 && pwd)"
ROOT="$(cd -P "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

SRC_RECIPES="$ROOT/.goose/recipes"
SRC_SKILLS="$ROOT/.agents/skills"
SRC_AGENTS="$ROOT/.agents/agents"
DST_RECIPES="$HOME/.config/goose/recipes"
DST_SKILLS="$HOME/.agents/skills"
DST_AGENTS="$HOME/.agents/agents"
GOOSE_CONFIG="$HOME/.config/goose/config.yaml"
STAMP="$(date +%Y%m%d-%H%M%S)"

require_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo "error: required source directory not found: $dir" >&2
    exit 1
  fi
}

run() {
  if (( DRY_RUN )); then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

backup_or_remove_dir() {
  local path="$1"
  if [[ -e "$path" ]] && (( BACKUP )); then
    run mv "$path" "$path.backup-$STAMP"
  elif [[ -e "$path" ]]; then
    run rm -rf "$path"
  fi
}

copy_dir() {
  local src="$1"
  local dst="$2"
  local parent
  parent="$(dirname "$dst")"
  run mkdir -p "$parent"
  backup_or_remove_dir "$dst"
  run cp -a "$src" "$dst"
}

update_slash_commands() {
  if (( ! SLASH_COMMANDS )); then
    echo "Skipping slash command update."
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "warning: python3 not found; cannot update slash_commands automatically" >&2
    return 0
  fi

  python3 - "$GOOSE_CONFIG" "$DST_RECIPES" "$BACKUP" "$DRY_RUN" "$STAMP" <<'PY'
from pathlib import Path
import re, shutil, sys

config = Path(sys.argv[1])
recipe_dir = Path(sys.argv[2])
backup_enabled = sys.argv[3] == "1"
dry_run = sys.argv[4] == "1"
stamp = sys.argv[5]

managed = [
    ("dev", "dev.yaml"),
    ("discover", "discover.yaml"),
    ("spec", "spec.yaml"),
    ("explore", "explore.yaml"),
    ("plan", "plan.yaml"),
    ("implement", "implement.yaml"),
    ("review", "review.yaml"),
    ("verify", "verify.yaml"),
    ("release", "release.yaml"),
    ("remember", "remember.yaml"),
    ("sdd", "sdd.yaml"),
    ("design", "design.yaml"),
]
managed_names = {name.lower() for name, _ in managed}

missing = [str(recipe_dir / file) for _, file in managed if not (recipe_dir / file).is_file()]
if missing:
    print("warning: cannot add slash commands; missing installed recipes:", file=sys.stderr)
    for path in missing:
        print(f"  {path}", file=sys.stderr)
    sys.exit(0)

new_entries = []
for name, file in managed:
    new_entries.extend([
        f'  - command: "{name}"\n',
        f'    recipe_path: "{recipe_dir / file}"\n',
    ])

def item_command(chunk):
    for line in chunk:
        m = re.search(r'^\s*command:\s*["\']?([^"\'\s#]+)', line)
        if m:
            return m.group(1).lower()
    return None

def split_items(block_body):
    prefix = []
    chunks = []
    current = None
    for line in block_body:
        if re.match(r'^\s*-\s+', line):
            if current is not None:
                chunks.append(current)
            current = [line]
        elif current is None:
            prefix.append(line)
        else:
            current.append(line)
    if current is not None:
        chunks.append(current)
    return prefix, chunks

if config.exists():
    lines = config.read_text().splitlines(keepends=True)
else:
    lines = []

start = None
for i, line in enumerate(lines):
    if re.match(r'^slash_commands:\s*(#.*)?$', line):
        start = i
        break

if start is None:
    replacement = []
    if lines and lines[-1].strip():
        replacement.append('\n')
    replacement.append('slash_commands:\n')
    replacement.extend(new_entries)
    out = lines + replacement
else:
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r'^[A-Za-z0-9_][^:]*:\s*(#.*)?$', lines[j]):
            end = j
            break
    body = lines[start + 1:end]
    _prefix, chunks = split_items(body)
    kept_chunks = []
    for chunk in chunks:
        cmd = item_command(chunk)
        if cmd in managed_names or cmd is None:
            continue
        for line in chunk:
            stripped = line.lstrip()
            if stripped.startswith('- '):
                kept_chunks.append('  ' + stripped)
            else:
                kept_chunks.append('    ' + stripped)
    replacement = ['slash_commands:\n']
    replacement.extend(kept_chunks)
    replacement.extend(new_entries)
    out = lines[:start] + replacement + lines[end:]

if dry_run:
    print("[dry-run] upsert slash_commands:")
    for name, file in managed:
        print(f"  /{name} -> {recipe_dir / file}")
    sys.exit(0)

config.parent.mkdir(parents=True, exist_ok=True)
if config.exists() and backup_enabled:
    shutil.copy2(config, config.with_name(f"config.yaml.backup-{stamp}"))
config.write_text(''.join(out))
print("Updated slash_commands in", config)
for name, file in managed:
    print(f"  /{name} -> {recipe_dir / file}")
PY
}

require_dir "$SRC_RECIPES"
require_dir "$SRC_SKILLS"
require_dir "$SRC_AGENTS"

cat <<INFO
Installing Agentic Development Harness
  source:      $ROOT
  recipes ->   $DST_RECIPES
  skills  ->   $DST_SKILLS
  agents  ->   $DST_AGENTS
  config  ->   $GOOSE_CONFIG
  backup:      $BACKUP
  dry-run:     $DRY_RUN
INFO

copy_dir "$SRC_RECIPES" "$DST_RECIPES"
copy_dir "$SRC_SKILLS" "$DST_SKILLS"
copy_dir "$SRC_AGENTS" "$DST_AGENTS"
update_slash_commands

if (( VALIDATE )); then
  if command -v goose >/dev/null 2>&1; then
    echo "Validating installed recipes..."
    if (( DRY_RUN )); then
      echo "[dry-run] skip validation"
    else
      find "$DST_RECIPES" -name '*.yaml' -print -exec goose recipe validate {} \;
      echo "Installed skills visible to Goose:"
      goose skills list || true
    fi
  else
    echo "warning: goose not found on PATH; skipping validation" >&2
  fi
fi

echo "Install complete. Try: goose session, then /harness <task>"