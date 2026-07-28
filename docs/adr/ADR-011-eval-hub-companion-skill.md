# ADR-011: Ship Eval Hub as an optional companion skill

- Status: Accepted
- Decision: 2026-07-28

## Context

Eval Hub evaluates the harness. Embedding it in the core archive would blur evaluator/system boundaries, but requiring source-tree Node invocation makes distribution inconvenient. Agent Skills support instructions, references, and scripts in one discoverable folder.

## Decision

Publish a target-specific standalone Bun binary and an `eval-hub` skill together as a separate companion artifact. The launcher verifies the binary digest before execution. The core harness release continues to exclude Eval Hub. CI may publish both artifacts under one GitHub release, with separate manifests and digests.

## Consequences

The companion can be invoked through Goose skill discovery without node_modules. Its digest is distinct from harness and Goose digests. Native functionality must be validated in package tests. Linux x86_64 is the required initial target. Lack of a project-level license is represented as a fail-closed license assertion requiring explicit distribution authorization, rather than inventing a license.
