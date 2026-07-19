# Graph Diff

Target graph keeps the current L1/L2/L3 component set by default but proposes these changes:

- Add deterministic preflight node for provider/model/subagent availability addressing F-HIGH-002.
- Add active-vs-example SPEC_DEVIATION classification addressing F-HIGH-001.
- Add reproducible audit baseline gate addressing F-MED-001.
- Add Beads immutable snapshot input path addressing F-CRIT-001.
- Add alias/migration decision for `agentic-devlopment` addressing F-MED-002.

No automatic removal is recommended without a clean Beads/runtime usage snapshot.
