# SOTA Knowledge Base — Prompt, Context & Loop Engineering
> Serialized July 2026 from: Loop Engineering (local), PromptingGuide.ai, Claude Platform Docs, AgentSkills.io Spec

---

## 1. Prompt Engineering Techniques (promptingguide.ai)

### Chain-of-Thought (CoT) — Wei et al. 2022
**What it is:** Elicit multi-step reasoning by showing intermediate steps in few-shot examples, or by appending "Let's think step by step" (Zero-shot CoT, Kojima 2022).

**When to use:** Tasks requiring arithmetic, commonsense, or symbolic reasoning before an answer. Complex decisions with multiple sub-conditions.

**Applied to harness:** Every skill Operating Process should be a CoT sequence — name the reasoning steps, not just the conclusion. Instead of "check if the pointer format is correct", write the reasoning chain: "1. Read the value → 2. Check it starts with topic → 3. Verify 'read when' (not 'read before') → 4. Count characters."

**Key insight:** One reasoning-chain example outperforms long descriptive instructions.

---

### ReAct — Yao et al. 2022
**What it is:** Interleave Reasoning traces + Acting steps. Agent generates: Thought → Action → Observation → Thought → ... until done.

**Cycle:**
```
Thought: I need to check whether bd prime was called before any writes.
Action: Search stdout for "bd prime" occurrence index.
Observation: Found at turn 3. First write at turn 9. ✓
Thought: Pre-write check passes. Proceed to EB2.
```

**Applied to harness:** Our graders fail when agents produce correct *actions* without explicit *thoughts*. Skills should instruct agents to emit a Thought before each critical action — making the reasoning visible and gradeable. ReAct is exactly what the self-validation loops we added implement.

**Key insight:** ReAct combined with CoT outperforms either alone. Our skill pre-write checklists ARE ReAct loops made explicit.

---

### Reflexion — Shinn et al. 2023
**What it is:** Three-agent system: Actor (generates actions) → Evaluator (scores) → Self-Reflection (generates verbal feedback for next attempt). Stores reflection in long-term memory.

**Cycle:**
```
Episode 1: Actor tries → Evaluator fails → Self-Reflection: "I used 'read before'; must use 'read when'"
Episode 2: Actor reads reflection → fixes wording → Evaluator passes
```

**Applied to harness:** Our eval + skill improvement loop IS Reflexion at the development level. The grader is the Evaluator. The skill Gotchas section is crystallized Self-Reflection. Every time we fix a negative delta by adding a gotcha, we are implementing one Reflexion cycle.

**Key insight:** Self-reflection stored in memory (skills/gotchas) is more durable than in-context reflection. Gotchas = externalized long-term Reflexion memory.

---

### Prompt Chaining
**What it is:** Break complex tasks into sequential subtasks; output of step N is input to step N+1. Each prompt is focused and bounded.

**Applied to harness:** Our recipe → subrecipe → agent delegation chain IS prompt chaining. harness-master → harness_implement subrecipe → implementation-worker agent is a 3-step chain where each step consumes the prior's output.

**Pattern:**
```
Step 1: product-owner → PRD (structured output)
Step 2: architect     → ADR (uses PRD as input)
Step 3: beads-planner → bd commands (uses ADR)
Step 4: implementation-worker → code (uses bd commands)
Step 5: review-critic → verdict (uses code diff)
```

**Key insight:** Each chain step should have a structured output schema — not narrative prose — so the next step can reliably parse it.

---

### Context Engineering for Agents (promptingguide.ai / n8n)
**Core issue observed:** "Agent creates 3 search tasks but executes only 2, skipping the third without justification." → missing explicit completion constraints.

**Two approaches:**
- **Flexible:** Allow agent to decide scope, but require explicit reasoning for any skipped steps
- **Strict:** Enumerate required steps; agent must complete all or escalate

**Applied to harness:** Our agentic-dev-harness EB1 failure was exactly this: agent ran bd prime but grader couldn't confirm it. Fix: require explicit declaration ("bd prime called at turn N before first write at turn M") — making the completion visible.

---

## 2. Loop Engineering (loop-engineering project)

### Core Mental Model
```
Harness = single session setup (tools + context + permissions + rules)
Loop    = harness + schedule + state + verification chain

Loop Engineering = replacing yourself as the prompter
```

### The Six Primitives
| # | Primitive | Our harness equivalent |
|---|---|---|
| 1 | Scheduling / Automations | bd gate, GitHub Actions pages.yml |
| 2 | Worktrees | eval worktrees (dist/evals/skills/*/worktree/) |
| 3 | Skills | .agents/skills/*/SKILL.md |
| 4 | Plugins / MCP | uvx beads-mcp, Playwright MCP, developer extension |
| 5 | Sub-agents (Maker/Checker) | delegate() → implementation-worker → review-critic |
| 6 | Memory / State | evaluation.db, evals/history/runs.json, .beads/issues.jsonl |

### Maker/Checker Split — most important pattern
**Rule:** The agent that implemented cannot grade its own work.

**In harness:**
- Implementer: implementation-worker
- Checker: review-critic (separate session, different instructions, default stance: REJECT)
- Grader: grader LLM (separate from the eval run agent)

**Anti-pattern:** Our eval grader failing (invalid JSON) caused the implementer's work to be auto-scored as 0. Fix: heuristic fallback grader — separate simple checker when LLM grader fails.

### Readiness Levels
| Level | Description | Our eval equivalent |
|---|---|---|
| L0 | Intent only | Scenario definition exists |
| L1 | Report-only | Grader outputs findings, no skill change |
| L2 | Assisted | Skill updated based on findings, re-run verifies |
| L3 | Unattended | Full suite runs CI, auto-fixes skill issues |

**We operate at L2.** L3 would require: CI running evals → auto-patching skills → human review gate.

### Anti-Patterns Mapped to Harness
| Loop anti-pattern | Harness manifestation | Fix applied |
|---|---|---|
| Same agent implements + verifies | Agent writes AND grades its own output | Separate grader LLM + heuristic fallback |
| No attempt cap | 200-turn run loops on truncated output | max_turns reduced to 40/60 |
| Vague triage output | Skill instructions prose-only → agent improvises format | Verbatim templates added |
| L3 before L1 quality | Auto-running evals before skill gotchas existed | Always add L1 gotchas before re-running |
| Shared state without schema | eval_analysis DB without scenario_hash | scenario_hash column added |
| No kill switch | Max_turns=200 with no early-exit rule | Compact turn budget + self-validation checkpoints |

### Failure Modes Applied
| Failure mode | Severity | Our occurrence | Mitigation applied |
|---|---|---|---|
| Verifier Theater | S2 | Grader returned invalid JSON → 0% score | Heuristic fallback grader |
| State Rot | S1→S2 | Old efficiency data in DB from 150-turn runs | scenario_hash + run date filtering |
| Infinite Fix Loop | S2 | 200-turn with skill agent thrashing | max_turns 200→40/60 |
| Escalation Failure | S2 | Negative delta not surfaced in time | quality gate --negative-delta-gate |
| Comprehension Debt | S2 | "read before" vs "read when" went unnoticed | Reflexion: gotcha added after failure |

### Loop Design Checklist — Applied to Our Eval Loop
- [x] Single clear goal: measure skill vs baseline delta per scenario
- [x] Explicit non-goals: no auto-merging skill changes
- [x] Skills: triage skill = analyze-skill-eval-results.py
- [x] Maker/Checker: eval agent ≠ grader LLM
- [x] State: evaluation.db + evals/history/runs.json
- [x] Human handoff: quality gate → human reviews negative deltas
- [x] Observability: trend dashboard (dist/evals/report/index.html)
- [x] Cost limits: scenario max_turns bounds token spend
- [ ] Kill switch: no auto-pause if budget exceeded (gap)
- [ ] Connector: no CI integration for auto-run (gap)

---

## 3. Claude Agent Skills Platform (platform.claude.com)

### Skill Architecture
```
skill-name/
├── SKILL.md          ← name + description (always in system prompt)
│                       body (loaded on demand when relevant)
├── references/       ← additional docs (loaded on demand per trigger)
├── scripts/          ← executable helpers
└── assets/           ← templates, resources
```

**Progressive disclosure levels:**
1. `description` field → always in system prompt (≤1024 chars)
2. `SKILL.md` body → loaded when agent decides skill is relevant
3. `references/*.md` → loaded only when specific trigger conditions match

**Key field:** `allowed-tools: Bash(git:*) Read` — pre-approved tool allowlist (experimental).

### Description Quality Rules
```yaml
# GOOD: specific, keyword-rich, when-to-use explicit
description: Extracts text from PDFs, fills PDF forms, merges multiple PDFs.
             Use when working with PDFs, forms, or document extraction.

# BAD: generic
description: Helps with PDFs.
```

**Applied to harness:** Every skill `description` should contain 3 parts:
1. What it does (concrete verbs)
2. When to use it (trigger conditions)
3. When NOT to use it (anti-triggers)

---

## 4. AgentSkills.io Specification

### Output Format Patterns (July 2026 best practice)
**Templates beat prose for output format.** Agents pattern-match against concrete structures.

```markdown
# WRONG (prose description):
"Emit an Orchestration decision block before delegating."

# RIGHT (verbatim template):
Emit this exact text:
```text
Orchestration decision:
- Intent matched: [...]
- Agent selected: [name]
```
```

### Gotchas Section — highest-value content
"The highest-value content in many skills is a list of gotchas — environment-specific facts that defy reasonable assumptions."

**Format:**
```markdown
## Gotchas
- **"read when" not "read before"** — pointer memories use "read when <trigger>", not "read before <action>".
- **Lowercase d, colon** — the literal string is "Orchestration decision:" not "## Orchestration Decision".
```

### Validation Loops
"Instruct the agent to validate its own work before moving on. The pattern is: do the work → run a validator → fix any issues → repeat until validation passes."

```markdown
## Self-validation
1. Write the memory value
2. Check: contains "read when"? Under 250 chars? No content dump?
3. If any NO → rewrite before calling bd remember
```

### Progressive Disclosure Trigger Pattern
"Read `references/api-errors.md` if the API returns a non-200 status code" — specific trigger, not generic.

```markdown
# WRONG: "see references/ for details"
# RIGHT: "load security-audit.md if the diff touches auth, payments, or input handling"
```

---

## 5. Introspection — Our Current Implementation

### Skills Inventory (8 skills, 2273 lines total)

| Skill | Lines | Progressive Disclosure | Gotchas | Validation Loop | Templates |
|---|---|---|---|---|---|
| `agentic-dev-harness` | 97 | ❌ no refs | ✅ added Jul 2026 | ✅ added Jul 2026 | ⚠️ partial |
| `beads-harness` | 195 | ⚠️ ## Planning | ✅ added Jul 2026 | ✅ added Jul 2026 | ✅ verbatim example |
| `code-review` | 129 SKILL + 6 refs | ✅ type-dispatch refs | ✅ false-positives | ✅ finding loop | ✅ output template |
| `goose-orchestration` | 336 | ❌ no refs | ✅ added Jul 2026 | ✅ added Jul 2026 | ✅ verbatim blocks |
| `sdd` | 49 | ❌ no refs | ❌ | ❌ | ❌ |
| `systematic-debugging` | 296 + refs | ✅ 5 ref files | ❌ | ❌ | ❌ |
| `ui-ux-quality` | 28 | ❌ | ❌ | ❌ | ❌ |
| `webapp-testing` | 69 | ❌ | ✅ (no sudo) | ✅ server lifecycle | ✅ evidence labeling |

**Gaps:** sdd, ui-ux-quality need gotchas + validation loops.

### Agent Inventory (11 agents)

| Agent | Model | Operating Process (CoT) | Checklist use | Output template |
|---|---|---|---|---|
| `harness-orchestrator` | opus-4-5 | ✅ 4 phases | ✅ pre-delegation | ✅ decision block |
| `implementation-worker` | sonnet-4-5 | ✅ TDD cycle | ✅ 5-item handoff | ✅ handoff format |
| `review-critic` | sonnet-4-5 | ✅ 7-step checklist | ✅ pre-report gate | ✅ verdict format |
| `architect` | opus-4-5 | ✅ 4-phase | ❌ | ✅ ADR + trade-off |
| `product-owner` | opus-4-5 | ✅ PRD rubric | ✅ 100pt gate | ✅ PRD template |
| `beads-planner` | sonnet-4-5 | ✅ bd commands | ❌ | ⚠️ |
| `codebase-researcher` | sonnet-4-5 | ✅ 4-phase | ❌ | ✅ JSON schema |
| `principal-engineer` | opus-4-5 | ✅ blast radius | ❌ | ✅ breaking-change |
| `tdd-guide` | sonnet-4-5 | ✅ RED→GREEN | ✅ edge cases | ⚠️ |
| `qa-automation` | sonnet-4-5 | ✅ pyramid | ❌ | ⚠️ |
| `ui-ux-auditor` | sonnet-4-5 | ✅ 8-dimension | ❌ | ⚠️ |

### Recipe Inventory (16 recipes = 10 top-level + 6 subrecipes)

| Recipe | Explicit skill load | Agent delegation | Beads assignee | Subrecipe |
|---|---|---|---|---|
| harness-master | ✅ routing table | ✅ 11 agents | ✅ all agents | ✅ via sub_recipes |
| harness-review | ✅ code-review | ✅ review-critic | ✅ | ✅ harness_review |
| harness-implement | ✅ beads-harness | ✅ implementation-worker | ✅ | ✅ harness_implement |
| harness-plan | ✅ beads-harness | ✅ beads-planner | ✅ | ✅ harness_plan |
| harness-research | ✅ agentic-dev-harness | ✅ codebase-researcher | ✅ | ✅ harness_research |
| sdd-master | ✅ 7-phase table | ✅ per phase | ✅ per phase | ❌ no subrecipe |
| harness-memory | ✅ beads-harness | ❌ direct ops | ❌ | ✅ |
| harness-release | ✅ agentic-dev-harness | ✅ principal-engineer | ✅ | ✅ |
| harness-web-test | ✅ webapp-testing | ✅ ui-ux-auditor | ✅ | ✅ |
| ui-ux-suite | ✅ ui-ux-quality | ✅ ui-ux-auditor | ✅ | ❌ no subrecipe |

---

## 6. Gaps and Improvements Identified

### P0 — Missing in skills (high impact)
1. **`sdd` skill:** No gotchas, no validation loop, no output template. SDD has strict phase ordering (Intent→Spec→TDD) that agents skip — needs a CoT sequence template + "never skip to implement" gotcha.
2. **`ui-ux-quality` skill:** 28 lines only. No gotchas for evidence-first rule (no evidence = no finding), no 8-dimension checklist template, no WCAG 2.2 AA gotchas.
3. **All skills:** Missing `allowed-tools` field (experimental but signals intent to eval graders).

### P1 — Missing in agents
1. **Architect, beads-planner, tdd-guide, qa-automation, ui-ux-auditor:** No post-action self-validation checklist.
2. **All agents:** No Reflexion-style "common mistakes" section documenting failures found in eval runs.

### P2 — Loop completeness
1. No CI trigger for automatic eval runs (L2→L3 gap).
2. No kill switch / token budget monitoring.
3. No multi-loop coordination: harness-master can spawn parallel workers but has no collision detection.

---

## 7. Techniques Applied in Our Harness (Summary)

| Technique | Source | Where applied |
|---|---|---|
| Chain-of-Thought | Wei 2022 | Numbered Operating Process in every agent |
| Zero-shot CoT | Kojima 2022 | "Think step by step" implicit in phase headers |
| ReAct | Yao 2022 | Self-validation loops (Thought→Action→Observe) |
| Reflexion | Shinn 2023 | Gotchas section = crystallized self-reflection memory |
| Prompt Chaining | — | recipe → subrecipe → agent delegation chain |
| Context Engineering | n8n/pg | Required explicit completion statements, compact turns |
| Progressive Disclosure | AgentSkills | references/ per review type in code-review skill |
| Templates > Prose | AgentSkills | Verbatim Orchestration decision: + Delegation audit: |
| Gotchas | AgentSkills | "read when" not "read before", lowercase d colon |
| Validation Loops | AgentSkills | Pre-write + post-handoff checklists |
| Maker/Checker Split | Loop Eng | implementation-worker ≠ review-critic ≠ grader |
| State/Memory | Loop Eng | evaluation.db + runs.json + .beads/issues.jsonl |
| Attempt Cap | Loop Eng | max_turns 40/60 per scenario |
| Denylist | Loop Eng | adversary.md blocks sudo/escalation |

---

## 8. Generated Knowledge Prompting — Liu et al. 2022

**What it is:** Two-pass approach — generate factual knowledge statements first, then use them as additional context for the final answer.
1. Knowledge generation pass: few-shot prompt → generate N factual knowledge statements
2. Answer pass: original question + generated knowledge → final answer

**The golf example:** Zero-shot says "higher point total wins" (wrong). After generating knowledge ("objective is lowest strokes"), the model answers correctly.

**Applied to harness — bd prime IS the knowledge generation pass.**

Before any decision or file write, generate explicit knowledge about the current state:

    1. What files are in scope? (read the directory)
    2. What does the Beads state say? (bd prime)
    3. What patterns exist in similar files? (read 1 example)

Only after this knowledge is generated: emit a Scoped plan and act.

**Eval finding that proves this:** In agentic-dev-harness[0], the WITHOUT skill agent generated knowledge by reading docs/14-memory.md before storing the pointer — and used the exact "read when" phrasing it found there. The WITH skill agent skipped this knowledge generation step (skill already told it what to do) and improvised "read before". **Lesson: explicit knowledge generation can outperform skill recall for exact wording.**

---

## 9. Self-Consistency — Wang et al. 2022

**What it is:** Instead of greedy decoding (one answer), sample multiple diverse reasoning paths, then select the most consistent answer by majority vote. Works on top of CoT.

    Prompt → Path 1 → Answer A
           → Path 2 → Answer A
           → Path 3 → Answer B
    Majority vote → Answer A wins

**Applied to harness:** The eval grader pass rate IS self-consistency — fraction of runs that pass = consistency score. Our confidence-based filtering in review-critic is self-consistency applied to findings: only report findings consistent across multiple interpretations.

**Improvement opportunity:** Run each eval scenario 3x and take the majority verdict. Currently 1x run means a single noisy run determines the score.

---

## 10. Tree of Thoughts (ToT) — Yao et al. 2023

**What it is:** Generalizes CoT from a linear chain to a tree. Agent generates multiple candidate thoughts, evaluates each as sure/maybe/impossible, keeps best candidates (BFS/DFS), and backtracks if a path fails.

**Applied to harness:**
- Architect agent 4-phase process = ToT: generate N design candidates, evaluate via trade-off table, pick winner
- Harness-orchestrator routing decision = ToT: list candidate agents, evaluate each against task, select most confident match

**Gap:** tdd-guide uses linear RED→GREEN→REFACTOR (CoT). ToT would strengthen it: generate N test implementations, evaluate each against coverage gate, keep best, refactor from winner.

---

## 11. Loop Engineering — Complete Reference

### Mental Model
    Harness = single session setup
    Loop    = harness + schedule + state + verification chain
    Loop Engineering = replacing yourself as the prompter

**Three kinds of debt loops address:**
- Intent debt: agent re-derives conventions every session → Skills
- Comprehension debt: code the loop wrote that no one understands → read loop output
- Orchestration tax: human coordination cost of parallel agents → worktrees + state files

---

### Eight Patterns — Quick Reference

| Pattern | Trigger | Cadence | Level |
|---|---|---|---|
| CI Sweeper | CI red on main/PR | 15m (not 5m) | L2 — classify then fix |
| PR Babysitter | PRs stalling | 10m | L1 watch to L2 |
| Daily Triage | Morning chaos | 1d | Start here — L1 week 1 |
| Issue Triage | Noisy issue queue | 2h | L1 report to L2 label |
| Dependency Sweeper | CVE alerts | 6h | L2 patch-only |
| Post-Merge Cleanup | TODOs after merges | 1d off-peak | L1 to L2 |
| Changelog Drafter | Release notes stale | 1d | Lowest risk — good first loop |
| PR Babysitter + goal mode | Single PR needs green | one-shot | /goal pattern |

**First loop recommendation: Daily Triage at L1. Teaches state discipline without auto-merge risk.**

---

### Claude Code Verbatim Commands

Daily Triage week 1:
    /loop 1d Run $loop-triage. Read STATE.md. Merge findings into High Priority and Watch List. Update Last run. Do not edit code.

CI Sweeper:
    /loop 15m $ci-triage — update ci-sweeper-state.md. Classify failures first. Fix only clear regressions in a worktree with verifier. Max 3 attempts.

PR Babysitter:
    /loop 5m For each open PR I care about: triage CI and reviews. Propose minimal fixes in worktree. Verifier agent must approve before commenting. Update pr-babysitter-state.md. Max 3 attempts.

Issue Triage:
    /loop 2h $issue-triage — read issue-triage-state.md first. Scan open issues since last run. Update state with Top 5, suggested labels. Propose only. Escalate auth, payments, security items.

One-shot goal mode:
    /goal All tests on main pass and lint is clean
    /goal PR #1234 has green CI, no blocking review comments, and is rebased on main

---

### STATE.md Standard Schema

    ## High Priority (loop must act)
    - [ ] item — reason — suggested action

    ## Watch List (monitor, not yet actionable)
    - item — last checked: date

    ## Human Inbox (ambiguous / cross-loop)
    - [ ] PR #42: needs human decision

    ## Resolved (prune weekly)
    - DONE item — resolved: date

    ---
    Last run: DATE | N findings | M actions | K escalations

---

### Safety Denylist (always encode in skills)

    .env, .env.*, **/secrets/**, auth/**, payments/**, billing/**,
    **/migrations/**, k8s/production/**

Never auto-merge: security/auth/payments/PII, dependency bumps, denylist paths, >10 file changes.

---

### Circuit Breaker Pattern

    npx @cobusgreyling/loop-context --check --ledger loop-ledger.json
    # exit 0 = continue | exit 2 = escalate to human

Trips on: max iterations, same error repeating N times, token budget cap.

---

### Loop MCP Server (reduces prompt stuffing)

    LOOP_PROJECT_ROOT=. npx @cobusgreyling/loop-mcp-server

Agent queries patterns, skills, state on demand instead of loading everything upfront.

---

### Harness Loop Gaps (July 2026)

| Gap | Loop Engineering term | Priority |
|---|---|---|
| No CI auto-trigger for eval runs | Scheduling primitive missing | P2 |
| No token budget monitoring | No kill switch | P2 |
| No collision detection for parallel workers | Multi-loop coordination | P2 |
| Grader = same model as eval agent (was) | Maker/Checker violation | Fixed |
| max_turns=200 infinite-fix (was) | No attempt cap | Fixed |
| No audit score for harness loop | loop-audit equivalent missing | P3 |

