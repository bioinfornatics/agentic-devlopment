# Agentic UX Audit — SDD Loop Interaction Model
**Date:** 2026-07-18  
**Scope:** discover.yaml → spec.yaml → plan.yaml → implement.yaml → review.yaml → verify.yaml  
**Lens:** Agentic-UX skill — transparent autonomy, graduated trust, meaningful interruption, graceful degradation, appropriate abstraction  
**Verdict:** Structurally sound; coherence gaps in mid-loop phases; three blocking UX anti-patterns identified.

---

## 1. Executive Summary

The SDD loop is architecturally well-designed for agent execution but inconsistently designed
for *user supervision*. The loop exhibits strong agentic UX in its bookends (discover Step 0,
verify's type-detection output) and weakens significantly in the middle three phases (spec, plan,
implement), where the user's role shifts without signal and consequential actions (epic/story
creation, code writes) occur without confirmation gates.

The core mismatch: the recipes treat each phase as an **isolated agent task** when they should
treat each phase transition as a **trust handoff event** that requires an explicit user acknowledgement.

---

## 2. Phase-by-Phase Role Map

| Phase | Correct User Role (per complexity) | Actual User Role | Interface Model Match |
|---|---|---|---|
| **Discover** | Operator (elicitation) → Supervisor | Operator gates, then disappears | ⚠️ Partial |
| **Spec** | Supervisor (validate ACs before stories) | Passive bystander | ❌ Weak |
| **Plan** | Approver (Large/Complex) / Supervisor (Medium) | Approver only for L/C; absent for M | ⚠️ Partial |
| **Implement** | Absent-by-design / Escalation receiver | Absent with unclear escalation UX | ⚠️ Partial |
| **Review** | Supervisor → Verdict receiver | Supervisor with clear verdicts | ✅ Good |
| **Verify** | Supervisor → Failure triager | Supervisor with explicit type/protocol declaration | ✅ Strong |

---

## 3. Detailed Findings

### 3.1 DISCOVER — Role shift without signal

**What happens:**  
- Step 0: user is **operator** — required to name the feature (or recipe blocks).  
- Step 1 onwards: agent runs `bd prime`, `bd ready`, delegates to `ux-researcher` and
  `product-owner`, sweeps 9 implicit-requirement dimensions, then **autonomously creates a
  Beads epic** (`bd create "[feature]" --issue_type epic -p 2 --json`).

**UX problem — Anti-pattern: Irreversible action with no confirmation:**  
The epic creation is durable (persists in Beads, auto-injected in future sessions via memory).
The user never sees a "here's the epic I'll create — confirm?" prompt.  
The 9-dimension sweep output is also never surfaced to the user before it becomes the basis
for the epic description.

**Evidence (discover.yaml prompt, Steps 4–5):**
```
## Step 4 — Discovery workflow (Medium+)
- Delegate to `ux-researcher` ...
- Delegate to `product-owner` ...
- Run the 9-dimension implicit-requirement sweep.
- Write `.specs/features/{{ feature }}/discovery.md`.
- Create Beads epic: `bd create ...`   ← no gate
```

**Second UX problem — Abstraction level too high for the user:**  
The `ux-researcher` and `product-owner` agent delegations are internal. The user sees a spinner
equivalent — no plain-language signal of what those sub-agents are doing.

**Recommendation:**  
- Add a **pre-epic confirmation gate** for Medium+ scope:  
  > "I've drafted the discovery document at `.specs/features/[x]/discovery.md`.  
  > Here are the 3 acceptance criteria I'll encode in the epic — confirm to create, or edit the file first."  
- Surface sub-agent activity in a brief sentence (not just an internal delegation):  
  > "Delegating to ux-researcher for persona mapping — this usually takes 2–3 turns."

---

### 3.2 SPEC — User is a passive bystander

**What happens:**  
- Step 0: elicitation gate (same as discover).  
- Steps 2–5: agent reads discovery.md, writes spec.md, delegates to `architect` and `tdd-guide`
  for feasibility/testability checks, then **autonomously creates Beads stories** for every P1 AC.

**UX problem — No user sees the spec before stories are created:**  
The Spec Closure Gate (unambiguity, open questions, implicit dimensions) runs *internally*.
The user is not a participant in this gate — they can't reject an AC, adjust scope, or mark an
implicit dimension as out-of-scope before it is committed to Beads.

**Evidence (spec.yaml instructions, Spec closure gate):**
```
## Spec closure gate (before confirming)
1. Unambiguity: ...
2. Open questions: ...
3. Implicit dimensions: ...
If any item fails: fix inline. Do not present spec until gate passes.  ← internal only
```

The instruction "Do not present spec until gate passes" reads as a quality guard but it
**implicitly removes the user** from the gate. The gate passes or fails with no user consultation.

**UX problem — Story creation is irreversible without manual cleanup:**  
`bd create "Story: <title>" --deps "partOf:<epic-id>" ...` runs in a loop over all P1 stories.
If the spec has an error in scope, the user must manually delete stories; no undo flow exists.

**Recommendation:**  
- Insert a **spec review checkpoint** between Step 3 (write spec) and Step 5 (create stories):  
  > "Spec draft written to `.specs/features/[x]/spec.md`. Please review the [N] acceptance
  > criteria. Reply 'approve' to create Beads stories, or edit the file and say 'revised'."  
- Rephrase the gate instruction: "Run spec closure gate. If gate passes, **present spec to
  user** for review before creating Beads artifacts."

---

### 3.3 PLAN — Gate is scope-conditional but not communication-conditional

**What happens:**  
- Plan table is printed after all beads created — good transparency pattern.  
- For Large/Complex scope: `bd gate create "Plan approved: [feature]" --blocks <first-impl-task-id>`
  — this IS a correct human-review gate.  
- For Medium scope (<10 tasks): **no gate**; the recipe immediately suggests claiming the first bead.

**UX problem — Medium scope falls through the gate:**  
A 10-task plan with 30+ files of blast radius has no human checkpoint before implementation
begins. The trust calibration spectrum requires earning the right to auto-approve through
demonstrated reliability — this harness has no track record mechanism.

**Evidence (plan.yaml instructions, Step 5):**
```
### Step 5 — Gate (Large/Complex scope only)
For Large/Complex scope, create a human-review gate before implementation begins:
  bd gate create "Plan approved: [feature]" ...
```

**Second UX problem — Plan table is post-hoc:**  
The plan table is printed *after* all beads are created. The user sees the plan after the
durable state has already been committed to Beads. The table should be a preview, not a receipt.

**Recommendation:**  
- Extend the gate to **Medium scope** (≥5 tasks OR any task with blast radius >3 files):  
  ```yaml
  # plan.yaml Step 5 — revised gate condition
  For Medium+ scope (≥5 tasks) OR any task touching >3 files:
    bd gate create "Plan approved: [feature]" --blocks <first-implementation-task-id>
  ```
- Print a **draft plan table before creating beads**, then create after user confirmation.
  Sequence: draft → user confirms → `bd create` loop → final plan table receipt.

---

### 3.4 IMPLEMENT — Appropriate autonomy, unclear escalation UX

**What happens:**  
- The recipe is designed for full agent autonomy — this is correct for the implementation phase.  
- RED→GREEN→REFACTOR TDD cycle runs inside the `implement` subrecipe.  
- **Max 3 fix iterations before escalating to user** (Step 4) — good escalation pattern.  
- Blast-radius control via `bd update <id> --claim` — correct, but invisible to user.

**UX problem — Escalation UX is undefined:**  
"Max 3 fix iterations before escalating to user" appears in Step 4, but the recipe does not
specify *what* escalation looks like or *what the user should do*. The user receives a broken
test report with no next-step guidance.

**Evidence (implement.yaml prompt, Step 4):**
```
## Step 4 — Observe result (test output)
If tests PASS → proceed to Step 5.
If tests FAIL → loop back to Step 3 (fix the implementation, NOT the tests).
Max 3 fix iterations before escalating to user.   ← no escalation format defined
```

**UX problem — No progress visibility during autonomous TDD loop:**  
The RED→GREEN→REFACTOR cycle is entirely inside the subrecipe. A user watching the terminal
has no signal of progress — it could be on iteration 1 or iteration 3 with no differentiation.

**UX problem — "First visible output" pattern missing:**  
discover, spec, plan, and verify all require a structured "First visible output" block before
any tool call. implement.yaml does not. The user doesn't know what the agent is about to do
until it does it.

**Recommendation:**  
- Add a **"First visible output"** block to implement.yaml:  
  > "Implement scope: [bead-id]  
  > Spec reference: [FEAT]-NN ACs: [list]  
  > Files to touch: [list from blast-radius estimate]  
  > Starting RED phase."  
- Define escalation message format: when 3 iterations fail, output:  
  > "⛔ Escalation: 3 fix attempts failed. AC [FEAT]-NN requires guidance.  
  > Current failure: [test name + error]. Options: (a) adjust the AC in spec.md, (b) pair-program via new session, (c) mark bead as blocked."
- Log each iteration as a visible progress event: "RED ✓ → Iteration 1 GREEN attempt..."

---

### 3.5 REVIEW — Good verdict model, missing return-path

**What happens:**  
- First visible output includes review type + scope.  
- Clear verdict states: `APPROVE | PASS-WITH-NITS | BLOCK` — well-defined.  
- AC-without-test gap detection creates a `remember_memory` entry — good internal tracking.

**Minor UX problem — BLOCK verdict has no defined return path:**  
When the verdict is BLOCK, the recipe ends. There is no instruction for what happens next:
does the user reopen the implement bead? File a new one? Run implement.yaml again?
The user lands in a dead end.

**Evidence (review.yaml instructions, Self-validation checklist):**
```
## Self-validation checklist (before returning)
- [ ] Verdict stated: APPROVE | PASS-WITH-NITS | BLOCK
```
No `# On BLOCK` branch is defined in the prompt.

**Recommendation:**  
- Add an `## On BLOCK` section to the review prompt:  
  > "If verdict is BLOCK: create a Beads issue with `--assignee implementation-worker` linking
  > to each blocking finding. Print: 'To continue: run implement.yaml with task="<new-bead-id>"'."

---

### 3.6 VERIFY — Strongest agentic UX coherence

**What happens:**  
- First visible output explicitly states target + detected type + protocol BEFORE any tool call.  
- Auto-detection from file signals (`.bru`, `package.json`, Figma, etc.) with a clear decision table.  
- Failure loop: `PASS → close bead. FAIL → file Beads issue → re-verify (max 3)` — clear state machine.  
- Max-3-cycles escalation is consistent with implement.yaml.

**No critical findings.** One minor observation:

**Minor: `auto` target_type could produce wrong protocol silently:**  
If `target_type: auto` detects incorrectly (e.g., a CLI tool with a `package.json`), the user
has no override mechanism short of re-running with explicit `target_type`. The first visible
output does surface the detected type — the user *can* abort — but the recipe doesn't prompt
for confirmation before proceeding.

**Recommendation:**  
- For `target_type: auto` detection, add one line after the first visible output:  
  > "Detected [type]. Proceeding with [protocol] in 5 seconds — reply 'stop' or 'override
  > type=[correct-type]' to change before I begin."

---

## 4. Cross-Cutting Gaps

### 4.1 Role-shift events are never announced

Across all six recipes, the user's role silently shifts between operator, supervisor, and
absent-observer. The agentic-ux principle requires making this shift legible:

| Transition | Current signal | Required signal |
|---|---|---|
| Discover Step 0 → Step 1 | None | "Taking over — I'll now run discovery autonomously." |
| Spec Step 3 → Step 5 | None | "Spec gate passed. Ready to create Beads stories." |
| Plan → Implement | "next command" suggestion | Explicit gate (Medium scope) |
| Implement finish → Review start | "next step: review" | "Implementation complete. Run review.yaml to proceed." |
| Review BLOCK → Implement | Not defined | See §3.5 |

### 4.2 No accessible "stop" mechanism

**Anti-pattern hit:** the agentic-ux principle states: "Never bury the 'stop' action — it must
always be accessible."

No recipe surfaces a stop mechanism to the user. The implicit stop is killing the terminal
session, which:
- Does not close the Beads bead (leaves orphaned claimed tasks)
- Does not record a memory of where the agent stopped
- Loses any partial progress

**Recommendation:**  
Each recipe should open with (or include as a footer): 
> "At any point, say 'stop' to pause. I'll close the current bead, store progress in Beads, 
> and print the resume command."

This can be implemented as a universal prompt prefix in a shared recipe instruction block.

### 4.3 Memory writes are invisible to users

All six recipes write to `remember_memory` or `bd remember`. These writes affect every
future session, but the user never sees what is being persisted. A malformed or incorrect
memory entry silently pollutes future context.

**Recommendation:**  
After each memory write, print a one-line summary:
> "Stored: `sdd/phase → 'GREEN | Bead: B-42 | AC: FEAT-01, FEAT-02 | Tests: 4 passing'`"

### 4.4 Sub-agent activity is opaque

`discover` delegates to `ux-researcher` and `product-owner`; `spec` to `architect` and
`tdd-guide`; `plan` to `architect` and `planner`. These delegations are multi-turn
agent sessions, but the parent recipe treats them as black boxes.

Users watching the session have no way to know if `architect` is running a codebase analysis
or has stalled. The recipes should surface sub-agent progress in plain language (agentic-ux
principle: "Surface tool calls and external actions in plain language").

---

## 5. Anti-Pattern Summary

| Anti-pattern (from agentic-ux skill) | Where it appears | Severity |
|---|---|---|
| Irreversible action with no confirmation | discover (epic), spec (stories), plan (beads) | 🔴 High |
| Agent acts on ambiguous instructions | discover: "Feature to discover: [blank]" runs no check before tool use | 🟡 Medium |
| No visibility into tool use | All sub-agent delegations across all phases | 🟡 Medium |
| Hallucinated confidence (no uncertainty flag) | spec: gate passes silently, no open-question surfacing | 🟡 Medium |
| Agent "tries harder" after failure without escalating cleanly | implement: escalation message undefined | 🟡 Medium |

---

## 6. Strengths to Preserve

1. **"First visible output" pattern** (discover, spec, plan, verify) — enforce consistently in implement + review.  
2. **Max-N-iterations escalation** (implement, verify) — consistent and correct.  
3. **plan.yaml Large/Complex gate** — the right model; needs to be extended to Medium.  
4. **review.yaml verdict states** (APPROVE / PASS-WITH-NITS / BLOCK) — clear and actionable.  
5. **Beads as audit trail** — serves the "clear audit trail" principle; just needs to be surfaced to users.  
6. **Step 0 elicitation gate** (all phases) — blocks action until user provides scope; correct operator→supervisor handoff point.

---

## 7. Priority Remediation Backlog

```bash
# P1 — Blocking UX anti-patterns
bd create "Agentic UX: add pre-epic confirmation gate in discover.yaml (Medium+ scope)" \
  --assignee ux-researcher -p 1

bd create "Agentic UX: add spec review checkpoint before story creation in spec.yaml" \
  --assignee ux-researcher -p 1

bd create "Agentic UX: extend plan gate to Medium scope (≥5 tasks or >3 file blast radius)" \
  --assignee ux-researcher -p 1

# P2 — Supervision gaps
bd create "Agentic UX: add 'First visible output' block to implement.yaml" \
  --assignee ui-designer -p 2

bd create "Agentic UX: define BLOCK return-path in review.yaml (link back to implement)" \
  --assignee ui-designer -p 2

bd create "Agentic UX: add universal 'stop' handler across all SDD recipes" \
  --assignee ux-researcher -p 2

# P3 — Transparency improvements
bd create "Agentic UX: surface memory writes to user after each remember_memory call" \
  --assignee ui-designer -p 3

bd create "Agentic UX: add plain-language sub-agent progress signals (ux-researcher, architect, tdd-guide)" \
  --assignee ui-designer -p 3

bd create "Agentic UX: add auto-detected type confirmation pause in verify.yaml" \
  --assignee ui-designer -p 3
```

---

## 8. Self-Validation

- [x] Findings are based on evidence, not assumptions — each finding cites the specific yaml file, section, and line/block
- [x] Each recommendation is actionable with a concrete next step (exact prompt changes or bd commands)
- [x] Findings reference specific file/section (discover.yaml Step 4, spec.yaml closure gate, plan.yaml Step 5, etc.)
- [x] Beads follow-up created for anything out of scope
