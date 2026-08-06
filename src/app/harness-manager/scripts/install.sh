#!/usr/bin/env bash
# Install the Agentic Development Harness into the current user's Goose config.
# Bash 4 compatible.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./src/tooling/bin/install [options]

Install project-local harness files into:
  ~/.config/goose/recipes
  ~/.agents/skills
  ~/.agents/agents
  ~/.agents/plugins

The installer also adds/upserts harness slash commands in:
  ~/.config/goose/config.yaml

Modes:
  Default:    Install from bootstrap staging (build/harness/runtime/current)
  --bundle:   Install from a release archive directory (dist/releases)

Options:
  --bundle DIR       Install from release archive in DIR instead of bootstrap staging
                     DIR must contain SHA256SUMS and a .tar file
  --dry-run              Print actions without copying files
  --no-backup            Do not backup existing target directories/config
  --skip-validate        Skip goose recipe validation after copy
  --skip-slash-commands  Do not update slash_commands in config.yaml
  -h, --help             Show this help

Examples:
  ./src/tooling/bin/install                         # from bootstrap staging
  ./src/tooling/bin/install --bundle dist/releases   # from release archive
  ./src/tooling/bin/install --bundle dist/releases --dry-run
USAGE
}

DRY_RUN=0
BACKUP=1
VALIDATE=1
SLASH_COMMANDS=1
BUNDLE=""

while (( $# > 0 )); do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-backup) BACKUP=0 ;;
    --skip-validate) VALIDATE=0 ;;
    --skip-slash-commands) SLASH_COMMANDS=0 ;;
    --bundle)
      if [[ -z "${2:-}" ]]; then echo "error: --bundle requires a directory argument" >&2; exit 2; fi
      BUNDLE="$2"; shift ;;
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
ROOT="${HARNESS_REPOSITORY_ROOT:-$(cd -P "$SCRIPT_DIR/../../.." >/dev/null 2>&1 && pwd)}"

# ── Resolve runtime source ────────────────────────────────────────

if [[ -n "$BUNDLE" ]]; then
  # Install from release archive: extract to temp, copy files to user config.
  if [[ ! -d "$BUNDLE" ]]; then
    echo "error: bundle directory not found: $BUNDLE" >&2; exit 1
  fi
  if [[ ! -f "$BUNDLE/SHA256SUMS" ]]; then
    echo "error: no SHA256SUMS in $BUNDLE; run just VERSION=x.y.z release-local first" >&2; exit 1
  fi

  # Verify archive checksum before extracting
  archive_name=$(awk '{print $2}' "$BUNDLE/SHA256SUMS")
  expected=$(awk '{print $1}' "$BUNDLE/SHA256SUMS")
  if [[ -z "$archive_name" ]]; then echo "error: malformed SHA256SUMS" >&2; exit 1; fi
  actual=$(sha256sum "$BUNDLE/$archive_name" | awk '{print $1}')
  if [[ "$actual" != "$expected" ]]; then
    echo "error: archive checksum mismatch (expected $expected)" >&2; exit 1
  fi

  echo "Verified $archive_name checksum OK"

  # Extract to disposable temp directory
  INSTALL_TMP=$(mktemp -d)
  trap 'rm -rf "$INSTALL_TMP"' EXIT
  tar -xf "$BUNDLE/$archive_name" -C "$INSTALL_TMP"

  RUNTIME_ROOT="$INSTALL_TMP"
else
  RUNTIME_ROOT="${HARNESS_RUNTIME_ROOT:-$ROOT/build/harness/runtime/current}"
fi

# ── Target paths ──────────────────────────────────────────────────

SRC_RECIPES="$RUNTIME_ROOT/.goose/recipes"
SRC_SKILLS="$RUNTIME_ROOT/.agents/skills"
SRC_AGENTS="$RUNTIME_ROOT/.agents/agents"
GOOSE_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/goose"
DST_RECIPES="$GOOSE_CONFIG_HOME/recipes"
DST_SKILLS="$HOME/.agents/skills"
DST_AGENTS="$HOME/.agents/agents"
GOOSE_CONFIG="$GOOSE_CONFIG_HOME/config.yaml"
STAMP="$(date +%Y%m%d-%H%M%S)"

# ── Helpers ───────────────────────────────────────────────────────

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
  if (( ! SLASH_COMMANDS )); then echo "Skipping slash command update."; return 0; fi
  local scan_recipes="$DST_RECIPES"
  (( DRY_RUN )) && scan_recipes="$SRC_RECIPES"
  node "$ROOT/src/app/harness-manager/dist/install-support.js" update-slash-commands "$GOOSE_CONFIG" "$scan_recipes" "$DST_RECIPES" "$BACKUP" "$DRY_RUN" "$STAMP"
}

# Copy project skills into $DST_SKILLS while preserving any external skills
# installed alongside them (third-party skills not tracked in this repo).
# A plain copy_dir would wipe untracked skills on every install.
merge_skills_dir() {
  local src="$1"
  local dst="$2"
  local stamp_backup="$dst.backup-$STAMP"

  # Collect the names of project-owned skills (subdirs in source).
  local src_names=()
  for d in "$src"/*/; do
    [[ -d "$d" ]] && src_names+=("$(basename "$d")")
  done

  # Back up or remove the existing destination.
  if [[ -e "$dst" ]] && (( BACKUP )); then
    run mv "$dst" "$stamp_backup"
  elif [[ -e "$dst" ]]; then
    run rm -rf "$dst"
  fi

  # Install project skills fresh. The parent may not exist in a new HOME.
  run mkdir -p "$(dirname "$dst")"
  run cp -a "$src" "$dst"

  # Restore every sub-directory from the backup that is NOT a project skill.
  # In dry-run mode the backup was never created, so scan the live dst instead.
  local scan_dir="$stamp_backup"
  (( DRY_RUN )) && scan_dir="$dst"
  if [[ -d "$scan_dir" ]]; then
    for external in "$scan_dir"/*/; do
      [[ -d "$external" ]] || continue
      local name; name="$(basename "$external")"
      local is_project=0
      for proj in "${src_names[@]}"; do
        [[ "$proj" == "$name" ]] && is_project=1 && break
      done
      if (( ! is_project )); then
        echo "Preserving external skill: $name"
        run cp -a "$external" "$dst/$name"
      fi
    done
  fi
}

# ── Validate source dirs exist ────────────────────────────────────

require_dir "$SRC_RECIPES"
require_dir "$SRC_SKILLS"
require_dir "$SRC_AGENTS"

# ── Display install plan ─────────────────────────────────────────

cat <<INFO
Installing Agentic Development Harness
  source:      $ROOT
  runtime:     $RUNTIME_ROOT
  recipes ->   $DST_RECIPES
  skills  ->   $DST_SKILLS
  agents  ->   $DST_AGENTS
  config  ->   $GOOSE_CONFIG
  backup:      $BACKUP
  dry-run:     $DRY_RUN
INFO

# ── Copy files ────────────────────────────────────────────────────

copy_dir "$SRC_RECIPES" "$DST_RECIPES"
merge_skills_dir "$SRC_SKILLS" "$DST_SKILLS"
copy_dir "$SRC_AGENTS" "$DST_AGENTS"
update_slash_commands

# ── Validate ──────────────────────────────────────────────────────

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

# ── Install plugins ──────────────────────────────────────────────

SRC_PLUGINS="$RUNTIME_ROOT/.agents/plugins"
DST_PLUGINS="$HOME/.agents/plugins"
if [[ -d "$SRC_PLUGINS" ]]; then
  # Plugins come from the verified projection; installation never rebuilds them.

  for plugin_dir in "$SRC_PLUGINS"/*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_name="$(basename "$plugin_dir")"
    run mkdir -p "$DST_PLUGINS"
    backup_or_remove_dir "$DST_PLUGINS/$plugin_name"
    run cp -a "$plugin_dir" "$DST_PLUGINS/$plugin_name"
    # Make hook scripts executable
    find "$DST_PLUGINS/$plugin_name/scripts" -name '*.sh' -exec chmod +x {} \; 2>/dev/null || true
    echo "Installed plugin: $plugin_name → $DST_PLUGINS/$plugin_name"
  done
fi

echo "Install complete. Try: goose recipe run loop-engineering"
