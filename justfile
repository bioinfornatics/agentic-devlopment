set shell := ["bash", "-euo", "pipefail", "-c"]

runtime_root := env_var_or_default("RUNTIME_ROOT", "build/harness/runtime")
external_staging := env_var_or_default("EXTERNAL_STAGING", "build/harness/external/current")
internal_staging := env_var_or_default("INTERNAL_STAGING", "build/harness/internal")
target := env_var_or_default("TARGET", "linux-x86_64")

# Resolve, build, project, activate, then verify a development runtime.
dev-runtime: bootstrap-runtime

# Fresh-clone entry point. The explicit lines preserve the required operation order.
bootstrap-runtime:
    just resolve-runtime
    just build-runtime
    just project-runtime
    just activate-runtime
    just verify-runtime

_build-runtime-tooling:
    pnpm --dir src/app --filter @harness/tooling build

# Bounded no-provider proof that HOME/XDG/project activation remain temporary.
smoke-sandbox: _build-runtime-tooling
    node src/app/tooling/dist/local-evaluation-sandbox.js smoke

# Full deterministic smoke. EVIDENCE must be under dist/evidence or sandbox-export.
evaluate-local-smoke: _build-runtime-tooling
    node src/app/tooling/dist/local-evaluation-smoke.js --evidence "${EVIDENCE:-src/app/tooling/dist/evidence/local-smoke.json}"

# Provider-backed full L0-L3 sandbox run; TypeScript CLI orchestrated, fail-closed, gate-verified, attested.
# Uses the active Goose provider/model and goose from PATH; GOOSE_* variables override those defaults.
evaluate-local-full: _build-runtime-tooling
    node src/app/tooling/dist/local-evaluation-full.js ${EVIDENCE_DIR:+--evidence-dir "$EVIDENCE_DIR"} ${SMOKE_EVIDENCE:+--smoke-evidence "$SMOKE_EVIDENCE"}

# Fast reverse-impact subset; never qualifies publication evidence.
evaluate-local-impacted: _build-runtime-tooling
    test -n "${SUBJECTS:-}" || { echo "SUBJECTS is required; impacted runs are NON-PUBLICATION" >&2; exit 2; }
    test -n "${GOOSE_PROVIDER:-}" && test -n "${GOOSE_MODEL:-}" && test -x "${GOOSE_CLI:-}" || { echo "GOOSE_PROVIDER, GOOSE_MODEL and executable GOOSE_CLI are required" >&2; exit 2; }
    echo "NON-PUBLICATION impacted evaluation"; root=$(mktemp -d); trap 'rm -rf "$root"' EXIT; mkdir -p "$root/runtime" "$root/evidence"; node src/app/eval-hub/dist/index.js --run --release-gate --sandbox-root "$root" --runtime-root "$root/runtime" --evidence-root "$root/evidence" --goose-cli "$GOOSE_CLI" --layers skills,agents,recipes --subjects "$SUBJECTS" --repetitions 1 --no-early-stop --workers "${WORKERS:-1}"

# Offline attestation verification against current bindings/profile.
verify-local-evidence: _build-runtime-tooling
    test -f "${ATTESTATION:-}" && test -f "${CURRENT_BINDINGS:-}" && test -f "${PROFILE:-}" || { echo "ATTESTATION, CURRENT_BINDINGS and PROFILE files are required" >&2; exit 2; }
    node --input-type=module -e 'import fs from "node:fs"; import {verifyLocalEvaluationAttestation} from "./src/app/tooling/dist/local-evaluation-attestation.js"; const j=p=>JSON.parse(fs.readFileSync(p,"utf8")); process.exit(verifyLocalEvaluationAttestation(j(process.env.ATTESTATION),j(process.env.CURRENT_BINDINGS),j(process.env.PROFILE),new Date())?0:1)'

resolve-runtime: _build-runtime-tooling
    mkdir -p "$(dirname "{{ external_staging }}")"
    node src/app/tooling/dist/resolve-external-skills.js --lock src/harness/external-skills.lock.json --staging "{{ external_staging }}"

build-runtime: _build-runtime-tooling
    node src/app/tooling/dist/build-harness.js --target "{{ target }}" --plugin-build-root /tmp --output "{{ internal_staging }}"

# Validate source and external-lock manifests with the canonical TypeScript validator.
validate-harness-manifests: _build-runtime-tooling
    node src/app/tooling/dist/validate-harness-manifests.js

project-runtime: _build-runtime-tooling
    node src/app/tooling/dist/project-harness-runtime.js --internal "{{ internal_staging }}" --external "{{ external_staging }}" --runtime-root "{{ runtime_root }}"

activate-runtime: _build-runtime-tooling
    node src/app/tooling/dist/manage-project-runtime.js activate --runtime-root "{{ runtime_root }}" --project-root .

verify-runtime: _build-runtime-tooling
    node src/app/tooling/dist/manage-project-runtime.js verify --runtime-root "{{ runtime_root }}" --project-root .

rollback-runtime: _build-runtime-tooling
    node src/app/tooling/dist/manage-project-runtime.js rollback --runtime-root "{{ runtime_root }}" --project-root .

clean-runtime: _build-runtime-tooling
    node src/app/tooling/dist/manage-project-runtime.js clean --runtime-root "{{ runtime_root }}" --project-root .

# ══════════════════════════════════════════════════════════
# Release pipeline — assemble, verify, promote
# ══════════════════════════════════════════════════════════

release_output := env_var_or_default("OUTPUT", "dist/releases")
release_staging := env_var_or_default("RELEASE_STAGING", "dist/releases")

# Assemble a reproducible release archive from the current bootstrap state.
# Uses the already-bootstrapped internal+external stages.
#   just VERSION=1.0.0 release-local
#   just VERSION=1.0.0 SIGN_KEY=signing.pem release-local
release-local: _build-runtime-tooling _verify-release-inputs
    if [[ -n "{{ sign_key }}" ]]; then \
      node src/app/tooling/dist/assemble-harness-release.js \
        --internal    "{{ internal_staging }}" \
        --external    "{{ external_staging }}" \
        --output     "{{ release_output }}" \
        --version    "{{ version }}" \
        --target     "{{ target }}" \
        --sign-key   "{{ sign_key }}"; \
    else \
      node src/app/tooling/dist/assemble-harness-release.js \
        --internal    "{{ internal_staging }}" \
        --external    "{{ external_staging }}" \
        --output     "{{ release_output }}" \
        --version    "{{ version }}" \
        --target     "{{ target }}"; \
    fi
    @echo "Release archive:"
    @ls -lh "{{ release_output }}/" 2>/dev/null || true

# Install the assembled archive into a temporary prefix and verify integrity.
# This mirrors the CI install+verify step without CI overhead.
verify-release: _build-runtime-tooling
    _tmp=$(mktemp -d); \
    trap 'rm -rf "$_tmp"' EXIT; \
    node src/app/tooling/dist/install-harness-release.js install --bundle "{{ release_staging }}" --prefix "$_tmp"; \
    node src/app/tooling/dist/install-harness-release.js verify   --prefix "$_tmp"; \
    echo "Release installs and verifies cleanly"

# Install the release archive into user Goose config (~/.agents, ~/.config/goose).
# Runs checksum verification, copies recipes/skills/agents/plugins, validates.
#   just install-release               # full install
#   just INSTALL_FLAGS=--dry-run install-release
INSTALL_FLAGS := ""
install-release:
    ./src/tooling/bin/install --bundle "{{ release_staging }}" {{ INSTALL_FLAGS }}

# Full end-to-end pipeline: bootstrap → assemble → verify install.
# Single command to take source code to a verified release archive.
#   just VERSION=1.0.0 release-pipeline
release-pipeline:
    just bootstrap-runtime
    just release-local
    just verify-release

# CI dry-run locally: reproducibility check + install verification.
# Skips tests and publication gate; use for pre-release sanity check.
#   just VERSION=1.0.0 release-dryrun
release-dryrun: _build-runtime-tooling _verify-release-inputs
    CI=true node src/app/tooling/dist/ci-harness-release.js \
      --version         "{{ version }}" \
      --output          dist/harness-dryrun \
      --dry-run-publish \
      --skip-tests
    @echo "CI dry-run result:"
    @cat dist/harness-dryrun/ci-result.json 2>/dev/null || echo "(no ci-result.json)"

# List available release artifacts
release-list:
    @echo "Release output dir: {{ release_output }}"
    @echo "---"
    @ls -lh "{{ release_output }}/" 2>/dev/null || echo "No releases yet. Run: just VERSION=x.y.z release-pipeline"

[private]
_verify-release-inputs:
    test -n "{{ version }}" || { echo "VERSION is required, e.g. just VERSION=1.0.0 release-local" >&2; exit 2; }
    case "{{ version }}" in */*|""|.|..) echo "invalid version: {{ version }}" >&2; exit 2;; esac
    command -v node >/dev/null || { echo "Node.js is required" >&2; exit 2; }

VERSION := ""
version := env_var_or_default("VERSION", VERSION)
OUTPUT := ""
output := env_var_or_default("OUTPUT", OUTPUT)
TARGET := target
companion_target := env_var_or_default("TARGET", TARGET)
LICENSE_SPDX := "CECILL-B"
license_spdx := env_var_or_default("LICENSE_SPDX", LICENSE_SPDX)
BUN := "bun"
bun := env_var_or_default("BUN", BUN)
SOURCE_DATE_EPOCH := env_var_or_default("SOURCE_DATE_EPOCH", "0")
source_date_epoch := env_var_or_default("SOURCE_DATE_EPOCH", SOURCE_DATE_EPOCH)
PREBUILT_BINARY := ""
prebuilt_binary := env_var_or_default("PREBUILT_BINARY", PREBUILT_BINARY)
SIGN_KEY := ""
sign_key := env_var_or_default("SIGN_KEY", SIGN_KEY)
companion_fixed := "/tmp/agentic-development-build/eval-hub-companion"
companion_root := companion_fixed / "root"
companion_binary := companion_fixed / "eval-hub"
companion_archive := output / ("eval-hub-companion-" + version + "-" + companion_target + ".tar")

# Build the reproducible Eval Hub companion archive and its evidence sidecars.
package-companion: _verify-companion-inputs
    rm -rf "{{ output }}" "{{ companion_fixed }}"
    mkdir -p "{{ output }}" "{{ companion_fixed }}" "{{ companion_root }}/bin" "{{ companion_root }}/.agents/skills"
    if [[ -n "{{ prebuilt_binary }}" ]]; then cp "{{ prebuilt_binary }}" "{{ companion_binary }}"; chmod 0755 "{{ companion_binary }}"; else cd "{{ justfile_directory() }}/src/app"; "{{ bun }}" build eval-hub/src/index.ts --compile --outfile "{{ companion_binary }}"; first=$(sha256sum "{{ companion_binary }}" | awk '{print $1}'); rm "{{ companion_binary }}"; "{{ bun }}" build eval-hub/src/index.ts --compile --outfile "{{ companion_binary }}"; second=$(sha256sum "{{ companion_binary }}" | awk '{print $1}'); [[ "$first" == "$second" ]] || { echo "non-reproducible Bun companion binary" >&2; exit 3; }; fi
    chmod 0755 "{{ companion_binary }}"; cp "{{ companion_binary }}" "{{ companion_root }}/bin/eval-hub"; chmod 0755 "{{ companion_root }}/bin/eval-hub"
    binary_sha=$(sha256sum "{{ companion_binary }}" | awk '{print $1}'); printf '%s  eval-hub\n' "$binary_sha" > "{{ companion_root }}/bin/eval-hub.sha256"
    cp -a "{{ justfile_directory() }}/src/app/eval-hub/companion/skill" "{{ companion_root }}/.agents/skills/eval-hub"; chmod 0755 "{{ companion_root }}/.agents/skills/eval-hub/scripts/eval-hub"
    cp "{{ justfile_directory() }}/src/app/eval-hub/LICENSE.CECILL-B" "{{ companion_root }}/LICENSE.CECILL-B"
    binary_sha=$(sha256sum "{{ companion_binary }}" | awk '{print $1}'); skill_sha=$(tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --format=pax --pax-option=delete=atime,delete=ctime -cf - -C "{{ companion_root }}/.agents/skills/eval-hub" . | sha256sum | awk '{print $1}'); source_commit=$(git -C "{{ justfile_directory() }}" rev-parse HEAD 2>/dev/null || printf '%s' "${SOURCE_REVISION:-UNKNOWN}"); bun_version=$("{{ bun }}" --version); files_json="{{ companion_fixed }}/files.jsonl"; : > "$files_json"; while IFS= read -r file; do rel=${file#"{{ companion_root }}/"}; digest=$(sha256sum "$file" | awk '{print $1}'); size=$(stat -c %s "$file"); jq -nc --arg path "$rel" --arg sha256 "$digest" --argjson size "$size" '{path:$path,sha256:$sha256,size:$size}' >> "$files_json"; done < <(find "{{ companion_root }}" -type f -print | LC_ALL=C sort); jq -s --arg version "{{ version }}" --arg target "{{ companion_target }}" --arg sourceCommit "$source_commit" --argjson sourceCommitEpoch "{{ source_date_epoch }}" --arg bunVersion "$bun_version" --arg binarySha256 "$binary_sha" --arg skillSha256 "$skill_sha" --arg sourceTreeSha256 "$(git -C '{{ justfile_directory() }}' ls-tree -r HEAD src/app/eval-hub 2>/dev/null | sha256sum | awk '{print $1}')" --arg runtimeReleaseSha256 "${HARNESS_RUNTIME_DIGEST:-unbound}" '{schema:"eval-hub-companion-v1",version:$version,target:$target,sourceRepository:"https://github.com/bioinfornatics/agentic-devlopment",sourceCommit:$sourceCommit,sourceCommitEpoch:$sourceCommitEpoch,bunVersion:$bunVersion,binarySha256:$binarySha256,skillSha256:$skillSha256,sourceTreeSha256:$sourceTreeSha256,runtimeReleaseSha256:$runtimeReleaseSha256,coreHarnessIncluded:false,files:.}' "$files_json" > "{{ companion_root }}/companion.json"; jq -nc --arg version "{{ version }}" --arg sourceCommit "$source_commit" --arg bunVersion "$bun_version" '{bomFormat:"CycloneDX",specVersion:"1.5",components:[{type:"application",name:"eval-hub-companion",version:$version,properties:[{name:"sourceCommit",value:$sourceCommit},{name:"bunVersion",value:$bunVersion}]}]}' > "{{ companion_root }}/sbom.cdx.json"; jq -nc --arg spdx "{{ license_spdx }}" '{spdx:$spdx,distributionAllowed:($spdx!="NOASSERTION"),reviewRequired:($spdx=="NOASSERTION")}' > "{{ companion_root }}/LICENSE-ASSERTION.json"; jq -nc --arg sourceCommit "$source_commit" --argjson sourceCommitEpoch "{{ source_date_epoch }}" --arg target "{{ companion_target }}" --arg bunVersion "$bun_version" --arg binarySha256 "$binary_sha" --arg skillSha256 "$skill_sha" --arg sourceTreeSha256 "$(git -C '{{ justfile_directory() }}' ls-tree -r HEAD src/app/eval-hub 2>/dev/null | sha256sum | awk '{print $1}')" --arg runtimeReleaseSha256 "${HARNESS_RUNTIME_DIGEST:-unbound}" '{schema:"eval-hub-companion-provenance-v1",sourceCommit:$sourceCommit,sourceCommitEpoch:$sourceCommitEpoch,target:$target,bunVersion:$bunVersion,binarySha256:$binarySha256,skillSha256:$skillSha256,sourceTreeSha256:$sourceTreeSha256,runtimeReleaseSha256:$runtimeReleaseSha256}' > "{{ companion_root }}/provenance.json"
    tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --format=pax --pax-option=delete=atime,delete=ctime -cf "{{ companion_archive }}" -C "{{ companion_root }}" .
    archive_sha=$(sha256sum "{{ companion_archive }}" | awk '{print $1}'); printf '%s  %s\n' "$archive_sha" "$(basename "{{ companion_archive }}")" > "{{ output }}/SHA256SUMS"
    cp "{{ companion_root }}/companion.json" "{{ companion_root }}/sbom.cdx.json" "{{ companion_root }}/LICENSE-ASSERTION.json" "{{ companion_root }}/provenance.json" "{{ output }}/"
    sha256sum "{{ companion_archive }}" | awk '{print $1}'
    rm -rf "{{ companion_fixed }}"

[private]
_verify-companion-inputs:
    test -n "{{ version }}" || { echo "VERSION is required" >&2; exit 2; }
    test -n "{{ output }}" || { echo "OUTPUT is required" >&2; exit 2; }
    test "{{ companion_target }}" = "linux-x86_64" || { echo "unsupported companion target: {{ companion_target }}" >&2; exit 2; }
    case "{{ version }}" in */*|""|.|..) echo "invalid companion version: {{ version }}" >&2; exit 2;; esac
    test "{{ license_spdx }}" = "CECILL-B" || { echo "LICENSE_SPDX must be exactly CECILL-B" >&2; exit 2; }
    command -v "{{ bun }}" >/dev/null || { echo "Bun is required: {{ bun }}" >&2; exit 2; }
    command -v jq >/dev/null && command -v sha256sum >/dev/null && command -v tar >/dev/null
    if [[ -n "{{ prebuilt_binary }}" ]]; then test -x "{{ prebuilt_binary }}" || { echo "PREBUILT_BINARY must be executable" >&2; exit 2; }; fi
