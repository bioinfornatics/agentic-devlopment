# Harness release operations

## Lifecycle
Source -> resolve -> build -> package -> install -> verify -> evaluate -> publish. Eval Hub is repository and CI tooling and is never included in the harness release.

## Prerequisites
Python 3.12+, Git, Node/npx, `skills@1.5.20`, Bun 1.3.12, OpenSSL, and Goose.

## Validate
```bash
python3 scripts/validate-harness-manifests.py
python3 scripts/check-consistency.py
python3 -m unittest discover -s scripts/tests/integration -p 'test_harness*.py'
```

## External skill contribution
Declare ownership external in `harness/source-manifest.json`; pin repository, full commit, path, SPDX license, sha256-tree-v1, dependencies, and evaluation policy in `harness/external-skills.lock.json`. External skills are not exempt from evaluation because they change discovery and behavior.

```bash
python3 scripts/resolve-external-skills.py --staging build/harness/external
python3 scripts/resolve-external-skills.py --staging build/harness/external --cache .cache/harness-skills --offline
```

The resolver uses isolated HOME/XDG and pinned npx skills. Never replace a reviewed commit with `latest`. Integrity mismatch requires reviewing upstream source, revision, path, and license before updating a digest.

## Build internal packages
```bash
python3 scripts/build-harness.py --target linux-x86_64 --plugin-build-root /tmp --output build/harness/internal
```
TypeScript/Bun is compiled in a deterministic clean path. Python is packaged. Shell and PowerShell are validated, permissioned, and packaged. `--skip-compile` is test-only.

## Assemble and sign
```bash
python3 scripts/assemble-harness-release.py --internal build/harness/internal --external build/harness/external --output dist/harness/1.0.0/linux-x86_64 --version 1.0.0 --sign-key /secure/release-ed25519.pem
(cd dist/harness/1.0.0/linux-x86_64 && sha256sum -c SHA256SUMS)
```
The bundle includes release.json, SHA256SUMS, CycloneDX SBOM, licenses, provenance, and optional signature. It excludes Eval Hub, apps, evals/results, node_modules, caches, session databases, WAL/SHM, and mutable plugin data.

## Install, verify, rollback, uninstall
```bash
PREFIX="$HOME/.local/share/agentic-development/harness"
python3 scripts/install-harness-release.py install --bundle dist/harness/1.0.0/linux-x86_64 --prefix "$PREFIX"
python3 scripts/install-harness-release.py verify --prefix "$PREFIX"
python3 scripts/install-harness-release.py rollback --prefix "$PREFIX"
python3 scripts/install-harness-release.py uninstall --prefix "$PREFIX" --digest <inactive-digest>
```
Installation performs no network or compilation. It verifies before extraction, uses a partial directory, atomically switches current, and preserves current on failure.

## Evaluate exact installed bytes
```bash
pnpm --dir apps --filter @harness/eval-hub build
python3 scripts/evaluate-harness-release.py --release "$PREFIX/current" --goose-cli /absolute/path/to/goose -- --layers skills,agents,recipes --workers 3 --ambient-goose --continue-on-failure
```
The run records release, manifest, lock, and Goose digests and verifies release stability after execution. Mutation invalidates the run. All active external skills require corpus coverage or a gated non-eligibility decision.

## CI and publication
```bash
CI=true python3 scripts/ci-harness-release.py --version 0.0.0-test --output /tmp/harness-ci --dry-run-publish
```
PRs validate and build. `harness-v*` tags publish after reproducibility/install/evaluation preflight. Eval Hub is built separately and never copied into the archive.

## Troubleshooting
- integrity mismatch: reject drift and review the pinned upstream.
- offline cache miss: populate `<cache>/<revision>/<skill>`; never fall back to latest.
- bun required: install pinned Bun; do not publish fallback source as compiled.
- checksum mismatch: reject bundle and retain current.
- installed drift: rollback and investigate mutation.
- missing external eval: add scenarios or reviewed gated non-eligibility.

## Supply-chain incident
Stop publication; preserve archive, lock, and provenance; pin or remove the upstream revision; rebuild twice; rerun all evaluation layers against the new digest; rotate signing material if compromised; publish affected release digests.
