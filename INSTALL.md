# Install the Agentic Development Harness
See the [Harness operator HOWTO](HOWTO.md) for reproducible operating commands.

This guide installs the Goose + Beads harness from this repository into your local Goose configuration.

For the full build/test sequence and a disposable HOME smoke installation, see [HOWTO.md](HOWTO.md).

## Prerequisites

Required:

- `goose` CLI available on PATH
- Node.js 22 (workspace requires >=22 <23)
- `just` for build orchestration

Recommended:

- `bd` / Beads for durable task tracking
- `pnpm` for dependency management (pinned in workspace)

## Quick install

From the repository root:

```bash
# Bootstrap runtime from source
just bootstrap-runtime
just verify-runtime

# Install into user Goose config (~/.agents + ~/.config/goose)
just install-release
```

The installer:
- extracts internal skills, agents, and recipes
- resolves pinned external skills with integrity verification
- upserts slash commands in `~/.config/goose/config.yaml`
- validates all recipes with `goose recipe validate`

## Install options

```bash
# Preview only (no files written)
just INSTALL_FLAGS='--dry-run' install-release

# Skip recipe validation (faster)
just INSTALL_FLAGS='--skip-validate' install-release

# Preserve existing targets without backup
just INSTALL_FLAGS='--no-backup' install-release

# Skip slash command configuration
just INSTALL_FLAGS='--skip-slash-commands' install-release
```

## Release-based install

Build and install a reproducible release archive in one command:

```bash
just VERSION=1.0.0 release-pipeline
just install-release
```

Or assemble, verify, then install separately:

```bash
just VERSION=1.0.0 release-local
just verify-release
just install-release
```

## Validate

```bash
# Validate all recipes
find src/recipes -name '*.yaml' -print -exec goose recipe validate {} \;

# Check skills
goose skills list

# Check recipes
goose recipe list

# Verify runtime integrity
just verify-runtime
```

## Update after source changes

After editing assets in `src/`, rebootstrap and reinstall:

```bash
just bootstrap-runtime
just install-release
```

## Uninstall

```bash
node src/app/tooling/dist/install-harness-release.js uninstall --prefix ~/.config
```

Or remove installed targets manually and restore backups if you created any.

## Next steps

See [docs/START-HERE.md](docs/START-HERE.md) to learn which slash commands to use and when.
