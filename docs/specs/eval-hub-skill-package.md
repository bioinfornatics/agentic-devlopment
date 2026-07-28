# Eval Hub skill companion package

## Decision

Eval Hub ships as an optional companion artifact and Agent Skill, never as part of the core harness release. This preserves evaluator independence while making invocation discoverable. The companion release is versioned beside the core release and can reference, but never contain or mutate, a core harness.

## Layout

```text
eval-hub-companion-<version>-linux-x86_64.tar
├── bin/eval-hub
├── bin/eval-hub.sha256
├── .agents/skills/eval-hub/
│   ├── SKILL.md
│   ├── references/
│   └── scripts/eval-hub
├── companion.json
├── SHA256SUMS
├── sbom.cdx.json
├── LICENSE-ASSERTION.json
└── provenance.json
```

## Build

Compile `apps/eval-hub/src/index.ts` with pinned Bun 1.3.12 at a deterministic absolute work/output path. Build twice at the same path and compare bytes. Linux x86_64 is required in v1; other targets are absent unless explicitly published.

## Runtime

The launcher resolves an explicit companion root or its installed layout, verifies `bin/eval-hub.sha256`, and `exec`s the binary. It never downloads, resolves dependencies, compiles, or alters the core release. `--help` and `--companion-self-check` are clean-HOME bounded probes.

## Provenance and distribution

The package manifest records target, source commit, Bun version, binary and skill digests, archive file inventory, `coreHarnessIncluded: false`, and license assertion status. SHA256SUMS, CycloneDX SBOM, and normalized provenance are sibling artifacts. The core harness source manifest continues to exclude `apps/eval-hub`.

## Agent Skills compatibility

The package follows <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>. Goose loads `.agents/skills/eval-hub/SKILL.md`; supporting references and launcher are relative to that skill.

## Acceptance

Missing or corrupt binary fails before execution; paths with spaces work; child exit codes propagate; clean HOME needs no node_modules; archives contain no source/node_modules/database/cache; package bytes reproduce at a fixed build path; CI publishes companion files separately from the core harness archive.
