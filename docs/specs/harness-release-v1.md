# Harness Release v1

## Scope and objectives

This specification governs O1-O8. The lifecycle is strictly source -> resolve -> build -> package -> install -> run -> evidence. No phase reads mutable output from a later phase.

- O1 separates source, build, package, install, runtime, and evidence.
- O2 requires reproducible archives and manifests.
- O3 locks every external component and rejects undeclared content.
- O4 installs releases atomically with rollback.
- O5 records project commit, lock digest, release digest, toolchains, and component hashes.
- O6 applies methodology and eval rules to internal assets and provenance, license, integrity rules to external assets.
- O7 makes Eval Hub evaluate one immutable installed release, including external skills.
- O8 migrates the rewritten GitHub root only through a human-approved reversible gate.

## Release boundary

The release is an allowlisted runtime bundle containing packaged internal and external skills, agents, Goose recipes, plugins, hooks, and runtime scripts. TypeScript and Bun scripts are bundled or compiled, Python scripts are packaged according to ADR-010, and shell or PowerShell scripts are linted, normalized, permissioned, and packaged.

Eval Hub is not part of the release. Neither are applications, evaluation corpora or results, session databases, mutable plugin databases, WAL or SHM files, caches, dependency trees, or secrets. Eval Hub remains repository tooling and evaluates the assembled release by digest.

## Layout

source: src/{agents,skills,recipes,plugins,app} plus harness manifests
resolve: build/harness/resolve/<lock-digest>
build: build/harness/components/<target>
package: dist/harness/<version>/<target>
install: <prefix>/releases/<release-digest>
active: <prefix>/current points to releases/<release-digest>
evidence: Eval Hub results reference release, lock, and Goose digests

Build and resolution never write into HOME. Installation performs no compilation or network resolution. Runtime never mutates the release directory.

## Inventory and targets

src/harness/runtime-inventory.json is the machine-readable inventory. Every runtime script records language, build policy, runtime owner, and package policy. Linux x86_64 is required for v1. macOS arm64 and Windows x86_64 are planned and must either publish complete artifacts or be explicitly absent from the release index.

## Goose discovery evidence

Canonical sources live under src; projected runtime assets are discovered from .agents/skills, .agents/agents, .agents/plugins, and .goose/recipes, as documented in docs/reference/use-cases/01-init-project.md, docs/reference/getting-started.md, and ADR-008. Installed releases retain these directory shapes through installer-managed activation. Task F must prove the supported activation mechanism with a clean HOME and XDG probe; this spec assumes no undocumented Goose environment variable.

## Ownership

Internal components are authored and quality-gated here. External skills are resolved from immutable upstream revisions and validated for hash, license, compatibility, and evaluation impact. domain-modeling, grill-me, grill-with-docs, and grilling are external. Existing entries in skills-lock.json remain external unless ownership migration is approved.

All installed external skills affect inventory and require behavioral evaluation, dependency or wrapper evaluation, or a machine-readable non-eligibility reason enforced as a gate.

## Threat model

Fail closed against floating revisions, compromised resolver output, path traversal, symlink escape, duplicate names, tampering, undeclared files, permission drift, mutable databases in archives, secrets, interrupted or concurrent installation, ambient catalog contamination, release mutation during evaluation, and publication of a digest different from the evaluated digest.

## Release artifacts

Each target provides a canonical archive, release.json, lock digest, SHA256SUMS, SBOM, third-party licenses, build provenance, and optional signature. Canonical digests normalize paths, ordering, permissions, ownership, and mtimes and exclude wall-clock timestamps.

## Acceptance trace

O1: A D F. O2: B D E I J. O3: B C G. O4: F J. O5: A E H I. O6: B G. O7: H J. O8: K L.