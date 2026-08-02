---
normative: true
document_type: reference
---

# Harness Release Lifecycle

This document describes the complete release pipeline from source edit to verified release archive.

## Quick start

```bash
just VERSION=1.0.0 release-pipeline   # bootstrap → assemble → verify install
just release-list                     # inspect output
```

## Pipeline stages

```
┌─────────────────────┐
│   Edit source       │  src/agents, src/skills, src/recipes, src/plugins
│   under src/        │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐   just bootstrap-runtime
│  Bootstrap runtime   │  resolve external → build → project → activate → verify
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐   just VERSION=x.y.z release-local
│  Assemble release    │  merge internal + external → tar + sbom + provenance + checksums
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐   just verify-release
│  Verify install      │  install archive to scratch prefix → sha256 verify every file
└──────────────────────┘
```

## Recipes

### `just VERSION=x.y.z release-pipeline`

Full end-to-end pipeline. Equivalent to:

```bash
just bootstrap-runtime
just VERSION=x.y.z release-local
just verify-release
```

### `just VERSION=x.y.z release-local`

Assemble a release archive using the already-bootstrapped internal and external stages.

Outputs to `dist/releases/`:

| File | Description |
|---|---|
| `harness-<version>-<target>.tar` | Reproducible tar archive (sorted, normalized owner/mtime) |
| `SHA256SUMS` | SHA-256 of the archive |
| `release.json` | Release manifest: file list with sha256 digests, version, target, schema |
| `sbom.cdx.json` | CycloneDX SBOM of external skill dependencies |
| `THIRD_PARTY_LICENSES.json` | SPDX license IDs for each external skill |
| `provenance.json` | Source revision, toolchain versions, lockfile SHA-256 |

**Optional environment variables:**

| Variable | Purpose |
|---|---|
| `SIGN_KEY=path` | Path to signing key for `SHA256SUMS.sig` |
| `TARGET` | Override platform target (default `linux-x86_64`) |

### `just verify-release`

Install the assembled archive into a temporary prefix and verify every file's SHA-256 checksum matches the manifest. Mirrors the CI install+verify step without CI overhead.

Fails closed if any file is missing, corrupted, or drifts from the manifest.

### `just VERSION=x.y.z release-dryrun`

Runs the full CI release pipeline locally with `--dry-run-publish --skip-tests`:

1. Resolves external skills into a fresh temp staging area
2. Builds harness internals
3. Assembles the release **twice** from independent staging dirs
4. Compares the two archives byte-for-byte (**reproducibility gate**)
5. Installs + verifies the archive
6. Writes `ci-result.json` with digests and metadata

The reproducibility gate is the strongest signal that the build is deterministic.

### `just release-list`

List release artifacts in the output directory.

## CI automation

The `.github/workflows/harness-release.yml` workflow runs two jobs:

1. **verify** — resolves, builds, assembles, optionally runs Eval Hub companion packaging; uploads artifacts
2. **publish** — downloads artifacts and creates a GitHub release (manual, requires attestation)

For tag publication, CI requires:
- `evaluation_run_id`: run ID of an evaluation attestation artifact
- `release_tag`: must match pattern `harness-v*`

The CI tool (`ci-harness-release.js`) always builds in a clean temp tree (never reuses `build/` artifacts), performs a reproducibility build, and fails closed on attestation mismatch.

## Versioning

Semantic versioning (`MAJOR.MINOR.PATCH`) is used for release tags: `harness-v1.0.0`.

The `VERSION` justfile variable is passed as a positional parameter:

```bash
just VERSION=1.0.0 release-local
```

Version strings must not contain `/`, `.`, `..`, or be empty.

## Installing into user config

```bash
# Install release archive into ~/.agents + ~/.config/goose
just install-release

# Dry-run (preview only)
just INSTALL_FLAGS=--dry-run install-release

# Skip recipe validation (faster)
just INSTALL_FLAGS='--skip-validate' install-release
```

The installer:
- verifies the archive SHA-256 checksum before extracting
- backs up existing `~/.agents/skills`, `~/.agents/agents`, `~/.config/goose/recipes`
- preserves external (third-party) skills alongside project skills
- upserts slash commands in `~/.config/goose/config.yaml`
- validates all recipes with `goose recipe validate`

## Verification after installation

After installing a release archive into a target project:

```bash
cd /path/to/target

# Verify no drift in deployed artifacts
just verify-runtime

# Confirm discovery
goose skills list
goose recipe list
find .agents -name plugin.json -print
```

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---|---|---|
| `VERSION is required` | Forgot to set VERSION | `just VERSION=x.y.z release-local` |
| `invalid version` | Contains `/`, `.`, `..` or empty | Use valid semver |
| `reproducibility failure` | Second assembly differs from first | Clean `build/`, check for stale plugins |
| `install drift` | SHA-256 mismatch in installed files | Re-assemble; do not mutate installed state |
| `missing --internal` | Forgot to bootstrap first | Run `just bootstrap-runtime` before `release-local` |
| `plugin binary missing` | Plugin build failed during bootstrap | Check bootstrap logs; re-run `just build-runtime` |
