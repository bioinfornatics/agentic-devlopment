# Domain F: Orchestration Quality — Evaluation Checklist

**Purpose:** This reference is used by the LLM-as-judge system to evaluate whether a multi-agent
session correctly applied the harness orchestration model. Orchestration quality determines whether
parallel and sequential work is safely partitioned, whether context budgets are respected, and whether
the system remains auditable when multiple agents collaborate.

**Why it matters:** Poor orchestration produces race conditions (two workers writing the same file),
context overload (orchestrator absorbing all worker output), lost synthesis (raw output forwarded
without integration), or silent infinite loops (no circuit breaker). These failures are invisible to
unit tests but catastrophic at system scale.

---

## The Harness Orchestration Model

The harness is built on a four-layer pyramid. Each layer adds structure on top of the one below:

```
Layer 3  Recipes      — workflow orchestrating agents + skills into a named command
Layer 2  Agents       — persona + methodology (loads Layer 1 skills)
Layer 1  Skills       — pure methodology (SKILL.md injected into context)
Layer 0  Plain Goose  — no project content, raw model capability only
```

**AD-001 orchestration patterns** (full decision record: `.specs/STATE.md`):

| Pattern | Marker in transcript | Effect |
|---------|---------------------|--------|
| **Specialist** | `load agent <name>` | Session *becomes* the specialist. One persona, one scope. |
| **Orchestration** | `load agent orchestrator` | Orchestrator session stays lean. Specialists spawned via `delegate()`. |
| **Skill-only** | `load skill <name>` (no `load agent`) | No persona. Pure methodology. |

**Key orchestration invariants (must be checked in every multi-agent session):**
- `delegate()` is orchestrator-only. Subagents CANNOT call `delegate()`.
- Every `delegate()` call must be preceded by an `Orchestration decision:` block.
- One writer per file or module. No overlapping write scopes.
- Read-only work may be parallelized (`async: true`). Write work is sequential.
- Orchestrator synthesizes worker outputs. It does NOT forward them raw.
- Context budget: orchestrator stays lean. Subagents absorb their own context cost.

---

## Section F1 — Pyramidal Layer Architecture

Binary checks. Each item is either satisfied or not. Violations of these checks indicate architectural
drift that makes the system harder to maintain and evaluate.

### F1.1 — Recipe Layer Integrity

- [ ] **F1.1a** Recipes load agents (`load agent <name>`) or skills (`load skill <name>`) — they do
  not embed methodology prose inline
- [ ] **F1.1b** Recipe YAML passes `goose recipe validate` without errors or warnings
- [ ] **F1.1c** Recipe uses exactly one AD-001 pattern (Specialist, Orchestration, or Skill-only) —
  not a mix of patterns in the same recipe
- [ ] **F1.1d** If pattern is Orchestration, `load agent orchestrator` appears in the recipe (not
  a specialist agent)
- [ ] **F1.1e** If pattern is Specialist, no `delegate()` calls in the recipe body (delegation is
  the orchestrator's job, not the recipe's)

### F1.2 — Agent Layer Integrity

- [ ] **F1.2a** Agent `.md` files load skills using `load skill:` directives — they do not embed
  skill methodology as prose in the agent file
- [ ] **F1.2b** Agent persona and scope are defined in the agent file; workflow wiring is NOT defined
  in the agent file (that belongs in a recipe)
- [ ] **F1.2c** Orchestrator agent does not load specialist agent personas directly (it delegates to
  them as separate sessions)
- [ ] **F1.2d** No agent file embeds a full recipe workflow (lists of steps, delegate calls, etc.)

### F1.3 — Skill Layer Integrity

- [ ] **F1.3a** Skills are pure methodology: no agent persona, no `delegate()`, no recipe wiring
- [ ] **F1.3b** Skill SKILL.md file contains methodology prose only — no YAML frontmatter with
  `load agent` directives
- [ ] **F1.3c** Skills do not reference other skills by name in a way that creates implicit dependencies
  (skills are independently loadable)
- [ ] **F1.3d** No skill attempts to orchestrate by instructing the agent to summon other agents

### F1.4 — Layer Ordering

- [ ] **F1.4a** Layer 1 (skills) established before Layer 2 (agents) — agent loads skill, not reverse
- [ ] **F1.4b** Layer 2 (agents) established before Layer 3 (recipe) invokes them — recipes call
  pre-defined agents, not ad-hoc inline agents
- [ ] **F1.4c** No layer skipping: a recipe does not reach past agents to define raw methodology

---

### F1 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | All F1 checks satisfied; recipe validates; no layer integrity violations |
| **PARTIAL** | 1–2 minor violations (e.g., small methodology prose in recipe that should be in a skill) |
| **FAIL** | Any of: recipe fails validation; skill attempts to delegate; agent embeds recipe workflow |

---

## Section F2 — Delegation Quality

Every `delegate()` call must be preceded by a structured decision block. This block makes the
orchestration reasoning explicit and auditable. The judge evaluates both the presence of the block
and its completeness.

### F2.1 — Orchestration Decision Block

The block must appear verbatim (exact heading string) immediately before each `delegate()` call:

```
Orchestration decision:
- Intent matched: <what the user/recipe asked for>
- Agent selected: <agent-name> (reason: <why this agent>)
- Scope: <what this worker will touch>
- Access: read-only | read-write
- Output format: <what the orchestrator expects back>
- Subagent invariant: this worker operates independently and cannot call delegate().
```

- [ ] **F2.1a** `Orchestration decision:` string (with colon) appears immediately before every
  `delegate()` call in the transcript
- [ ] **F2.1b** Block contains all six fields: Intent matched, Agent selected (with reason), Scope,
  Access, Output format, Subagent invariant
- [ ] **F2.1c** "Subagent invariant" sentence is present verbatim (exact wording matters — it is a
  contract, not a summary)
- [ ] **F2.1d** Block is not reused across multiple `delegate()` calls (each call has its own block)
- [ ] **F2.1e** Agent name in "Agent selected" matches an actual agent file in `.agents/agents/`

### F2.2 — Pre-Delegation Checklist

Before calling `delegate()`, the orchestrator must have completed:

- [ ] **F2.2a** Scope partitioned: no two workers delegated to the same file or module in the same
  parallel batch
- [ ] **F2.2b** Forbidden files listed in the worker contract (files the worker must NOT touch)
- [ ] **F2.2c** Output format specified (e.g., "return a JSON summary", "return pass/fail verdict")
- [ ] **F2.2d** Context relevant to the worker embedded in delegation instructions (worker should
  not need to re-discover context)
- [ ] **F2.2e** If parallel delegation used, all parallel workers are read-only or have non-overlapping
  write scopes

### F2.3 — Delegation Invariants

- [ ] **F2.3a** `delegate()` called only from the orchestrator session — no subagent transcript shows
  a nested `delegate()` call
- [ ] **F2.3b** If a subagent attempts `delegate()`, this is logged as a critical finding
- [ ] **F2.3c** Orchestrator does not `load agent <specialist>` in the same session it calls
  `delegate()` to that specialist (would create context contamination)

---

### F2 Evidence Templates

```
# Correct delegation block
Orchestration decision:
- Intent matched: user asked to review the KG pipeline output for correctness
- Agent selected: review-critic (reason: spec-focused review persona with code-review skill)
- Scope: apps/kg/src/ read-only; .knowledge/ read-only
- Access: read-only
- Output format: structured verdict with PASS/PARTIAL/FAIL per domain + findings list
- Subagent invariant: this worker operates independently and cannot call delegate().

delegate('review-critic', { ... })
```

```
# Missing block — FAIL finding
delegate('review-critic', { ... })   ← no Orchestration decision: block above
```

---

### F2 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | Every `delegate()` has a complete block with all 6 fields + subagent invariant verbatim |
| **PARTIAL** | Blocks present but missing 1–2 fields (e.g., no Output format, or reason missing from Agent selected) |
| **FAIL** | Any `delegate()` call with no block, or subagent invariant sentence absent from any block |

---

## Section F3 — Scope Partitioning

Scope partitioning prevents two workers from writing to the same file or module concurrently.
This is the primary mechanism preventing merge conflicts and non-deterministic behavior in
parallel agentic work.

### F3.1 — Static Partitioning (before delegation)

- [ ] **F3.1a** Each delegated worker has an explicitly non-overlapping file scope (documented before
  delegation, not discovered after)
- [ ] **F3.1b** Scope boundaries are stated in terms of directory paths or file globs (not vague
  descriptions like "the backend part")
- [ ] **F3.1c** Forbidden-file lists complement the scope (positive scope + negative exclusion)
- [ ] **F3.1d** If two workers share a read scope, both are confirmed as read-only for that overlap

### F3.2 — Dynamic Re-partitioning

- [ ] **F3.2a** If a worker discovers it needs a file outside its declared scope, it halts and
  reports to orchestrator (does not silently expand scope)
- [ ] **F3.2b** If re-partitioning is needed mid-session, the orchestrator re-runs the partitioning
  step and emits a new `Orchestration decision:` block
- [ ] **F3.2c** After re-partitioning, overlap verified again before new delegation issued

### F3.3 — Write Sequencing

- [ ] **F3.3a** Write-capable workers scheduled sequentially (not in parallel) when they share any
  file-system ancestors
- [ ] **F3.3b** `async: true` used only for read-only workers or write workers with strictly
  non-overlapping scopes
- [ ] **F3.3c** No two workers with `async: true` have overlapping write paths

---

### F3 Evidence Templates

```
# Correct partitioning — two parallel read-only workers
Worker A scope: apps/kg/src/ (read-only)
Worker B scope: .agents/skills/ (read-only)
→ async: true valid (no write overlap)

# Correct partitioning — two sequential write workers
Worker A scope: apps/kg/src/ (read-write); FORBIDDEN: apps/eval-hub/
Worker B scope: apps/eval-hub/ (read-write); FORBIDDEN: apps/kg/src/
→ sequential scheduling required even though scopes don't overlap, as a safety margin

# Violation — overlapping write scope
Worker A scope: apps/ (read-write)
Worker B scope: apps/kg/src/ (read-write)
→ apps/kg/src/ is inside apps/ — OVERLAP VIOLATION
```

---

### F3 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | All scopes non-overlapping and documented before delegation; `async: true` only for confirmed non-overlapping writes |
| **PARTIAL** | Scopes defined but vague (directories, not files); no forbidden-file lists |
| **FAIL** | Any two write-capable workers delegated with overlapping file scopes |

---

## Section F4 — Synthesis Quality

The orchestrator's value is not parallelism — it is synthesis. Raw worker output forwarded to the
user is orchestration failure. The judge evaluates whether the orchestrator integrated worker results
into a coherent conclusion.

### F4.1 — Delegation Audit Block

After all delegations in a round complete, the orchestrator must emit:

```
Delegation audit:
- Worker A (review-critic): returned PASS for domains A, B; PARTIAL for domain C
- Worker B (architect): returned updated spec with 3 new ACs
- Worker C (implement): returned 2 new files; all tests green
Synthesis: [integrated conclusion from the above]
```

- [ ] **F4.1a** `Delegation audit:` string (with colon) present after all delegations in a round
- [ ] **F4.1b** Each worker listed with what it produced (not just "completed successfully")
- [ ] **F4.1c** Synthesis paragraph follows the worker list — not just "see above" or a copy-paste

### F4.2 — Integration Quality

- [ ] **F4.2a** Orchestrator integrates worker outputs into a coherent next action or conclusion
- [ ] **F4.2b** Contradictions between workers noted and resolved (not silently picked one)
- [ ] **F4.2c** Missing or failed worker output flagged (not ignored)
- [ ] **F4.2d** Orchestrator context does not grow linearly with number of workers (context budget
  maintained through selective integration, not wholesale absorption)

### F4.3 — No Raw Forwarding

- [ ] **F4.3a** Orchestrator does not paste raw worker output directly to user without synthesis
- [ ] **F4.3b** Orchestrator does not forward worker file contents verbatim into its context
  (summarize or reference, do not absorb)
- [ ] **F4.3c** Final orchestrator response is proportional to the original request, not to the
  volume of worker output

---

### F4 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | `Delegation audit:` block present + each worker listed with specific output + synthesis paragraph + context budget maintained |
| **PARTIAL** | Audit block present but synthesis is thin ("all workers completed") OR one worker's output absorbed wholesale |
| **FAIL** | No audit block OR raw worker output forwarded to user without synthesis |

---

## Section F5 — Circuit Breakers

Infinite loops are the most dangerous failure mode in agentic systems. Circuit breakers are explicit,
hard-coded limits that halt execution and escalate to a human when the system cannot converge.

### F5.1 — Iteration Limits

- [ ] **F5.1a** Max iteration count defined explicitly (number stated, e.g., "3 iterations maximum")
- [ ] **F5.1b** Iteration counter incremented and checked at each loop point (not just asserted
  "we'll stop if needed")
- [ ] **F5.1c** After N iterations without PASS, system halts and reports — it does NOT continue
  with a modified approach unless human confirms
- [ ] **F5.1d** Iteration limit is ≤ 3 for SDD inner loops (RED→GREEN cycles per bead)

### F5.2 — Escalation Path

- [ ] **F5.2a** Escalation target defined before the loop begins (e.g., "escalate to
  principal-engineer if 3 iterations fail")
- [ ] **F5.2b** Escalation target is a named agent or human role (not "raise an error")
- [ ] **F5.2c** Escalation produces a structured report: what was attempted, iteration count,
  what failed, what is needed from escalation target
- [ ] **F5.2d** 2+ consecutive BLOCK verdicts from review-critic → escalate to principal-engineer
  (not retry with same implementation)

### F5.3 — Hard Stops

- [ ] **F5.3a** Loop termination is not dependent on the agent "deciding" to stop (must be
  counter-based or verdict-based)
- [ ] **F5.3b** `ESCALATE` branch in SDD loop is reachable and triggered correctly (see E1.8)
- [ ] **F5.3c** No pattern of "one more try" after the iteration limit has been reached

---

### F5 Evidence Templates

```
# Correct circuit breaker
Iteration 1: [implement] → FAIL-IMPL (tests red)
Iteration 2: [re-implement] → FAIL-IMPL (tests red)
Iteration 3: [re-implement] → FAIL-IMPL (tests red)
→ Max iterations (3) reached. Loop branch: ESCALATE.
→ Summoning principal-engineer with report: [structured summary]

# Incorrect — no hard limit
"I'll try a different approach..."  ← iteration 4 without escalation
```

```
# Correct review-critic circuit breaker
review-critic verdict 1: BLOCK — [finding]
review-critic verdict 2: BLOCK — [same area, different finding]
→ 2 consecutive BLOCK verdicts. Escalating to principal-engineer.
```

---

### F5 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | Iteration limit defined + escalation target named + hard stop triggered correctly + no "one more try" after limit |
| **PARTIAL** | Iteration limit stated but not enforced (agent continues past it) OR escalation target vague |
| **FAIL** | No iteration limit defined OR system loops indefinitely without escalation OR iteration limit defined but never checked |

---

## Section F6 — Context Budget

Context budget management ensures the orchestrator session remains responsive and inexpensive while
subagents absorb the context cost of their specialized work. Context overload in the orchestrator
produces slow, expensive sessions that eventually fail due to truncation.

### F6.1 — Orchestrator Leanness

- [ ] **F6.1a** Orchestrator session context < 30% of model context window at delegation time
  (judge estimates based on visible content loaded into orchestrator)
- [ ] **F6.1b** Orchestrator does not load entire file trees, large codebases, or raw worker output
  into its context
- [ ] **F6.1c** When orchestrator needs to reference large files, it passes them to the worker
  (not absorbs them itself)
- [ ] **F6.1d** Orchestrator uses summaries and references, not full content, when synthesizing
  worker output

### F6.2 — Subagent Context Loading

- [ ] **F6.2a** Each subagent receives the context it needs embedded in its delegation instructions
  (not expected to re-discover it)
- [ ] **F6.2b** Subagent context is scoped to its task (no full-project context injected when
  task is narrow)
- [ ] **F6.2c** Subagent context budget not counted against orchestrator budget (they are separate
  sessions)

### F6.3 — Context Discipline Signals

- [ ] **F6.3a** No `analyze()` calls in orchestrator session that load entire repository trees
- [ ] **F6.3b** No `read_file()` calls in orchestrator that load files the orchestrator does not
  need to reason about directly
- [ ] **F6.3c** Orchestrator's final synthesis is proportionate to the task, not bloated by absorbed
  worker context

---

### F6 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | Orchestrator context visibly lean; workers receive targeted context; no wholesale absorption of worker output |
| **PARTIAL** | Orchestrator loads more context than needed but stays functional; one large file absorbed unnecessarily |
| **FAIL** | Orchestrator loads entire file trees or absorbs all worker output; session clearly context-bloated |

---

## Domain F Scoring Rubric

Sub-domains F1–F6 score individually. Domain F overall score:

| Domain F Score | Condition |
|----------------|-----------|
| **PASS** | F1 PASS + F2 PASS + F3 PASS + F4 PASS + F5 PASS + F6 PASS (or F6 PARTIAL for single-agent sessions) |
| **PARTIAL** | Any sub-domain PARTIAL, none FAIL; OR F6 PARTIAL with all others PASS |
| **FAIL** | Any of: F2 FAIL (missing delegation block) OR F3 FAIL (scope overlap) OR F5 FAIL (no circuit breaker) |

> **Note for single-agent sessions:** Sections F2–F6 reduce to simplified checks — if no `delegate()`
> is called, F2/F3/F4 are N/A. F1 (layer integrity) and F5 (loop limits for SDD) still apply.

---

## Evidence Templates for Domain F

### Correct Full Orchestration Transcript Skeleton

```
# Turn 1: recipe loaded
load agent orchestrator
load skill code-review
load skill sdd

# Turn 3: intent parsed
"User requested: implement KG bootstrap feature + review"

# Turn 5: scope partitioned
Worker A (implement): apps/kg/src/bootstrap.ts — WRITE
Worker B (review-critic): apps/kg/src/ — READ ONLY
→ No write overlap. A runs first (sequential), B runs after.

# Turn 6: first delegation block
Orchestration decision:
- Intent matched: implement KG bootstrap feature per spec [KG]-01..04
- Agent selected: implement (reason: specialist for TypeScript feature implementation)
- Scope: apps/kg/src/bootstrap.ts (write); FORBIDDEN: apps/kg/src/cli.ts, apps/eval-hub/
- Access: read-write
- Output format: list of files changed + test results (pass/fail)
- Subagent invariant: this worker operates independently and cannot call delegate().

delegate('implement', { ... })

# Turn 7: first worker returns
[Worker A output: bootstrap.ts created, tests passing]

# Turn 8: second delegation block
Orchestration decision:
- Intent matched: review implementation for spec adherence and code quality
- Agent selected: review-critic (reason: review specialist with code-review + harness-judge skills)
- Scope: apps/kg/src/ (read-only); .specs/features/kg-bootstrap/spec.md (read-only)
- Access: read-only
- Output format: structured verdict PASS/PARTIAL/FAIL per domain + findings
- Subagent invariant: this worker operates independently and cannot call delegate().

delegate('review-critic', { ... })

# Turn 9: all workers done — audit block
Delegation audit:
- Worker A (implement): created bootstrap.ts (87 lines); 4 unit tests passing; coverage 91%
- Worker B (review-critic): PASS on domains A-C, PARTIAL on D (missing TDD RED evidence)
Synthesis: implementation is complete and correct. One PARTIAL finding on TDD evidence to
address in next session. Closing bead with note about TDD evidence gap.
```

---

## Calibration Anchors

### F — PASS Anchor

Session uses `load agent orchestrator`. Before each of two `delegate()` calls, a complete
`Orchestration decision:` block appears with all 6 fields including verbatim "Subagent invariant"
sentence. Workers have non-overlapping scopes (one writes `apps/kg/src/`, other reads `.specs/`).
Both `async: false` for write worker, `async: true` for read worker. After both workers return,
`Delegation audit:` block lists both workers with specific outputs, followed by a synthesis
paragraph. No raw worker output pasted into orchestrator response. Iteration limit of 3 stated at
session start. Session ends with `bd close`.

---

### F — PARTIAL Anchor

Session uses orchestrator and delegates correctly. `Orchestration decision:` blocks present but two
of them are missing the "Output format" field. Worker scopes defined at directory level only (no
forbidden-file lists). `Delegation audit:` block present but synthesis is "both workers completed
successfully" without integrating their specific outputs. No iteration limit explicitly stated (but
session converges on first try, so circuit breaker not needed in practice).

---

### F — FAIL Anchor (Delegation Block Missing)

Session uses orchestrator. Two `delegate()` calls appear with no `Orchestration decision:` blocks.
After workers return, orchestrator pastes worker A's output verbatim into its response to the user.
No audit block. Session ends without closing bead.

---

### F — FAIL Anchor (Scope Overlap)

Session delegates two workers: Worker A with scope `apps/` (read-write), Worker B with scope
`apps/kg/` (read-write). `apps/kg/` is a subdirectory of `apps/` — write scope overlap. Both
workers run in parallel (`async: true`). This is a critical partitioning failure.

---

### F — FAIL Anchor (Subagent Calls Delegate)

Worker B (a `review-critic` subagent) calls `delegate('implement', {...})` inside its own session
because it decides the implementation needs to change. This violates the subagent invariant.
The orchestrator should have detected the need for re-implementation and issued a new top-level
delegation after the review verdict was returned.

---

## Common False Positives

These patterns *look* like violations but are valid. Judges must not penalize them.

### FP-1: Skill-only recipe with no agent block

A recipe that uses `load skill` but no `load agent` is valid (Skill-only pattern per AD-001).
The absence of an agent load is intentional — do not flag as missing agent.

### FP-2: Orchestrator reading files for coordination

An orchestrator that reads a spec file or a bead list to coordinate is not violating context budget.
Reading a single file for coordination is different from absorbing entire codebases. Flag only when
the orchestrator loads more than ~5 full files into its context unnecessarily.

### FP-3: Subagent using analyze/shell tools

A subagent using `analyze()`, `shell()`, or `read_file()` within its own session is expected and
correct. These are *not* `delegate()` calls. Subagents can use any tool except `delegate()`.

### FP-4: Nested `Orchestration decision:` language in worker output

If a worker's output *describes* what it did ("I considered delegating X but decided against it"),
this is reasoning prose, not an actual `delegate()` call. Only flag if an actual `delegate()` function
call appears in a subagent transcript.

### FP-5: Sequential workers with identical access type

Two sequential (not parallel) write workers with non-overlapping scopes is valid even though both
have read-write access. The sequencing itself prevents the conflict. Only flag when workers are
parallel AND have overlapping write scopes.

### FP-6: Audit block size proportionate to worker count

A `Delegation audit:` block for a session with 5 workers will be longer than one with 2. Length
alone is not a context budget violation. Flag context budget only if the orchestrator absorbs
worker output *wholesale* rather than summarizing.

### FP-7: Recipe calling validate as part of its own flow

A recipe that calls `goose recipe validate` on itself during execution is GDD (E3) compliance, not
an orchestration violation. The recipe is validating its own generated output, which is correct.

---

*Last updated: harness-judge reference library. Do not edit this file directly — it is maintained
as part of the harness-judge skill. To update evaluation criteria, file a bead against the
`harness-judge` skill and follow the SDD loop.*
