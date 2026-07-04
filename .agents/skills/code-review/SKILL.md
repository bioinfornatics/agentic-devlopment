---
name: code-review
description: >
  Practical code review for agentic development: correctness, tests, security, maintainability, Beads hygiene, and handoff quality.
metadata:
  version: 3.0.0
  evals: references/evals.json
---

# Code Review Skill

Review in this order:

1. **Intent fit** — Does the change satisfy the bead/acceptance criteria?
2. **Correctness** — Edge cases, error handling, concurrency, data consistency.
3. **Tests** — Are regressions covered? Are tests meaningful and local?
4. **Security** — Injection, secrets, authz/authn, unsafe IO, supply chain.
5. **Maintainability** — Simplicity, names, boundaries, public API stability.
6. **Operations** — logs, metrics, migrations, rollback, performance.
7. **Beads hygiene** — claimed/closed status, discovered work linked, no hidden TODOs.

Output format:

- Verdict: pass / pass-with-nits / block.
- Findings by severity: critical, high, medium, low.
- Missing validation.
- Suggested exact commands or beads.
