# Harness source/runtime separation contract

## Stable invariants

- Authored Goose assets exist only in `src/agents`, `src/skills`,
  `src/recipes`, and `src/plugins`; external skills are lock-controlled inputs.
- Harness manifests, schemas, runtime inventory, source layout, and external
  locks exist under `src/harness`.
- Short Bash and system launchers belong in `src/tooling`; typed automation
  belongs in `src/app/tooling`; application source belongs in `src/app`.
- The evaluation corpus exists under `src/app/eval-hub/evals` and receives
  explicit source, runtime, and evidence roots.
- The root `justfile` is the public operator interface.
- Generated releases exist at `build/harness/runtime/releases/<digest>`, and
  `build/harness/runtime/current` selects one immutable release atomically.
- Root `.agents` and `.goose` are generated discovery projections, never
  canonical inputs or editable source.
- Identical source, locks, and toolchains produce identical projections.
- Verification detects projection drift; rollback changes the selected verified
  release without changing source.
- Release assembly consumes a verified immutable projection.
