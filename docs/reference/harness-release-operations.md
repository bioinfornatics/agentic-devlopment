# Harness release operations

## Lifecycle
Source -> resolve -> build -> package -> install -> verify -> evaluate -> publish. Eval Hub is repository and CI tooling and is never included in the harness release.

## Prerequisites
Node/pnpm/npx, `skills@1.5.20`, Bun 1.3.12, Python 3.12+ (remaining governance and test tooling), Git, OpenSSL, and Goose.

## Validate
```bash
just validate-harness-manifests
node src/app/tooling/dist/check-consistency.js
```

## External skill contribution
Declare ownership external in `src/harness/source-manifest.json`; pin repository, full commit, path, SPDX license, sha256-tree-v1, dependencies, and evaluation policy in `src/harness/external-skills.lock.json`. External skills are not exempt from evaluation because they change discovery and behavior.

```bash
pnpm --dir src/app --filter @harness/tooling build
node src/app/tooling/dist/resolve-external-skills.js --staging build/harness/external
node src/app/tooling/dist/resolve-external-skills.js --staging build/harness/external --cache .cache/harness-skills --offline
```

The resolver uses isolated HOME/XDG and pinned npx skills. Never replace a reviewed commit with `latest`. Integrity mismatch requires reviewing upstream source, revision, path, and license before updating a digest.

## Build internal packages
```bash
pnpm --dir src/app --filter @harness/tooling build
node src/app/tooling/dist/build-harness.js --target linux-x86_64 --plugin-build-root /tmp --output build/harness/internal
```
TypeScript/Bun is compiled in a deterministic clean path. Python is packaged. Shell and PowerShell are validated, permissioned, and packaged. `--skip-compile` is test-only.

## Assemble and sign
```bash
pnpm --dir src/app --filter @harness/tooling build
node src/app/tooling/dist/assemble-harness-release.js --internal build/harness/internal --external build/harness/external --output dist/harness/1.0.0/linux-x86_64 --version 1.0.0 --sign-key /secure/release-ed25519.pem
(cd dist/harness/1.0.0/linux-x86_64 && sha256sum -c SHA256SUMS)
```
The bundle includes release.json, SHA256SUMS, CycloneDX SBOM, licenses, provenance, and optional signature. It excludes Eval Hub, apps, src/app/eval-hub/evals/results, node_modules, caches, session databases, WAL/SHM, and mutable plugin data.

## Install, verify, rollback, uninstall
```bash
PREFIX="$HOME/.local/share/agentic-development/harness"
node src/app/tooling/dist/install-harness-release.js install --bundle dist/harness/1.0.0/linux-x86_64 --prefix "$PREFIX"
node src/app/tooling/dist/install-harness-release.js verify --prefix "$PREFIX"
node src/app/tooling/dist/install-harness-release.js rollback --prefix "$PREFIX"
node src/app/tooling/dist/install-harness-release.js uninstall --prefix "$PREFIX" --digest <inactive-digest>
```
Installation performs no network or compilation. It verifies before extraction, uses a partial directory, atomically switches current, and preserves current on failure.

## Evaluate exact installed bytes
```bash
pnpm --dir src/app --filter @harness/eval-hub build
node src/app/eval-hub/dist/index.js --evaluate-harness-release --release "$PREFIX/current" --goose-cli /absolute/path/to/goose -- --layers skills,agents,recipes --workers 3 --ambient-goose --continue-on-failure
```
The run records release, manifest, lock, and Goose digests and verifies release stability after execution. Mutation invalidates the run. All active external skills require corpus coverage or a gated non-eligibility decision.

## CI and publication
```bash
CI=true node src/app/tooling/dist/ci-harness-release.js --version 0.0.0-test --output /tmp/harness-ci --dry-run-publish
node src/app/tooling/dist/verify-local-attestation.js --attestation /proof/attestation.json --bindings /proof/bindings.json --profile /proof/profile.json
CI=true node src/app/tooling/dist/ci-harness-release.js --version 1.0.0 --output /tmp/harness-ci --attestation /proof/attestation.json --bindings /proof/bindings.json --profile /proof/profile.json
```
PRs use explicit dry-run mode: they reproducibly build a candidate without proof but can never publish. Every non-dry-run build fails closed unless the attestation is PASS, fresh under the supplied profile's `maxEvidenceAgeMs`, and every current binding matches. The release binding must equal the exact archive digest produced in that invocation; status, Goose, model, corpus, profile, stale, and digest drift are rejected. There is no override flag.

For a tag, upload an artifact named `evaluation-attestation` containing `attestation.json`, `bindings.json`, and exact `profile.json` from the independent evaluation. Set `LOCAL_EVALUATION_RUN_ID` or dispatch with `evaluation_run_id`. Missing or rejected proof stops the verify job and therefore publication. Eval Hub remains separate and is never copied into the archive.

## Troubleshooting
- integrity mismatch: reject drift and review the pinned upstream.
- offline cache miss: populate `<cache>/<revision>/<skill>`; never fall back to latest.
- bun required: install pinned Bun; do not publish fallback source as compiled.
- checksum mismatch: reject bundle and retain current.
- installed drift: rollback and investigate mutation.
- missing external eval: add scenarios or reviewed gated non-eligibility.

## Supply-chain incident
Stop publication; preserve archive, lock, and provenance; pin or remove the upstream revision; rebuild twice; rerun all evaluation layers against the new digest; rotate signing material if compromised; publish affected release digests.
