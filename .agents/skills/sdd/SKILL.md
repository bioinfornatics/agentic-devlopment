---
name: sdd
description: >
  Spec-Driven Development: product intent, spec-driven development, TDD, operational readiness, and continuous learning.
version: 2.0.0
---

# SDD — Spec-Driven Development

SDD is a lightweight development method over the Goose+Beads harness.

## Loop

1. **Intent** — clarify user, outcome, constraints, non-goals.
2. **Spec** — acceptance criteria, risks, data model/API/UI contracts.
3. **Graph** — encode work in Beads with dependencies and gates.
4. **TDD** — failing test/spec check before implementation when practical.
5. **Implement** — smallest coherent slice.
6. **Verify** — tests, review, UX/security/perf as relevant.
7. **Learn** — remember durable facts as short pointer memories when possible, and file follow-up beads for work.

## Principles

- Prefer reversible increments.
- Make dependencies explicit.
- Optimize for handoff: every future agent should know current state from Beads.
- Treat quality gates as product requirements, not cleanup.
