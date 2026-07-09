# Install the Agentic Development Harness

This guide installs the portable Goose + Beads harness from this repository into your local Goose configuration.

## Prerequisites

Required:

- `goose` CLI available on `PATH`
- `bd` / Beads available in repositories where you want durable task tracking
- `uvx` available if you use the Beads MCP extension through recipes

Recommended:

- Node/npm for Playwright MCP workflows
- Git for project work

Check:

```bash
goose --version
bd --version
uvx --version
```

## Install

From this repository root:

```bash
cd ~/Codes/agentic-devlopment
```

### Option A: install script

Linux/macOS/Git Bash:

```bash
./scripts/install.sh
```

PowerShell:

```powershell
./scripts/install.ps1
```

Useful flags:

```bash
./scripts/install.sh --dry-run
./scripts/install.sh --no-backup
./scripts/install.sh --skip-validate
./scripts/install.sh --skip-slash-commands
```

```powershell
./scripts/install.ps1 -DryRun
./scripts/install.ps1 -NoBackup
./scripts/install.ps1 -SkipValidate
./scripts/install.ps1 -SkipSlashCommands
```

#### Slash command installation

By default, the installer upserts these slash commands in `~/.config/goose/config.yaml`:

```text
/harness /research /plan /implement /review /webtest /release /memory /sdd /uiux
```

The update is idempotent: existing entries for those command names are replaced, not duplicated. Other user-defined slash commands are preserved. Use `--skip-slash-commands` or `-SkipSlashCommands` to opt out.

### Option B: manual install

```bash
mkdir -p ~/.config/goose ~/.agents

rm -rf ~/.config/goose/recipes
rm -rf ~/.agents/skills
rm -rf ~/.agents/agents

cp -a .goose/recipes ~/.config/goose/recipes
cp -a .agents/skills ~/.agents/skills
cp -a .agents/agents ~/.agents/agents
```

### Option C: manual install with backups

```bash
stamp=$(date +%Y%m%d-%H%M%S)

[ -d ~/.config/goose/recipes ] && mv ~/.config/goose/recipes ~/.config/goose/recipes.backup-$stamp
[ -d ~/.agents/skills ] && mv ~/.agents/skills ~/.agents/skills.backup-$stamp
[ -d ~/.agents/agents ] && mv ~/.agents/agents ~/.agents/agents.backup-$stamp

mkdir -p ~/.config/goose ~/.agents
cp -a .goose/recipes ~/.config/goose/recipes
cp -a .agents/skills ~/.agents/skills
cp -a .agents/agents ~/.agents/agents
```

## Validate

Validate all recipes:

```bash
find ~/.config/goose/recipes -name '*.yaml' -print -exec goose recipe validate {} \;
```

Check that skills are visible:

```bash
goose skills list
```

Expected custom skills include:

```text
agentic-dev-harness
beads-harness
goose-orchestration
sdd
code-review
ux-quality
webapp-testing
```

Check that recipes are visible:

```bash
goose recipe list --verbose
```

Expected recipes include:

```text
harness-master
harness-research
harness-plan
harness-implement
harness-review
harness-web-test
harness-release
sdd-master
ui-ux-suite
```

## Configure Goose extensions

The recipes explicitly request core platform extensions:

- `developer`
- `analyze`
- `summon`
- `skills`

Some workflows also request:

- Beads MCP via `uvx beads-mcp`
- Playwright MCP via `npx @playwright/mcp@latest`

You can inspect and toggle global extensions with:

```bash
goose configure
```

## Smoke tests

Render without running:

```bash
goose run --recipe harness-master \
  --params task="smoke test" \
  --render-recipe
```

Run a read-only review in a repository:

```bash
cd /path/to/repo

goose run --recipe harness-review \
  --params task="review current diff" \
  --params repo_path="$PWD" \
  --params constraints="Read-only smoke test. Do not modify files."
```

## Use in a Beads repository

In a Beads-enabled repo:

```bash
bd prime
bd ready --json

goose run --recipe harness-master \
  --params task="work on the next ready bead" \
  --params repo_path="$PWD"
```

## Update this harness

After editing files in this repository, reinstall by copying again:

```bash
cp -a .goose/recipes ~/.config/goose/recipes
cp -a .agents/skills ~/.agents/skills
cp -a .agents/agents ~/.agents/agents
```

Then validate:

```bash
find ~/.config/goose/recipes -name '*.yaml' -print -exec goose recipe validate {} \;
goose skills list
```

## Build docs

Install Pandoc, then build the documentation bundle:

```bash
# Fedora example
sudo dnf install pandoc texlive-xetex

./scripts/build-docs.sh
```

Generated files:

```text
dist/docs/html/agentic-development-harness.html
dist/docs/pdf/agentic-development-harness.pdf
```

## Uninstall

Remove installed harness files:

```bash
rm -rf ~/.config/goose/recipes
rm -rf ~/.agents/skills
rm -rf ~/.agents/agents
```

Then restore any backup if you created one:

```bash
mv ~/.config/goose/recipes.backup-YYYYMMDD-HHMMSS ~/.config/goose/recipes
mv ~/.agents/skills.backup-YYYYMMDD-HHMMSS ~/.agents/skills
mv ~/.agents/agents.backup-YYYYMMDD-HHMMSS ~/.agents/agents
```

---

## Next step

See [docs/getting-started.md](docs/getting-started.md) to learn which slash commands to use and when.
