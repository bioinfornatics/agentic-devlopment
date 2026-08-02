---
normative: false
document_type: reference
---

# Source/runtime operations reference

This is a non-normative operational reference. ADR-012 and the source/runtime
contract define the invariants.

## Canonical locations

Edit harness assets in `src/agents`, `src/skills`, `src/recipes`, and
`src/plugins`. Manifests and locks are in `src/harness`; short system launchers are in
`src/tooling`; typed automation is in `src/app/tooling`; application source is in `src/app`; the eval corpus is in
`src/app/eval-hub/evals`. Root `.agents` and `.goose` are generated outputs.

## Commands

Install the pinned Just command runner, then use the root `justfile`:

~~~bash
just bootstrap-runtime
just verify-runtime
just activate-runtime
just rollback-runtime
just clean-runtime
~~~

Bootstrap resolves locked external inputs, builds packages, projects, activates,
and verifies a content-addressed release. Activation selects a built digest.
Rollback selects the previous verified release. Cleanup removes inactive generated
state while retaining the active and previous releases.

For a fresh checkout:

~~~bash
pnpm --dir src/app install --frozen-lockfile
just bootstrap-runtime
goose skills list
node src/app/tooling/dist/check-consistency.js
~~~

External resolution needs network access unless a verified cache is supplied.
Published release installation remains offline.

## Troubleshooting

- **Runtime drift:** run `just verify-runtime`; discard generated mutations and
  run `just bootstrap-runtime`.
- **Integrity mismatch:** verify the external commit, path, and digest; never
  update a digest blindly.
- **Missing discovery links:** run `just activate-runtime`, then
  `just verify-runtime`.
- **Bad active release:** run `just rollback-runtime` and verify again.
- **Missing Just:** install the repository-pinned version; do not substitute a
  different command runner.
- **Unavailable package runtime:** install the pinned runtime and repeat bootstrap;
  release builds do not use source fallbacks.
