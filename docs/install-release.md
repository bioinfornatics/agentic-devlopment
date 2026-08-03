## 3.4 Installing into user config

After assembling a release archive, deploy it to your user Goose config
(`~/.agents`, `~/.config/goose/recipes`, `~/.config/goose/config.yaml`):

```bash
just install-release                               # full install (backup + validate)
just INSTALL_FLAGS=--dry-run install-release        # preview only
just INSTALL_FLAGS=--skip-validate install-release  # faster, skip goose recipe validate
just INSTALL_FLAGS='--skip-validate --dry-run' install-release # combine flags
```

The installer verifies the archive SHA-256 checksum before extracting, creates
timestamped backups, preserves third-party external skills alongside project
skills, upserts slash commands, and validates recipes.

### Install flags reference

| Flag | Description |
|---|---|
| `--dry-run` | Print actions without writing files. |
| `--no-backup` | Overwrite existing targets without backup. |
| `--skip-validate` | Skip recipe validation (faster). |
| `--skip-slash-commands` | Do not modify slash commands in `config.yaml`. |

### Install into a project-local target

```bash
node src/app/harness-manager/dist/install-harness-release.js \
  install --bundle dist/releases --prefix /path/to/target
```

Content-addressed (symlinks by digest), supports verify, rollback, and
uninstall actions.