# Loop Engineering observable conformance contract

Version 1.0. Eval-hub is a read-only observer of this contract; it reports conformance from Goose session and Beads run evidence and neither defines policy nor authorizes transitions.

## Phases and evidence

Normal order: Trigger, Planner, Builder, Independent Verifier, Memory, Manager, Controller.

| Phase | Observable evidence |
|---|---|
| Trigger | Beads run/task identity and objective. |
| Planner | Specification reference and falsifiable acceptance criteria. |
| Builder | Successful builder session/delegation. |
| Independent Verifier | Successful later verifier delegation with a different session identity. |
| Memory | Sanitized memory/evidence-summary event in run evidence. |
| Manager | Backlog/next-work event in run evidence. |
| Controller | Exactly one typed transition after applicable phases. |

Missing session or Beads evidence is inconclusive, not a pass. Present invalid, duplicated, or reordered evidence fails. A normal path requires all phases. An early path may stop before Builder only when exactly one explicit Controller transition records WAIT, REJECT, REPLAN, ESCALATE, or ABORT after Trigger and Planner. Other phases are reported not applicable, never silently omitted. COMPLETE, CONTINUE, and REWORK are not early-terminal rationales. Builder and verifier identities must be non-empty and different. Beads remains the durable control plane; eval-hub reads without mutation. Reports use stable rule IDs and are run artifacts.

## Bounded invocation and transition authorization

Each invocation performs zero or one applicable Builder increment and, when a build ran, exactly one fresh Independent Verifier increment. It then performs Memory, Manager, and Controller inline, persists exactly one of CONTINUE, REWORK, REPLAN, WAIT, COMPLETE, ESCALATE, or ABORT, returns, and exits. A later invocation is scheduler- or user-driven from durable Beads state; parameters do not reset persisted counters. WAIT exits with a resume condition and never polls.

Before delegation and immediately before the single transition is persisted, the controller calls node src/app/tooling/dist/loop-transition-guard.js with a snapshot assembled from durable Beads fields and an explicitly supplied current UTC instant. A denied decision is authoritative. loop_iteration increments only after a completed applicable build-and-fresh-verification increment. The no-progress count increments or resets only after such an increment and otherwise persists unchanged.
