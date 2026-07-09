# STATE.md - Architecture Decisions

Every active entry is a constraint all future specs must conform to or supersede.

## Decisions

### AD-001 - Recipe naming: workflow verbs
Status: active | Date: 2026-07-09
Decision: Recipe names are workflow verbs (discover, spec, plan, implement, review, verify).
Reason: Verb names describe action; harness prefix couples to implementation detail.

### AD-002 - Spec location: .specs/features/[feature]/spec.md
Status: active | Date: 2026-07-09
Decision: All formal specs at .specs/features/[feature]/spec.md.
Reason: SOTA consensus (spec-kit, TLC, Kiro).

### AD-003 - Apps: TypeScript + pnpm
Status: active | Date: 2026-07-09
Decision: All apps/ packages use TypeScript + pnpm.
Supersedes: Python kg-bootstrap.py, kg-reason.py (deprecated)

### AD-004 - KG visualizer: custom MCP, not apps builtin
Status: active | Date: 2026-07-09
Decision: kg-visualizer is a custom MCP stdio extension, not the Goose apps builtin.
Reason: Different purposes; conflating caused confusion.

### AD-005 - Test framework: vitest
Status: active | Date: 2026-07-09
Decision: vitest for all TypeScript tests in apps/.
Supersedes: node:test usage

### AD-006 - Spec scale: Beads for Micro/Small
Status: active | Date: 2026-07-09
Decision: Micro/Small changes use Beads description as spec. Medium+ require spec.md.
Reason: Auto-sizing (TLC SOTA) avoids overhead for single-file changes.

## Handoff

### 2026-07-09
KG: 167 entities, 206 relations | R1=0, R2=6 by-design, R6=5 historical
Tests: 32/32 passing
Open: 4yd wcag-audit, KG-07 memory builtin, UX skills backlog
Next: bd ready then pick P3 bead or /discover for new feature
