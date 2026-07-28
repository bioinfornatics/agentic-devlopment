SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c

REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../../..)
VERSION ?=
OUTPUT ?=
TARGET ?= linux-x86_64
LICENSE_SPDX ?= NOASSERTION
ALLOW_NOASSERTION ?= 0
BUN ?= bun
SOURCE_DATE_EPOCH ?= $(shell git -C "$(REPO_ROOT)" show -s --format=%ct HEAD)
PREBUILT_BINARY ?=
FIXED := /tmp/agentic-development-build/eval-hub-companion
ROOT := $(FIXED)/root
BINARY := $(FIXED)/eval-hub
ARCHIVE := $(OUTPUT)/eval-hub-companion-$(VERSION)-$(TARGET).tar

.PHONY: package verify-inputs clean

verify-inputs:
	@test -n "$(VERSION)" || { echo "VERSION is required" >&2; exit 2; }
	@test -n "$(OUTPUT)" || { echo "OUTPUT is required" >&2; exit 2; }
	@test "$(TARGET)" = "linux-x86_64" || { echo "unsupported companion target: $(TARGET)" >&2; exit 2; }
	@case "$(VERSION)" in *[\/]*|""|.|..) echo "invalid companion version: $(VERSION)" >&2; exit 2;; esac
	@if [[ "$(LICENSE_SPDX)" == "NOASSERTION" && "$(ALLOW_NOASSERTION)" != "1" ]]; then echo "distribution license is NOASSERTION; set reviewed LICENSE_SPDX" >&2; exit 2; fi
	@command -v "$(BUN)" >/dev/null || { echo "Bun is required: $(BUN)" >&2; exit 2; }
	@command -v jq >/dev/null && command -v sha256sum >/dev/null && command -v tar >/dev/null
	@if [[ -n "$(PREBUILT_BINARY)" ]]; then test -x "$(PREBUILT_BINARY)" || { echo "PREBUILT_BINARY must be executable" >&2; exit 2; }; fi

clean:
	@rm -rf "$(FIXED)"

package: verify-inputs
	@rm -rf "$(OUTPUT)" "$(FIXED)"
	@mkdir -p "$(OUTPUT)" "$(FIXED)" "$(ROOT)/bin" "$(ROOT)/.agents/skills"
	@if [[ -n "$(PREBUILT_BINARY)" ]]; then cp "$(PREBUILT_BINARY)" "$(BINARY)"; chmod 0755 "$(BINARY)"; else cd "$(REPO_ROOT)/src/app"; "$(BUN)" build eval-hub/src/index.ts --compile --outfile "$(BINARY)"; first=$$(sha256sum "$(BINARY)" | awk '{print $$1}'); rm "$(BINARY)"; "$(BUN)" build eval-hub/src/index.ts --compile --outfile "$(BINARY)"; second=$$(sha256sum "$(BINARY)" | awk '{print $$1}'); [[ "$$first" == "$$second" ]] || { echo "non-reproducible Bun companion binary" >&2; exit 3; }; fi
	@chmod 0755 "$(BINARY)"; cp "$(BINARY)" "$(ROOT)/bin/eval-hub"; chmod 0755 "$(ROOT)/bin/eval-hub"
	@binary_sha=$$(sha256sum "$(BINARY)" | awk '{print $$1}'); printf '%s  eval-hub\n' "$$binary_sha" > "$(ROOT)/bin/eval-hub.sha256"
	@cp -a "$(REPO_ROOT)/src/app/eval-hub/companion/skill" "$(ROOT)/.agents/skills/eval-hub"; chmod 0755 "$(ROOT)/.agents/skills/eval-hub/scripts/eval-hub"
	@binary_sha=$$(sha256sum "$(BINARY)" | awk '{print $$1}'); skill_sha=$$(tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --format=pax --pax-option=delete=atime,delete=ctime -cf - -C "$(ROOT)/.agents/skills/eval-hub" . | sha256sum | awk '{print $$1}'); source_commit=$$(git -C "$(REPO_ROOT)" rev-parse HEAD); bun_version=$$("$(BUN)" --version); files_json="$(FIXED)/files.jsonl"; : > "$$files_json"; while IFS= read -r file; do rel=$${file#"$(ROOT)/"}; digest=$$(sha256sum "$$file" | awk '{print $$1}'); size=$$(stat -c %s "$$file"); jq -nc --arg path "$$rel" --arg sha256 "$$digest" --argjson size "$$size" '{path:$$path,sha256:$$sha256,size:$$size}' >> "$$files_json"; done < <(find "$(ROOT)" -type f -print | LC_ALL=C sort); jq -s --arg version "$(VERSION)" --arg target "$(TARGET)" --arg sourceCommit "$$source_commit" --argjson sourceCommitEpoch "$(SOURCE_DATE_EPOCH)" --arg bunVersion "$$bun_version" --arg binarySha256 "$$binary_sha" --arg skillSha256 "$$skill_sha" '{schema:"eval-hub-companion-v1",version:$$version,target:$$target,sourceRepository:"https://github.com/bioinfornatics/agentic-devlopment",sourceCommit:$$sourceCommit,sourceCommitEpoch:$$sourceCommitEpoch,bunVersion:$$bunVersion,binarySha256:$$binarySha256,skillSha256:$$skillSha256,coreHarnessIncluded:false,files:.}' "$$files_json" > "$(ROOT)/companion.json"; jq -nc --arg version "$(VERSION)" --arg sourceCommit "$$source_commit" --arg bunVersion "$$bun_version" '{bomFormat:"CycloneDX",specVersion:"1.5",components:[{type:"application",name:"eval-hub-companion",version:$$version,properties:[{name:"sourceCommit",value:$$sourceCommit},{name:"bunVersion",value:$$bunVersion}]}]}' > "$(ROOT)/sbom.cdx.json"; jq -nc --arg spdx "$(LICENSE_SPDX)" '{spdx:$$spdx,distributionAllowed:($$spdx!="NOASSERTION"),reviewRequired:($$spdx=="NOASSERTION")}' > "$(ROOT)/LICENSE-ASSERTION.json"; jq -nc --arg sourceCommit "$$source_commit" --argjson sourceCommitEpoch "$(SOURCE_DATE_EPOCH)" --arg target "$(TARGET)" --arg bunVersion "$$bun_version" --arg binarySha256 "$$binary_sha" --arg skillSha256 "$$skill_sha" '{schema:"eval-hub-companion-provenance-v1",sourceCommit:$$sourceCommit,sourceCommitEpoch:$$sourceCommitEpoch,target:$$target,bunVersion:$$bunVersion,binarySha256:$$binarySha256,skillSha256:$$skillSha256}' > "$(ROOT)/provenance.json"
	@tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --format=pax --pax-option=delete=atime,delete=ctime -cf "$(ARCHIVE)" -C "$(ROOT)" .
	@archive_sha=$$(sha256sum "$(ARCHIVE)" | awk '{print $$1}'); printf '%s  %s\n' "$$archive_sha" "$$(basename "$(ARCHIVE)")" > "$(OUTPUT)/SHA256SUMS"
	@cp "$(ROOT)/companion.json" "$(ROOT)/sbom.cdx.json" "$(ROOT)/LICENSE-ASSERTION.json" "$(ROOT)/provenance.json" "$(OUTPUT)/"
	@sha256sum "$(ARCHIVE)" | awk '{print $$1}'
	@rm -rf "$(FIXED)"