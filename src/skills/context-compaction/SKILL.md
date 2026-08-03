---
name: context-compaction
description: >
  Reduce active context size before a phase transition, delegation, escalation,
  or checkpoint. Use when the context contains accumulated tool outputs,
  narrative reasoning, or superseded information that the next node does not
  need. Do not use during active investigation or implementation.
---

# Context compaction

Every byte in the active context costs tokens on every subsequent API call.
Compaction is the act of replacing large or stale content with compact,
durable references before it multiplies across future turns.

## When to compact

Compact immediately after:

- A large tool output has been processed and the result extracted.
- A sub-agent or delegate has returned and its output has been synthesised.
- A phase has completed (inventory → investigation, investigation → planning, etc.).
- The active context contains more than one screen of reasoning prose.
- Before any escalation or human gate.
- Before creating a checkpoint in Beads.

Do **not** compact in the middle of an active reasoning chain. Complete the
current node first, then compact.

## Four compaction types

### 1. Syntactic — remove noise

Delete from context:
- Repeated tool outputs for the same query.
- Superseded intermediate results.
- Log lines that yielded no finding.
- Chain-of-thought prose that led to a decision already recorded in Beads.

### 2. Structural — convert narrative to data

Replace prose observations with typed structures:

```yaml
finding:
  id: FND-001
  statement: "plugins: field in Recipe struct does not exist"
  confidence: high
  source_refs: [{artifact: "crates/goose/src/recipe/mod.rs", location: "struct Recipe"}]
```

Persist in Beads immediately. The raw prose is then safe to discard.

### 3. Semantic — fuse convergent observations

When three tool calls independently confirm the same fact, replace all three
with one finding that cites all three as sources. Do not repeat evidence.

### 4. Differential — pass only delta to next node

When the next node already knows the prior state (via Beads), pass only what
changed. Never re-summarise the full history.

## Compaction procedure

```
1. Identify what the NEXT node needs: objective, ACs, active decisions,
   unresolved unknowns, required artifacts.
2. For each item in current context, classify:
   - Required by next node → keep (compact to minimum)
   - Durable fact already in Beads → reference only (bd comment ID used)
   - Large raw output → externalise to file, keep path + 1-line summary
   - Superseded → drop
3. Rebuild context from retained items only.
4. Verify: can the next node execute without reading session history?
```

## Beads-first externalisation

```sh
# Extract decision → persist → discard inline
VERDICT=$(node validate.js 2>&1 | tail -1)
bd comment TASK_ID "EVIDENCE: exit=$? verdict=$VERDICT cmd=node validate.js"
# Never carry the full output; carry the Beads ID instead.
```

## Compaction output structure

```yaml
compaction_result:
  previous_approx_tokens: 0    # estimate before
  retained_approx_tokens: 0    # estimate after
  reduction_ratio: 0.0

  retained:
    objective: ""
    acceptance_criteria: []
    active_decisions: []
    unresolved_unknowns: []
    beads_refs: []             # IDs of Beads items holding discarded content

  next_node:
    objective: ""
    required_refs: []
    budget: {}
```

## Protected information

Never discard:
- Acceptance criteria and stop conditions.
- Active decisions (until superseded by a newer decision in Beads).
- Evidence used by an open gate.
- Rollback instructions.
- Commands that produced a finding (command + exit code + artifact path).

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Summarise a summary | Reconstruct from Beads, do not chain-summarise |
| Compact without provenance | Every retained item must cite source + artifact |
| Compact mid-reasoning | Finish the current node first |
| Discard a finding used by a gate | Keep gate evidence until the gate is resolved |
| Re-inject the archive | Archive is write-only from the active context |
