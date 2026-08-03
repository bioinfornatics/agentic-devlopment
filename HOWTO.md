# Harness operator HOWTO
> **Non-normative operator guide.** Architecture and behavior are defined by the repository specs and ADRs; this page only gives reproducible commands for the current tree.
## 1. Prerequisites
Use Node.js 22 (the workspace requires >=22 <23) and pnpm 10.33.0 (pinned in src/app/package.json). The commands also need Git, Bash, just, jq, and Goose; this guide was checked with Goose 1.37.0. Beads (bd) is needed for governed runs. Pandoc is only needed for the documentation build.
```bash
node --version
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm --version
goose --version
just --version
```

## 2. Install dependencies and build the runtime

From the repository root:

```bash
pnpm --dir src/app install --frozen-lockfile --ignore-scripts
pnpm --dir src/app --filter @harness/eval-hub rebuild better-sqlite3
just bootstrap-runtime
just verify-runtime
```

bootstrap-runtime resolves pinned external skills, builds and projects the harness, activates it for this checkout, then verifies it. The separate verify-runtime command is safe to repeat.

## 3. Run tests by layer

Run the narrow tooling layer first, then repository contracts:

```bash
pnpm --dir src/app --filter @harness/eval-hub typecheck
pnpm --dir src/app --filter @harness/eval-hub test
node src/app/harness-release/dist/validate-harness-manifests.js
```

The first two commands compile and test the Eval Hub package. The third checks source manifests and external lock integrity. For the generated documentation layer (requires Pandoc):
```bash
./src/tooling/bin/build-docs
```
Expected primary output: dist/docs/html/agentic-development-harness.html. A PDF is also produced when XeLaTeX or Chromium is available.
## 4. Create a disposable Goose home

Use a temporary HOME and all XDG directories. The temporary HOME protects both Goose configuration and the ~/.agents discovery path. See https://goose-docs.ai/docs/guides/environment-variables/. XDG variables alone do **not** redirect `~/.agents`, and this guide does not document a `GOOSE_HOME` variable.

```bash
export HARNESS_REPO="$PWD"
export HARNESS_ORIGINAL_HOME="$HOME"
export HARNESS_SMOKE_ROOT="$(mktemp -d)"
export HOME="$HARNESS_SMOKE_ROOT/home"
export XDG_CONFIG_HOME="$HARNESS_SMOKE_ROOT/xdg/config"
export XDG_DATA_HOME="$HARNESS_SMOKE_ROOT/xdg/data"
export XDG_STATE_HOME="$HARNESS_SMOKE_ROOT/xdg/state"
export XDG_CACHE_HOME="$HARNESS_SMOKE_ROOT/xdg/cache"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" \
  "$XDG_STATE_HOME" "$XDG_CACHE_HOME"
```

The sandbox follows the XDG Base Directory Specification. When variables are unset or empty, configuration defaults to $HOME/.config, data to $HOME/.local/share, state to $HOME/.local/state, and cache to $HOME/.cache. The sandbox exports these variables explicitly using the same layout under its temporary HOME. The source Goose configuration is read from ${XDG_CONFIG_HOME:-$HOME/.config}/goose.

Before Goose starts, the sandbox automatically copies ~/.config/goose/config.yaml and every regular top-level ~/.config/goose/custom_* file into $XDG_CONFIG_HOME/goose/. Backups, unrelated files, directories, and symlinks are not copied; edits remain confined to the sandbox. This preserves the selected provider/model configuration without touching the production files.

Export provider credentials only through environment variables supported by your provider:

```bash
export GOOSE_PROVIDER="<provider>"
export GOOSE_MODEL="<model>"
```

Do not write credentials into this repository, commands copied to logs, Beads comments, or test artifacts.

## 5. Preview and install the projected runtime

Point the installer at the activated projection explicitly. Preview first — dry-run prints paths and actions but copies nothing.

```bash
just INSTALL_FLAGS='--dry-run' install-release
# or
"$HARNESS_REPO/src/tooling/bin/install" --dry-run --bundle dist/releases
```

Install into user Goose config:

```bash
just install-release
```

Install into a project-local target:

```bash
"$HARNESS_REPO/src/tooling/bin/install" \
  install --bundle dist/releases --prefix /path/to/target
```

## 6. Validate discovery from an empty project

Do not run this smoke check in the repository: its project-local .agents or .goose content could mask a broken user-level installation.

```bash
export HARNESS_EMPTY_PROJECT="$HARNESS_SMOKE_ROOT/empty-project"
mkdir -p "$HARNESS_EMPTY_PROJECT"
cd "$HARNESS_EMPTY_PROJECT"

goose skills list
goose recipe list
goose run --recipe loop-engineering --render-recipe
find "$HOME/.agents/plugins" -mindepth 2 -maxdepth 2 -name plugin.json -print
find "${XDG_CONFIG_HOME:-$HOME/.config}/goose/recipes" -name '*.yaml' -print \
  -exec goose recipe validate {} \;
```

Confirm that harness skills, plugins, and the research, implement, verify, and loop-engineering recipes are listed. Recipe validation must succeed.

## 7. Run the deterministic local smoke gate

From the repository root:

```bash
just evaluate-local-smoke
```

It uses no provider, builds and installs only inside a disposable sandbox, and writes canonical evidence to src/app/eval-hub/dist/evidence/local-smoke.json. Override with EVIDENCE=sandbox-export/name.json just evaluate-local-smoke; other destinations fail closed.

## 8. Releasing from local source

Assemble a distributable release archive:

```bash
just VERSION=1.0.0 release-local
just verify-release
just release-list
```

Full end-to-end (bootstrap → assemble → verify):

```bash
just VERSION=1.0.0 release-pipeline
```

Install into user Goose config after assembling:

```bash
just install-release                                # full install with backup + validate
just INSTALL_FLAGS='--dry-run' install-release       # preview only
just INSTALL_FLAGS='--skip-validate' install-release # faster, skip recipe validation
```

CI-equivalent dry-run (reproducibility verification, skips tests and publish gate):

```bash
just VERSION=1.0.0 release-dryrun
```

Each release produces harness-<version>-<target>.tar plus release.json, sbom.cdx.json, provenance.json, and SHA256SUMS in dist/releases/.

## 9. Cleanup and troubleshooting

```bash
cd /tmp
rm -rf -- "$HARNESS_SMOKE_ROOT"
export HOME="$HARNESS_ORIGINAL_HOME"
unset HARNESS_REPO HARNESS_RUNTIME_ROOT HARNESS_SMOKE_ROOT HARNESS_EMPTY_PROJECT HARNESS_ORIGINAL_HOME
unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME
```

The cleanup restores the original HOME; using a dedicated subshell remains recommended so no temporary environment can leak into later commands.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `VERSION is required` | Set VERSION: `just VERSION=1.0.0 release-local` |
| Missing source directory | Rerun `just bootstrap-runtime` and check HARNESS_RUNTIME_ROOT |
| Native bindings fail | Repeat `pnpm --dir src/app --filter @harness/eval-hub rebuild better-sqlite3` under Node 22 |
| Discovery differs between repo and empty project | Trust the empty-project result and inspect temporary home paths before cleanup |
| Release dry-run fails dirty-tree check | Run from a clean working tree or use `just VERSION=1.0.0 release-dryrun` (auto-bypasses via CI=true) |
