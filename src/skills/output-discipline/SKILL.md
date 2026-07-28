---
name: output-discipline
description: Keep tool outputs within token budget. Load the specific reference for your current concern. Do NOT use for implementation decisions, task framing, or evidence verdicts.
---

# Output discipline

Every byte a tool returns stays in context for every subsequent API call.
Cost is proportional to context size × number of remaining turns.
The discipline is simple: return only what the next step needs; discard the rest before it enters the context.

## Core principle

**Filter at the source.** Shrink outputs before they reach the context, not after.
A 50-char summary has the same value as a 5 000-char JSON object when the next step needs only the status field.

Three levers:

1. **Shell/Beads** — pipe every command through `jq`, `grep`, or `tail` before returning.
2. **execute_typescript** — `run()` must return < 500 chars or a structured array of small objects.
3. **Context lifecycle** — persist decisions in Beads immediately; never carry raw output across turns.

## When to load references

Load the reference that matches your current task; do not load all three.

Writing `bd` commands or querying Beads state:
→ load `references/beads.md`

Writing shell commands (`git`, `cat`, test runners, scripts):
→ load `references/shell.md`

Writing an `execute_typescript` `run()` function:
→ load `references/typescript.md`

## Universal rule

Before any `run()` return or shell pipeline, ask:

- Could the next step act on a one-line summary instead of this full output?
- If yes, summarise now.

## Context lifecycle

Context grows O(turns). Two controls limit it:

**Beads-first** — extract the decision or evidence from a large output, persist it with
`bd comment ID "EVIDENCE …"`, and return only the Beads ID plus a one-line summary.
The raw output never needs to re-enter the context.

**Session boundary** — start a new delegate when the task is independently scoped
(different file set, different role). Pass state via Beads IDs, not inline content.

Never copy large output into a Beads comment. Store the reference (command, exit code,
artifact path), not the output itself.

## Knowledge about next step

Before returning any output, identify what the next step needs: a status, a summary, a specific field, or a full object. Persist decisions and evidence in Beads so raw output does not re-enter the context. This knowledge about next-step needs is the single most important input to output sizing.

- [ ] The knowledge needed by the next step was identified before sizing output.

## Self-check

- [ ] Every shell command that can produce > 20 lines ends with `| jq`, `| grep`, or `| tail -N`.
- [ ] `run()` return is < 500 chars or a structured array of small objects.
- [ ] Large outputs are summarised into a Beads comment, not kept in the conversation.
- [ ] New delegate sessions receive Beads IDs for context, not inline content.
- [ ] `Summon.delegate({ async: true })` is never mixed with `Summon.load` in the same `run()`.
