## 11.5 Persona-flow fit (HJ045–HJ046)

Run when scope=all or scope=agents. Evaluate each agent persona against the declared SDD/TDD/GDD flow and its maker/checker pairing.

**SDD/TDD/GDD flow reference map:**

| Phase | Agent(s) | Model | Input expected | Output produced |
|---|---|---|---|---|
| Discover | product-owner + ux-researcher (UI) | Opus + Sonnet | User intent, product vision | PRD ≥85/100, personas, user stories, Beads epic |
| Spec | architect (+ tdd-guide testability check) | Opus + Sonnet | PRD / discovery.md | spec.md with WHEN/THEN/SHALL ACs and [FEAT]-NN IDs |
| Plan | planner (+ architect for arch) | Sonnet + Opus | spec.md, AC IDs | Beads dependency graph with ordered `bd` commands |
| RED | tdd-guide | Sonnet | spec.md ACs, bead | Failing tests confirmed RED; no implementation code |
| GREEN/REFACTOR | implementation-worker | Sonnet | RED test output, bead claimed | Passing tests, minimal implementation, handoff |
| Review | review-critic | Sonnet | Diff, bead ACs | APPROVE / PASS-WITH-NITS / BLOCK verdict with evidence |
| Verify | qa-automation + ui-designer (UI/web) | Sonnet | Implementation complete | Coverage ≥80%, CI gates, a11y report |
| Escalation | principal-engineer | Opus | 2+ BLOCK verdicts | APPROVE / APPROVE-WITH-CONDITIONS / BLOCK + blast radius |
| Audit | harness-judge | Sonnet | Harness artifacts / session transcript | PASS / PARTIAL / FAIL verdict with domain scores |

**Persona-flow fit questions (HJ045):**

- Does the agent's persona description match its declared flow position? (e.g., `product-owner` persona at the Discover phase should emphasise user story authorship and PRD quality, not implementation)
- Does the agent's output format match what the next-phase agent's input expects? (e.g., `tdd-guide` produces failing test output that `implementation-worker` consumes — is this handoff explicit in both agents?)
- Is the model assignment coherent with the phase's stakes? Higher-stakes decision phases (Discover, Spec, Escalation) use Opus; execution phases (RED, GREEN, Review, Verify) use Sonnet.
- Does the agent's do-not-invoke section correctly exclude it from phases where another agent is authoritative?

**Maker/checker independence questions (HJ046):**

- Does the checker's model tier match or exceed the maker's? (review-critic Sonnet checks implementation-worker Sonnet — same tier is acceptable; principal-engineer Opus escalates above review-critic Sonnet — correct upgrade path)
- Do the checker's mandatory skills differ from the maker's mandatory skills? Shared skills suggest possible scope overlap.
- Is the checker's operating scope explicitly non-overlapping with the maker's? (implementation-worker writes code; review-critic reads diff — non-overlapping)
- Can the checker reach a BLOCK verdict without access to the maker's internal reasoning? (checker must judge from observable output only)

Scoring HJ045: PASS = every agent's persona, model, input, and output align with the flow map. PARTIAL = one agent's persona is at the right phase but its output format or model assignment is inconsistent. FAIL = an agent is positioned at a phase its persona cannot serve, or its model assignment is inverted relative to the phase's stakes.

Scoring HJ046: PASS = all maker/checker pairs have non-overlapping mandatory skills and the checker can reach a verdict from observable output alone. PARTIAL = skills partially overlap but the checker's operating scope is still distinct. FAIL = checker and maker share the same mandatory skills and operating scope with no explicit differentiation.
