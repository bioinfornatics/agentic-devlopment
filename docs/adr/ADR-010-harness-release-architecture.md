# ADR-010: Immutable harness release outside Eval Hub

Status: Accepted for implementation
Decision: 2026-07-28

## Context

Direct source installation mixes authored source, third-party content, build output, installation, and runtime discovery, preventing exact provenance.

## Decision

Build an allowlisted target-specific immutable harness release. Resolve external skills before build using a pinned resolver and lockfile. Bundle or compile TypeScript and Bun, package Python using a locked strategy, and validate and package shell and PowerShell without claiming compilation. Assemble canonical archives with provenance, SBOM, licenses, and checksums. Install under a content digest and atomically switch an installer-owned current pointer.

Eval Hub is excluded from the release. It consumes the installed release manifest and digest. Every installed external skill is included in evaluation inventory because it can alter discovery and behavior.

## Consequences

Installation no longer merges ambient catalogs. Network and compilation move out of installation. Mutable plugin data is initialized outside the release. Linux x86_64 is required for v1; other targets need explicit release-index support. GitHub root migration remains a human gate.
