# ADR-012: Separate harness source from runtime projection

- Status: Accepted
- Decision: 2026-07-28

## Context

Editable assets and generated discovery paths require different ownership.
Treating runtime projections as source makes validation, packaging, and release
inputs ambiguous.

## Decision

Canonical authored harness assets live in `src/agents`, `src/skills`,
`src/recipes`, and `src/plugins`. Harness manifests, schemas, inventory, and
external locks live in `src/harness`.

Short Bash and system launchers live in `src/tooling`; typed automation
implementations and applications live in `src/app/tooling` and `src/app`.
The root `justfile` is the public operator interface.

The evaluation corpus lives in `src/app/eval-hub/evals`. Evaluation tools use
explicit source, runtime, and evidence roots; they do not infer source from a
runtime projection.

Generated releases live under `build/harness/runtime/releases/<digest>`.
`build/harness/runtime/current` is activated atomically, and root `.agents`
and `.goose` point to that release. Generated paths are never edited as source.

## Consequences

Source ownership is unambiguous, runtime output is reproducible, external inputs
remain lock-controlled, and release assembly consumes an immutable projection.
