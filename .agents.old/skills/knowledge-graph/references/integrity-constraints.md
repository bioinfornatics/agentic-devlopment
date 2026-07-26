# Integrity constraints

Validate at least these rules:

1. Every active agent has at least one responsibility.
2. Every active responsibility has exactly one accountable owner unless justified.
3. Every agent involved in a recipe receives or produces an artifact, decision, or verification result.
4. Every active agent loads a relevant skill or documents why none is required.
5. Every active skill is consumed by an agent or recipe, or has a justified cross-cutting role.
6. Every active recipe implements a lifecycle phase or documents a cross-cutting role.
7. Every active recipe has entry and exit criteria.
8. Every delegated task has an assigned agent, inputs, outputs, acceptance criteria, verification, and downstream consumer.
9. Every mandatory artifact has a producer and consumer.
10. Every mandatory gate has a verification method that produces evidence.
11. Prohibited self-review and self-approval paths do not exist.
12. Every work task belongs to an epic or has an explicit exception.
13. Every target-state recommendation links to a finding and decision.
14. Every inferred assertion has confidence.
15. Every file-backed buildtime entity links to a file node.
16. Every contradiction remains represented explicitly.
17. Current-state and target-state assertions are not conflated.
18. Core orchestration paths terminate or reach bounded retry, failure, or escalation states.

A structural change is incomplete until the exported graph passes validation and critical violations are resolved or recorded as blockers.
