SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c

RUNTIME_ROOT ?= build/harness/runtime
RUNTIME_RELEASES := $(RUNTIME_ROOT)/releases
RUNTIME_CURRENT := $(RUNTIME_ROOT)/current
RUNTIME_PREVIOUS := $(RUNTIME_ROOT)/previous
EXTERNAL_STAGING ?= build/harness/external/current
INTERNAL_STAGING ?= build/harness/internal
TARGET ?= linux-x86_64
GOOSE ?= goose

.PHONY: dev-runtime bootstrap-runtime activate-runtime verify-runtime rollback-runtime clean-runtime resolve-runtime build-runtime project-runtime

dev-runtime: bootstrap-runtime

resolve-runtime:
	@mkdir -p "$(dir $(EXTERNAL_STAGING))"
	@python3 scripts/resolve-external-skills.py --staging "$(EXTERNAL_STAGING)"

build-runtime:
	@python3 scripts/build-harness.py --target "$(TARGET)" --plugin-build-root /tmp --output "$(INTERNAL_STAGING)"

project-runtime: resolve-runtime build-runtime
	@python3 scripts/project-harness-runtime.py --internal "$(INTERNAL_STAGING)" --external "$(EXTERNAL_STAGING)" --runtime-root "$(RUNTIME_ROOT)"

bootstrap-runtime: project-runtime activate-runtime verify-runtime

activate-runtime:
	@python3 scripts/manage-project-runtime.py activate --runtime-root "$(RUNTIME_ROOT)" --project-root .

verify-runtime:
	@python3 scripts/manage-project-runtime.py verify --runtime-root "$(RUNTIME_ROOT)" --project-root .

rollback-runtime:
	@python3 scripts/manage-project-runtime.py rollback --runtime-root "$(RUNTIME_ROOT)" --project-root .

clean-runtime:
	@python3 scripts/manage-project-runtime.py clean --runtime-root "$(RUNTIME_ROOT)" --project-root .
