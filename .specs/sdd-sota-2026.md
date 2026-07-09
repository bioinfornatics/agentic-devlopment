# SDD SOTA Research 2026

Source: Böckeler Oct 2025 via Fowler, spec-kit GitHub, Kiro AWS, TLC v3.2, Tessl

## Three-Tier Taxonomy

| Level | Description |
|---|---|
| Spec-first | Spec guides current task only (Kiro, spec-kit) |
| Spec-anchored | Spec persists as living artifact (TLC, aspirational) |
| Spec-as-source | Spec = only human file, code generated (Tessl beta) |

Our harness targets: spec-anchored.

## File Naming Consensus

| File | spec-kit | Kiro | TLC | Our harness |
|---|---|---|---|---|
| Requirements | spec.md | requirements.md | spec.md | spec.md |
| Architecture | plan.md | design.md | design.md | design.md |
| Tasks | tasks.md | tasks.md | tasks.md | tasks.md |
| API contracts | contracts/s.md | inline | inline | contracts/s.md |
| ADR log | constitution.md | product.md | STATE.md | STATE.md |
| UI components | none | none | none | components.md UI only |

## Key Insights

1. spec.md wins — unanimous across tools
2. STATE.md = highest-value addition (spec-anchored)
3. Auto-sizing avoids sledgehammer on small changes
4. contracts/ directory for API-heavy features
5. [FEAT]-NN IDs are SOTA, better than spec-kit FR-NNN
6. design.md > plan.md
7. components.md for UI: Atomic Design + ASCII art mockups

## UI features: components.md pattern

For features with UI screens, add components.md with:
- ASCII art mockup of each screen
- Atomic Design breakdown: Atoms, Molecules, Organisms, Templates, Pages
- UX intent per component (what user goal it serves)
- Interaction states (hover, focus, error, loading)

Our harness has no UI screens: use contracts/ + design.md instead.
