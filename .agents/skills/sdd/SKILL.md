---
name: sdd
description: >
  Spec-Driven Development: product intent, spec-driven development, TDD, operational readiness, and continuous learning.
metadata:
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

## Mode rules

If the request says `plan`, `do not implement yet`, `spec`, or `proposal`, stay in planning mode:

- do not edit files;
- do not create, claim, update, close, or link Beads unless the user explicitly asks to persist the plan;
- inspect only the minimum context needed;
- output proposed Beads graph as titles/dependencies, not executed commands.

Planning outputs must include:

- user/stakeholder;
- desired outcome;
- constraints and assumptions;
- non-goals;
- acceptance criteria;
- risks;
- proposed dependency-aware Beads graph.

Release readiness outputs must use an explicit matrix covering tests, docs, install-script safety, recipe validation, rollback, observability/diagnostics, and open blockers, each marked pass/fail/blocked/unknown.

- Prefer reversible increments.
- Make dependencies explicit.
- Optimize for handoff: every future agent should know current state from Beads.
- Treat quality gates as product requirements, not cleanup.
