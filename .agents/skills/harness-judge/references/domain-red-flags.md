# Harness Judge — Red Flags Reference

> Loaded when a detailed red flag checklist is needed during Domain scoring.
> Trigger: auditing any domain and needing the complete red-flag inventory.

## 17. Red Flags

- No citation to source files, turns, tool calls, or command output.
- No validation command for a change that has an available validator.
- Hand-edited generated sections.
- Confusion between loaded agent and delegated agent.
- AD-001 recipe pattern ignored.
- Success claimed despite failing validation.
- Self-approval by implementer or reviewer.
- Retrospective plan written after mutation.
- Scope creep or unrelated refactor.
- Verifier theater: review says looks good without evidence.
- Missing or late Orchestration decision.
- Missing final handoff or audit for delegated work.
- Agent uses a mandatory skill methodology without loading or requesting that skill.
- Recipe routing does not map tasks to mandatory agents or specialists.
- Orchestration flow cannot reach validation, handoff, or success criteria.
- Multi-phase recipe or agent has no hard gate between phases — Phase N+1 can start before Phase N output is verified.
- Conditional routing condition is vague or unobservable — the branch cannot be evaluated from transcript evidence.
- Phase output contract is unnamed — the consuming phase has no declared prerequisite to check before starting.
- Persona description contradicts the operating process (e.g., "read-only" persona with mutating steps).
- Skill declared in Required Skill Load cannot be justified by the persona description — decorative load.
- Agent model assignment inverted relative to flow-phase stakes (Sonnet on orchestration, Opus on execution).
- Maker and checker share the same mandatory skills and operating scope — checker is not genuinely independent.
- Agent persona does not match the SDD/TDD/GDD phase it occupies in any recipe's AD-001 routing declaration.
- Instruction file too short — SKILL.md < 50 lines, agent < 80 lines, or recipe instructions < 40 lines: stub that cannot carry real methodology (HJ052/HJ053/HJ054).
- Instruction file too long — SKILL.md > 700 lines, agent > 500 lines, or recipe > 400 lines: always-loaded context bloat or embedded methodology (HJ052/HJ053/HJ054).
- Instruction quality scores 0 or 1 — goal stated with no procedural steps (HJ048).
- Named technique absent where required: no GKP before action steps, no CoT for complex multi-step decisions, no few-shot anchors for judgment-heavy criteria (HJ047).
- Internal contradiction in instructions — two directives in the same artifact conflict (HJ049).
- Front-loading violation — a mandatory constraint first appears after the step that needs it (HJ049).
- Aspirational hedge on a non-negotiable constraint: "try to", "where possible", "as much as you can" (HJ049).
- All-caps imperative (MUST/ALWAYS/NEVER) without accompanying reasoning — model cannot generalise to edge cases (HJ049/Explain-the-Why).
- Skill description in first or second person ("I can…", "You can use this to…") — breaks discovery in third-person context injection (HJ056).
- Skill description missing exclusion clause — adjacent-domain mis-triggering risk (HJ057).
- Skill body has no Gotchas section — only documents happy path; real failure modes invisible to model (HJ058).
- Nested reference chain: SKILL.md references A.md which references B.md — two hops break progressive disclosure (HJ059).
