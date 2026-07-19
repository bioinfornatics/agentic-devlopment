# Spec: Design Recipe — UX Research, UI Design, and GDD

> Status: Retro-spec (brownfield)
> Created: 2026-07-18
> Scope: feat-design-recipe

## Context

The `/design` recipe orchestrates two sequential specialist phases: Phase 1 (UX research via `ux-researcher`) followed by Phase 2 (UI design, accessibility, and design systems via `ui-designer`). The `agentic-ux` skill activates Generative-Driven Design (GDD) for AI interface work. This spec documents behavioral contracts extracted from the implemented recipe.

---

## Acceptance Criteria

### AC-DESIGN-01 — Phase sequence enforced
WHEN the design recipe runs
THEN Phase 1 (ux-researcher) MUST complete before Phase 2 (ui-designer) begins
AND the two phases MUST NOT run simultaneously

### AC-DESIGN-02 — First visible output declared before any tool call
WHEN the design recipe starts
THEN a First Visible Output block MUST be emitted before any tool call
AND the block MUST declare: design scope, AI interface patterns (yes/no), and starting phase

### AC-DESIGN-03 — Browser evidence before UI findings
WHEN Phase 2 produces UI or accessibility findings
THEN browser evidence MUST be captured before stating any finding
AND findings derived only from static file inspection MUST be labelled as `code-inspection-only` with an explicit confidence caveat

### AC-DESIGN-04 — GDD decision block for AI interface patterns
WHEN the design target includes AI-generated content, uncertainty signalling, or agentic UI components
THEN the `agentic-ux` skill MUST be loaded in Phase 2
AND a "GDD decision" block MUST be emitted before any design recommendations
AND the block MUST address: trust calibration approach, progressive disclosure strategy, and safety UX patterns applied

### AC-DESIGN-05 — WCAG 2.2 AA violations separated from recommendations
WHEN Phase 2 produces an accessibility assessment
THEN WCAG 2.2 AA violations MUST be reported as a distinct section from visual/content recommendations
AND each violation MUST reference the specific success criterion (e.g., 1.4.3 Contrast Minimum)

### AC-DESIGN-06 — Impact-ranked findings
WHEN Phase 2 produces a findings list
THEN findings MUST be ordered by user impact
AND ordering by ease of detection or discovery order is NOT permitted

### AC-DESIGN-07 — Beads follow-up proposed for actionable issues
WHEN the design recipe identifies an issue requiring implementation work
THEN a `bd create` command MUST be proposed for each actionable finding
AND the command MUST specify title, description, priority, and assignee
