.POSIX:
SHELL := bash
.ONESHELL:

# ══════════════════════════════════════════════════════════
# EVAL-HUB — debug/local runs
# ══════════════════════════════════════════════════════════
# Usage:
#   make evaluate-debug GOOSE_PROVIDER=azure_foundry GOOSE_MODEL=gpt-4 SUBJECTS=independent-verifier EVAL_IDS=independent-verifier:3
#   make evaluate-debug GOOSE_CLI=./goose GOOSE_PROVIDER=... GOOSE_MODEL=... SUBJECTS=... EVAL_IDS=...
#   make evaluate-debug WORKERS=2 REPETITIONS=3 LAYERS=skills,agents
#
# Auto-detects 'goose' from PATH if GOOSE_CLI is not set.
# Builds eval-hub from source if dist/index.js is stale.
#
# Required:
#   GOOSE_PROVIDER  — LLM provider (e.g. azure_foundry, openai)
#   GOOSE_MODEL     — model name (e.g. gpt-4, DeepSeek-V4-Flash)
#   SUBJECTS        — subject(s) to run (e.g. independent-verifier)
#   EVAL_IDS        — eval ID(s) to run (e.g. independent-verifier:3)
# Optional:
#   GOOSE_CLI       — path to goose binary (default: auto-detect from PATH)
#   WORKERS         — parallel subjects (default: 1)
#   REPETITIONS     — paired repetitions (default: 1)
#   MAX_TURNS       — max turns per goose run (default: 100)
#   TIMEOUT         — per-run timeout in seconds (default: 900)
#   LAYERS          — which layers to run (default: agents)
#   RUN_ID          — stable run ID for resume/reference

GOOSE_CLI   ?= $(shell command -v goose 2>/dev/null || echo "")
WORKERS     ?= 1
REPETITIONS ?= 1
MAX_TURNS   ?= 100
TIMEOUT     ?= 900
LAYERS      ?= agents

.PHONY: evaluate-debug
evaluate-debug: src/app/eval-hub/dist/index.js
	@if [ -z "$(GOOSE_CLI)" ]; then echo "GOOSE_CLI required — set it or ensure 'goose' is in PATH" >&2; exit 2; fi
	@if [ -z "$(GOOSE_PROVIDER)" ]; then echo "GOOSE_PROVIDER required" >&2; exit 2; fi
	@if [ -z "$(GOOSE_MODEL)" ]; then echo "GOOSE_MODEL required" >&2; exit 2; fi
	@if [ -z "$(SUBJECTS)" ]; then echo "SUBJECTS required" >&2; exit 2; fi
	@if [ -z "$(EVAL_IDS)" ]; then echo "EVAL_IDS required" >&2; exit 2; fi
	node src/app/eval-hub/dist/index.js --run \
		--goose-cli "$(GOOSE_CLI)" \
		--provider "$(GOOSE_PROVIDER)" \
		--model "$(GOOSE_MODEL)" \
		--layers "$(LAYERS)" \
		--subjects "$(SUBJECTS)" \
		--eval-ids "$(EVAL_IDS)" \
		--workers "$(WORKERS)" \
		--repetitions "$(REPETITIONS)" \
		--max-turns "$(MAX_TURNS)" \
		--timeout "$(TIMEOUT)" \
		--no-early-stop \
		--continue-on-failure \
		$(if $(RUN_ID),--run-id "$(RUN_ID)")

# ══════════════════════════════════════════════════════════
# BUILD — compile eval-hub TypeScript
# ══════════════════════════════════════════════════════════
# make tracks timestamps: dist/index.js is rebuilt only
# when any src/**/*.ts source file is newer.

EVAL_HUB_SRC := $(shell find src/app/eval-hub/src -name '*.ts' 2>/dev/null)

src/app/eval-hub/dist/index.js: $(EVAL_HUB_SRC)
	pnpm --dir src/app/eval-hub run build

# ══════════════════════════════════════════════════════════
# FULL PIPELINE — resolve, build, assemble, install
# ══════════════════════════════════════════════════════════
# Usage:
#   make release VERSION=1.0.0          # build, assemble, install to user config
#   make release VERSION=1.0.0 DRY_RUN=1  # dry-run: print actions without copying
#
# The pipeline:
#   1. Build internal components (skills, agents, recipes, plugins) into harness runtime
#   2. Assemble a reproducible tar archive with external skills
#   3. Install into ~/.agents/ and ~/.config/goose/
#
# Required:
#   VERSION       — release version string (e.g. 1.0.0)
# Optional:
#   DRY_RUN       — set to 1 for dry-run mode
#   TARGET        — target platform (default: linux-x86_64)
#   RUNTIME_ROOT  — output path for runtime build (default: build/harness/runtime)
#   EXTERNAL_STAGING — external skills staging dir (default: build/harness/external/current)
#   INTERNAL_STAGING — internal build output dir (default: build/harness/internal)

RUNTIME_ROOT      ?= build/harness/runtime
EXTERNAL_STAGING  ?= build/harness/external/current
INTERNAL_STAGING  ?= build/harness/internal
TARGET            ?= linux-x86_64

.PHONY: release
release: _check-version runtime-build runtime-assemble runtime-install

.PHONY: runtime-assemble
runtime-assemble:
	node src/app/harness-release/dist/assemble-harness-release.js \
		--internal "$(INTERNAL_STAGING)" \
		--external "$(EXTERNAL_STAGING)" \
		--output dist/releases \
		--version "$(VERSION)" \
		--target "$(TARGET)" \
		$(if $(SIGN_KEY),--sign-key "$(SIGN_KEY)")

.PHONY: runtime-install
runtime-install:
	./src/tooling/bin/install \
		--bundle dist/releases \
		$(if $(filter 1,$(DRY_RUN)),--dry-run)

_check-version:
	@if [ -z "$(VERSION)" ]; then echo "VERSION required (e.g. VERSION=1.0.0)" >&2; exit 2; fi
	@case "$(VERSION)" in */*|""|.|..) echo "invalid VERSION: $(VERSION)" >&2; exit 2;; esac

# ══════════════════════════════════════════════════════════
# RUNTIME — resolve, build (individual steps)
# ══════════════════════════════════════════════════════════

RUNTIME_ROOT      ?= build/harness/runtime
EXTERNAL_STAGING  ?= build/harness/external/current
INTERNAL_STAGING  ?= build/harness/internal
TARGET            ?= linux-x86_64

.PHONY: runtime-bootstrap
runtime-bootstrap: runtime-resolve runtime-build runtime-project runtime-activate runtime-verify

_build-tooling:
	pnpm --dir src/app --filter @harness/harness-release build

.PHONY: runtime-resolve
runtime-resolve: _build-tooling
	mkdir -p "$(dir $(EXTERNAL_STAGING))"
	node src/app/harness-release/dist/resolve-external-skills.js \
		--lock src/harness/external-skills.lock.json \
		--staging "$(EXTERNAL_STAGING)"

.PHONY: runtime-build
runtime-build: _build-tooling
	node src/app/harness-release/dist/build-harness.js \
		--target "$(TARGET)" \
		--plugin-build-root /tmp \
		--output "$(INTERNAL_STAGING)"

.PHONY: runtime-project
runtime-project:
	node src/app/harness-manager/dist/project-harness-runtime.js \
		--internal "$(INTERNAL_STAGING)" \
		--external "$(EXTERNAL_STAGING)" \
		--runtime-root "$(RUNTIME_ROOT)"

.PHONY: runtime-activate
runtime-activate:
	node src/app/harness-manager/dist/manage-project-runtime.js activate \
		--runtime-root "$(RUNTIME_ROOT)" \
		--project-root .

.PHONY: runtime-verify
runtime-verify:
	node src/app/harness-manager/dist/manage-project-runtime.js verify \
		--runtime-root "$(RUNTIME_ROOT)" \
		--project-root .

.PHONY: runtime-rollback
runtime-rollback:
	node src/app/harness-manager/dist/manage-project-runtime.js rollback \
		--runtime-root "$(RUNTIME_ROOT)" \
		--project-root .

.PHONY: runtime-clean
runtime-clean:
	node src/app/harness-manager/dist/manage-project-runtime.js clean \
		--runtime-root "$(RUNTIME_ROOT)" \
		--project-root .

# ══════════════════════════════════════════════════════════
# VALIDATION
# ══════════════════════════════════════════════════════════

.PHONY: validate-manifests
validate-manifests: _build-tooling
	node src/app/harness-release/dist/validate-harness-manifests.js

.PHONY: verify-evidence
verify-evidence:
	@if [ -z "$(ATTESTATION)" ]; then echo "ATTESTATION required" >&2; exit 2; fi
	@if [ -z "$(CURRENT_BINDINGS)" ]; then echo "CURRENT_BINDINGS required" >&2; exit 2; fi
	@if [ -z "$(PROFILE)" ]; then echo "PROFILE required" >&2; exit 2; fi
	node --input-type=module -e "import fs from 'node:fs'; import {verifyLocalEvaluationAttestation} from '@harness/eval-hub/local-evaluation'; const j = p => JSON.parse(fs.readFileSync(p, 'utf8')); process.exit(verifyLocalEvaluationAttestation(j(process.env.ATTESTATION), j(process.env.CURRENT_BINDINGS), j(process.env.PROFILE), new Date()) ? 0 : 1)"

# ══════════════════════════════════════════════════════════
# HELP
# ══════════════════════════════════════════════════════════

.PHONY: help
help:
	@echo 'Targets:'
	@echo ''
	@echo '  make evaluate-debug GOOSE_PROVIDER=x GOOSE_MODEL=y SUBJECTS=z EVAL_IDS=w'
	@echo '    Debug a specific eval (auto-builds eval-hub, validates deps)'
	@echo '    Optional: GOOSE_CLI WORKERS REPETITIONS MAX_TURNS TIMEOUT LAYERS RUN_ID'
	@echo ''
	@echo '  make release VERSION=x.y.z'
	@echo '    Full pipeline: build harness + assemble release + install to ~/.agents/'
	@echo '    Optional: DRY_RUN=1 TARGET=linux-x86_64 SIGN_KEY=file'
	@echo ''
	@echo '  make runtime-bootstrap'
	@echo '    Full runtime: resolve → build → project → activate → verify'
	@echo ''
	@echo '  make validate-manifests'
	@echo '    Validate source and external-lock manifests'
	@echo ''
	@echo '  make verify-evidence ATTESTATION=x CURRENT_BINDINGS=y PROFILE=z'
	@echo '    Verify local evaluation attestation'