---
name: harness-judge
description: >
  Load before any LLM-as-judge evaluation of the agentic development harness.
  Provides evidence-first scoring methodology, bias controls, layer-delta procedure,
  numbered checklists, and domain rubrics for prompt/context/loop engineering,
  skills, agents, recipes, SDD/TDD/GDD frameworks, and orchestration.
metadata:
  version: 1.1.0
---

# Harness Judge — Evaluation Methodology

Use this skill when judging completed harness sessions or static harness artifacts. It is methodology, not persona. The harness-judge agent supplies the persona; this skill supplies the checklist, scoring protocol, and calibration rules.

## 1. Research Grounding

LLM-as-judge is useful because agentic development output is a trajectory of decisions and tool calls, not a text string that lexical metrics can grade. Use semantic judgment, but constrain it with explicit rubrics and observable evidence.

| Source family | Principle used here |
|---|---|
| MT-Bench / Chatbot Arena | Pairwise evaluation, position and verbosity bias awareness, judge-human agreement concerns |
| G-Eval | Criteria-first structured scoring before aggregate verdict |
| Prometheus | Custom rubric, reference answer, feedback and evidence before score |
| AgentBench-style evals | Judge process trajectories and tool-use order, not final answer only |
| HELM / OpenAI Evals | Reproducible scenarios, versioned prompts, transparent aggregation |
| Loop-engineering references | Stop conditions, circuit breakers, max attempts, state discipline |
| Goose harness conventions | .agents compatibility, AD-001 recipe patterns, layer-delta eval model |

## 2. Mandatory Scoring Protocol

Always score in this order:

1. Identify subject and evaluation mode.
2. Identify applicable domains A-F.
3. Read all available evidence before scoring.
4. Classify each criterion type.
5. Run the self-bias guard.
6. Score each criterion independently with evidence.
7. Apply hard gates and caps.
8. Compute aggregate verdict.
9. Report improvements and red flags.

Never start with the aggregate verdict.

## 3. Evidence Rules

Every scored criterion requires evidence. Prefer exact tool calls, command output, artifact path and quote, transcript turn and quote, structured eval result, or explicit not found.

Rules:

- If evidence is missing, write not found and score FAIL unless the criterion is truly N/A.
- Do not infer intent.
- Timing matters: correct action in the wrong order is usually PARTIAL.
- Exact required literals are binary: PASS or FAIL only.
- Claims such as validated or looks good do not count without observable command output or cited evidence.

## 4. Bias Guard

| Bias | Failure mode | Mitigation |
|---|---|---|
| Positional bias | Prefer first or second item in pairwise comparison | Score each condition independently; swap order for close calls when feasible |
| Verbosity bias | Prefer longer outputs | Score criteria, not length; penalize context bloat |
| Style bias | Prefer Markdown polish | Reward only rubric-relevant format |
| Sycophancy | Assume expected layer should win | Allow neutral and negative deltas |
| Self-enhancement | Prefer judge-like language | Anchor to quoted evidence |
| Circularity | Same model family judges itself | Prefer stronger or different judge model; calibrate with human labels where possible |
| Holistic compression | Verdict first, justification after | Enforce criteria-before-verdict |

## 5. Criterion Types

| Type | Scoring | Examples |
|---|---|---|
| Binary-verbatim | PASS/FAIL | Exact Scoped plan, Handoff, Orchestration decision |
| Binary-presence | PASS/FAIL | Bead claimed before write; validation command run |
| Ordered-binary | PASS/PARTIAL/FAIL | bd prime appears but late |
| Gradient-quality | PASS/PARTIAL/FAIL or 0-4 | Methodology clarity, synthesis quality |
| Gate | Caps verdict | Recipe validation fails; self-approval; missing evidence |
| Pairwise-delta | POSITIVE/NEUTRAL/NEGATIVE | Skill vs no-skill, agent+skills vs skills-only |

## 6. Scoring Scale

PASS means fully satisfies criterion with correct evidence and timing. PARTIAL means partly satisfies criterion, weakly evidenced, or correct but late. FAIL means absent, contradicted, harmful, malformed, or unverifiable. N/A means not applicable and requires a reason. Optional numeric mapping: 0 absent or harmful, 1 weak, 2 partially adequate, 3 good, 4 excellent.

## 7. Hard Gates and Caps

- No evidence for a required claim means criterion cannot PASS.
- Self-approval by an agent that should be independently reviewed means overall verdict FAIL.
- Recipe validation fails means Domain D cannot PASS.
- AD-001 recipe pattern violation means Domain D cannot PASS.
- Missing exact required literal means that criterion FAILS; two or more such failures normally cap aggregate at FAIL.
- Hand-edited generated sections means relevant artifact integrity criterion FAILS.
- Summoned agents listed as recipe eval in-session agents means Domain D FAIL.
- Validation theater caps validation-related criteria at FAIL.

## 8. Numbered Harness Judge Checklist

| ID | Domain | Criterion |
|---|---|---|
| HJ001 | Cross | Evidence is cited for every score |
| HJ002 | Cross | Scope is preserved; no unrelated preferences dominate the judgment |
| HJ003 | Cross | Correct evaluation mode is identified |
| HJ004 | Cross | Baseline/enhanced layer comparison is correct |
| HJ005 | Cross | Validation commands/results are considered |
| HJ006 | Cross | Generated sections are not hand-edited |
| HJ007 | A | Prompt role, task, non-goals, and output format are judgeable |
| HJ008 | A | Context loading is minimal, relevant, and progressively disclosed |
| HJ009 | A | Operating loop has observe to decide to act to validate structure |
| HJ010 | A | Exit, stop, success criteria, max iterations, and escalation triggers are explicit |
| HJ011 | B | Skill file is Goose-compatible and named correctly |
| HJ012 | B | Skill description says when to load it |
| HJ013 | B | Skill methodology is concrete, imperative, and single-responsibility |
| HJ014 | B | Skill supports verification with observable evidence |
| HJ015 | C | Agent file is Goose-compatible and named correctly |
| HJ016 | C | Agent invocation and do-not-invoke boundaries are explicit |
| HJ017 | C | Agent output format and operating process are concrete |
| HJ018 | C | Agent avoids self-approval and unauthorized delegation |
| HJ019 | D | Recipe validates with goose recipe validate |
| HJ020 | D | Recipe follows one AD-001 pattern exactly |
| HJ021 | D | Recipe eval JSON lists only in-session agents |
| HJ022 | D | Recipe delegates methodology to skills rather than embedding broad methodology |
| HJ023 | E | SDD/TDD/GDD sequence evidence is visible where applicable |
| HJ024 | E | Requirements/specs/tests are traceable by stable IDs |
| HJ025 | E | Validation is meaningful, not verifier theater |
| HJ026 | F | Orchestration preserves recipe to agent to skill layering |
| HJ027 | F | Orchestration decision appears before delegation when required |
| HJ028 | F | Delegated scopes are non-overlapping or explicitly sequenced |
| HJ029 | F | Orchestrator synthesizes and audits delegate outputs |
| HJ030 | F | Circuit breakers and escalation paths exist |
| HJ031 | Cross | Exit/stop/success criteria are well defined for the audited artifact or session |
| HJ032 | C | Agent mandatory skill contract is explicit, justified, and verifiable |
| HJ033 | D | Recipe mandatory agent and task routing contract is explicit and AD-001 compliant |
| HJ034 | F | Orchestration flow is coherent from recipe to agent to skill to validation to handoff |

## 9. Domain A — Prompt / Context / Loop Engineering

Prompt engineering questions:

- Is the role specific enough to change behavior?
- Are task boundaries and non-goals explicit?
- Is the expected output format concrete?
- Are success and failure conditions observable?
- Are exit criteria, stop criteria, and success criteria explicitly defined?
- Are imperative instructions used instead of vague aspirations?
- Are ambiguity and missing-context behaviors specified?
- Are prompt-injection and instruction-conflict defenses present?
- Are examples or calibration anchors included for subtle judgments?

Context engineering questions:

- Does the artifact specify what context is required?
- Does it avoid loading unrelated context?
- Does it use progressive disclosure via references, scripts, or assets where appropriate?
- Does it distinguish durable state from temporary context?
- Does it preserve critical constraints across turns?
- Does it require checking local project rules before inventing conventions?
- Does it cite sources when making claims?

Loop engineering questions:

- Is there an explicit observe to decide to act to validate loop?
- Is there one clear goal and watched scope?
- Are max attempts, max iterations, and early-exit criteria defined?
- Is success defined independently from merely exhausting the loop?
- Are pause or kill criteria defined?
- Are stop conditions distinct from success conditions and escalation conditions?
- Are human escalation triggers defined?
- Are state read/write expectations defined where the loop is durable?
- Are risky paths denied or gated?
- Does the loop avoid infinite fix loops and verifier theater?

Loop readiness: L0 intent only; L1 report-only; L2 assisted action with verifier; L3 unattended action with safeguards, budgets, kill switch, and escalation.

### A4. Exit / Stop / Success Criteria

For every artifact or session, explicitly judge whether completion is well defined.

Questions:

- What observable state means the work is successful?
- What exact output, artifact, validation result, or handoff proves success?
- When should the agent stop because the task is complete?
- When should the agent stop because continuing would be unsafe, out of scope, too costly, or low confidence?
- When should the agent escalate to a human or another specialist instead of continuing?
- Are success criteria, stop criteria, and escalation criteria separate and non-conflicting?
- Are criteria measurable enough for another judge to verify them from transcript or file evidence?

Red flags:

- Success is phrased as vague intent such as "do a good job" or "improve quality".
- Stop condition is only "when done" with no observable done state.
- Loop has retries but no max attempts, budget, kill switch, or escalation.
- Agent continues exploring after final handoff or after validation is sufficient.
- Agent treats failure, blocked state, and success as the same final outcome.

## 10. Domain B — Skills

Use for .agents/skills/name/SKILL.md.

Compatibility questions:

- Does the file exist at .agents/skills/name/SKILL.md?
- Does YAML frontmatter parse?
- Are name, description, and metadata.version present?
- Does name match the directory?
- Is the body non-empty?
- Is the skill visible through goose skills list when available?

Quality questions:

- Is the description short, explicit, and model-facing?
- Does the description explain when to load the skill?
- Is the skill single-responsibility?
- Is methodology procedural and imperative?
- Are ordered steps numbered where order matters?
- Are examples, gotchas, red flags, or verification checks present?
- Are long references moved to references/ where useful?
- Is deterministic repeated logic moved to scripts/ where useful?
- Are templates/assets moved to assets/ where useful?
- Does the skill avoid becoming an agent persona?
- Does the skill produce observable behavior that can improve Layer 1 vs Layer 0?

Skill red flags: broad aspirational description; vague methodology; no verification checklist; duplicate content; large always-loaded reference dump; no trigger conditions.

## 11. Domain C — Agents

Use for .agents/agents/name.md.

Compatibility questions:

- Does YAML frontmatter parse?
- Are name, description, and usually model present?
- Does name match the file stem?
- Are standard sections present: Prompt Defense Baseline, Your Role, When to Invoke, Operating Process, Output Format, Gotchas, Reference?

Quality questions:

- Is the persona specific and coherent?
- Does the description explain when to invoke the agent?
- Are invoke and do-not-invoke cases specific and useful?
- Are required skills explicit and verifiable?
- Does the agent explicitly ask to load each mandatory skill before applying that skill methodology?
- Are mandatory skills justified by the agent role rather than copied as decoration?
- Is the operating process phased and concrete?
- Is the output format strict enough to judge?
- Are circuit breakers and escalation paths present for loops?
- Is maker/checker separation explicit where needed?
- Does the agent avoid approving its own work?
- Does the agent avoid spawning subagents unless it is the orchestrator?

Agent red flags: overlapping persona; no do-not-invoke section; free-form output; validation claims without evidence; specialist delegates work; reviewer approves work it produced.

## 12. Domain D — Recipes

Use for .goose/recipes/*.yaml and .goose/recipes/subrecipes/*.yaml.

Compatibility questions:

- Does goose recipe validate file pass?
- Are version, title, description, instructions, and prompt present?
- Are parameters valid and descriptive?
- Are extensions valid and necessary?
- Do subrecipe paths exist?
- Is settings.max_turns sensible for the workflow?

AD-001 pattern questions:

- Is the recipe clearly one of Specialist, Orchestration, Skill-only?
- Does the recipe declare the mandatory in-session agent and any delegated specialists separately?
- Does each delegated task map to the correct specialist, expected output, and read/write scope?
- Specialist pattern: does the session load the specialist agent in-session and not the orchestrator?
- Orchestration pattern: does the session load only the orchestrator in-session and delegate specialists?
- Skill-only pattern: does the session load no agent?
- Does eval JSON list only in-session agents?
- Are summoned or delegated agents excluded from eval JSON agents?
- Are declared skills real .agents/skills/name/SKILL.md skills?

Quality questions:

- Does the recipe define first-visible-output expectations?
- Does it define completion and handoff conditions?
- Does it avoid embedding methodology that belongs in skills?
- Are parameter values handed to subrecipes explicitly?
- Is the workflow deterministic enough for evaluation?
- Are validation commands included where relevant?

Recipe red flags: validation failure; orchestrator and specialist in same session; delegated agents listed as in-session eval agents; broad methodology embedded; missing completion condition.

## 13. Domain E — Frameworks

Spec-Driven Development questions:

- Was a spec created or updated before implementation?
- Are requirements written as observable acceptance criteria?
- Are stable IDs used?
- Are implementation changes traceable to requirements?
- Are tests anchored to acceptance criteria?
- Are architecture decisions recorded when rules change?

Test-Driven Development questions:

- Is RED to GREEN to REFACTOR sequence visible?
- Was a failing test written or identified before implementation?
- Are tests meaningful rather than superficial?
- Are negative or error-path cases considered?
- Is validation run and output reported?
- Is regression risk addressed?

Generative-Driven Design questions:

- Is generation constrained by goals, references, and evaluation criteria?
- Are multiple options generated when exploration is needed?
- Are trade-offs compared explicitly?
- Is the final selection grounded in requirements?
- Is there human, rubric, or judge validation?

Framework red flags: implementation before spec when SDD is required; tests deferred without reason; verifier only reads code; acceptance criteria lack anchors; generated design lacks comparison.

## 14. Domain F — Orchestration

### F1. Orchestration Flow Logic

When judging orchestration, evaluate the complete flow contract, not only whether a delegate call exists.

Questions:

- Is the pyramid preserved: recipe to agent to skill?
- Does each recipe state which skills must be loaded and which agent is in-session?
- Does each recipe distinguish in-session agents from delegated or summoned specialists?
- Does each agent state its mandatory skills and explicitly ask to load them before using their methodology?
- Does each delegated task map to the correct specialist persona and not to a generic worker by convenience?
- Are task boundaries, file scopes, read/write permissions, and expected outputs clear before delegation?
- Are delegated write scopes non-overlapping or explicitly sequenced?
- Does the orchestrator synthesize and audit subagent outputs instead of forwarding them raw?
- Is validation reachable after the delegated work completes?
- Is the final handoff reachable and tied to explicit success, stop, and escalation criteria?

Scoring guidance:

- PASS: mandatory skills/agents are explicit, AD-001 pattern is respected, delegation scopes are coherent, validation and handoff are reachable, and evidence is cited.
- PARTIAL: flow is mostly correct but one contract is implicit, a skill load is only implied, or validation/handoff is weakly defined.
- FAIL: recipe loads the wrong in-session agent, mixes orchestrator with specialists, delegates to the wrong role, omits mandatory skill loads, creates overlapping write scopes, or has no reachable validation/handoff path.

Red flags:

- Agent uses a skill methodology without asking to load that skill.
- Recipe eval JSON lists delegated agents as in-session agents.
- Orchestrator delegates without an orchestration decision or scope partition.
- Specialist agent spawns subagents.
- Recipe embeds large methodology instead of loading a skill.
- Flow ends in analysis with no validation, handoff, success, or stop criterion.

Layering questions:

- Is the pyramid respected: recipe to agent to skill?
- Are recipes used for workflow, agents for persona/specialization, and skills for methodology?
- Is the current session the right in-session agent for the recipe pattern?

Delegation questions:

- Is delegation necessary due to expertise, parallelism, context isolation, or review independence?
- Does Orchestration decision appear before every required delegation?
- Does the decision state flow, workers, scope, read/write mode, and expected output?
- Are write scopes non-overlapping or explicitly sequenced?
- Are read-only tasks safely parallelized?
- Are subagents prevented from coordinating with each other?
- Are subagents prevented from spawning subagents?

Synthesis questions:

- Does the orchestrator audit delegate claims against evidence?
- Does it synthesize results instead of raw-forwarding outputs?
- Does final output include a delegation audit?
- Are unresolved conflicts escalated?
- Are circuit breakers defined?

Orchestration red flags: delegation without stated decision; overlapping writers; subagent asked to coordinate another subagent; raw forwarding; context bloat; no audit.

## 15. Layer-Delta Evaluation Procedure

| Subject | Default comparison |
|---|---|
| Skill | Layer 1 skill vs Layer 0 no skill |
| Agent | Layer 2 agent + skills vs Layer 1 skills only |
| Recipe | Layer 3 recipe + agents + skills vs Layer 2 agents + skills |

Procedure:

1. Score baseline condition independently.
2. Score enhanced condition independently.
3. Compare criterion-level changes.
4. Classify each criterion as improved, unchanged, regressed, or not applicable.
5. Assign delta verdict: POSITIVE, NEUTRAL, or NEGATIVE.
6. Report absolute scores and delta score.

Do not assume the enhanced layer is better. More context, more agents, or longer output is not automatically better.

## 16. Common Rationalizations to Reject

- The diff is small, so no tests are needed.
- The eval failed for environmental reasons, so ignore it.
- The generated docs are close enough.
- The specialist loaded in-session does not matter.
- A recipe can list summoned agents as in-session agents.
- The output is well formatted, so it followed the protocol.
- The agent probably checked that internally.
- This is only documentation, so no consistency check is needed.
- The validator would pass if run.

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

## 18. Calibration Anchors

PASS anchor: Recipe validation passes when the transcript shows goose recipe validate on the changed recipe with exit code 0.

PARTIAL anchor: bd prime appears after git diff. The command exists, but it was late.

FAIL anchor: Orchestration decision is not found before a delegate call.

Layer-delta anchor: baseline score 0.62, enhanced score 0.78, delta positive because enhanced condition claimed bead before write and ran validation while baseline did not.

## 19. Report Template

# Harness Judge Report

## Subject

- Type:
- Name/path:
- Evaluation mode:
- Applicable domains:
- Evidence reviewed:
- Judge rubric version:
- Exit/stop/success criteria:

## Summary Verdict

- Verdict: PASS | PARTIAL | FAIL
- Confidence: High | Medium | Low
- Blocking failures:
- Top strengths:
- Top risks:

## Score Table

| ID | Domain | Criterion | Type | Score | Evidence | Recommendation |
|---|---|---|---|---|---|---|

## Domain Findings

### Domain A — Prompt / Context / Loop Engineering
### Domain B — Skills
### Domain C — Agents
### Domain D — Recipes
### Domain E — Frameworks
### Domain F — Orchestration

## Layer-Delta Analysis

- Baseline score:
- Enhanced score:
- Delta:
- Delta verdict:
- Regression check:

## Red Flags and Common Rationalizations

- Confirmed red flags:
- Rejected rationalizations:

## Final Judgment

## 20. Validation Commands

Use these commands when judging whether an implementation properly validated harness changes. In judge mode, check whether the evaluated session ran them.

For structural artifact changes:

- python3 scripts/generate-tables.py
- python3 scripts/check-consistency.py
- node apps/kg/dist/cli.js pipeline

For recipes:

- goose recipe validate .goose/recipes/name.yaml
- find .goose/recipes -name *.yaml with goose recipe validate

For skills:

- goose skills list
- node apps/eval-hub/dist/index.js --run --layers skills --subjects skill-name --ambient-goose

For agents:

- node apps/eval-hub/dist/index.js --run --layers agents --subject agent-name --ambient-goose

For final repo check:

- git status --short
## Self-Validation Checklist

- [ ] Cite observable evidence for every score before final verdict.
- [ ] Orient on the relevant harness artifact, transcript, or knowledge source before scoring.

