# AGENTS.md — Beads-Native Loop Engineering Pack

This repository implements a governed engineering loop for Goose. Child AGENTS.md files override these rules in their directories.

## Architecture

- Goose is the runtime: recipes, Skills, Open Plugin hooks, Summon delegates, and Orchestrator sessions.
- Beads is the sole durable loop control plane: objective, task graph, assignments, state, budgets, chronology, and evidence references.
- Git, CI, specs, and reports retain source and proof artifacts.
- Conversation context is ephemeral. Beads is the sole durable state. `.loop/` files are obsolete — do not create or read them.
- Agents, skills, recipes, and plugins are auto-discovered by Goose; always reference them by **name only**, never by path.

Generic sequence: Trigger → Planner → Builder → independent Verifier → Memory → Manager → Controller.

### Goose primitive roles in the loop

| Primitive | Role |
|---|---|
| **Recipe** | Describes the initial loop flow (`loop-engineering`, `implement`, `research`, `verify`) |
| **Subrecipe** | Encapsulates a sub-loop or delegated step |
| **Subagent** | Executes an isolated task (`change-builder`, `change-builder-premium`, `independent-verifier`, `independent-verifier-premium`, `repository-researcher`) |
| **Skill** | Provides a method or expertise (`task-framing`, `evidence-verification`, `loop-control`) |
| **Plugin** | Distributes hooks and scripts by domain (`prevent-catastrophe`, `loop-gate`, `beads-telemetry`, `loop-breaker`) |
| **Hook** | Triggers checks around lifecycle events (PreToolUse, PostToolUse, Stop) |
| **MCP** | Acts on external systems (Beads Dolt, eval-hub server) |
| **Memory / KG** | Persists state and learnings (`.knowledge/`, `src/app/kg/`) |
| **Beads** | Maintains backlog, dependencies, and states (canonical control plane) |
| **Tests / evals** | Produce proof (577+ TypeScript tests, 38-protocol eval catalog) |
| **Human gate** | Retains human judgement (APPROVE/BLOCK at `36ws.5`-style gates) |
| **Scheduler / external runner** | Launches or resumes the loop (CI, `goose recipe run loop-engineering`) |

### Beads canonical Issue fields

Every durable work item stores the following fields. The `beadsAdapter.ts` read-only adapter exposes all of them.

| Need | Native Beads field |
|---|---|
| Objective | `title`, `description` |
| Design | `design` |
| Acceptance criteria | `acceptance_criteria` |
| Working notes and context | `notes` |
| Specification reference | `spec_id` |
| State | `status` |
| Priority | `priority` |
| Work type | `issue_type` |
| Assignment | `assignee` |
| Human owner | `owner` |
| Time budget | `estimated_minutes` |
| Start and end timestamps | `started_at`, `closed_at` |
| Close reason | `close_reason` |
| Session that closed the item | `closed_by_session` |
| Deadline and deferral | `due_at`, `defer_until` |
| Additional structured data | `metadata` |
| Labels | `labels` |
| Dependencies | `dependencies` |
| Narrative log | `comments` |

## Token budget discipline

Every tool result stays in context for all subsequent API calls. Load skill `output-discipline` before any multi-step session: it covers Beads query filters (jq), shell output trimming, execute_typescript return rules (< 500 chars or structured summary), and the Beads-as-external-memory pattern. See also `loop-control/references/beads-control-plane.md` § "Beads as external memory".

## Work protocol

1. Run bd prime and inspect ready/blocked work.
2. Create or select a Beads issue with explicit acceptance criteria and spec ID.
3. Claim before the first write.
4. Load the relevant skill before acting.
5. Delegate specialists in isolated sessions; builder and verifier must differ.
6. Parallelize only dependency-free read-only work or disjoint write sets.
7. Persist compact evidence references, failure signatures, session IDs, and typed transitions in Beads.
8. Stop on completion, wait, escalation, abort, exhausted budget, or repeated no-progress.

Never use Markdown TODO files. Never run sudo. Never overwrite unrelated user changes.

## Pack artifacts

- Skills: task-framing, evidence-verification, loop-control.
- Agents: repository-researcher, change-builder, change-builder-premium (model: inherits from invoking session, rework_count ≥ 2), independent-verifier, independent-verifier-premium (model: inherits from invoking session, rework_count ≥ 2).
- Recipes: research, implement, verify, loop-engineering.
- Plugins: prevent-catastrophe (safety), loop-gate (HAR-01 env:reviewed gate), beads-telemetry (generic lifecycle telemetry), loop-breaker (consecutive tool-failure safety).
- Spec: .specs/features/loop-engineering/spec.md.
- Sequence model: docs/loop-engineering/diagrams/.

## Phase inquiry

At every phase start or recovery, ask only action-changing questions:

- Which tools, skills, permissions, and agents are required?
- Which checks and evidence can falsify success?
- Which durable facts, decisions, attempts, and blockers already exist?
- What failed and did the hypothesis change?
- What code, test, fixture, configuration, dependency, or evidence was added later?
- Can that addition make a failed criterion provable now?
- Is there measurable progress and sufficient remaining budget?

Persist concise outcomes, never chain-of-thought, secrets, raw prompts, or large logs.

## Loop prevention — two runtime layers

Infinite-loop prevention uses **two complementary Goose mechanisms**, both required in every recipe:

| Mechanism | Field | Purpose |
|---|---|---|
| `session.max_tool_repetitions: N` | recipe YAML | Caps **consecutive identical** tool+params calls; prevents the LLM from calling the same tool with the same arguments N times in a row |
| `retry.max_retries: N` | recipe YAML | Hard ceiling on **recipe-level retry cycles**; combined with `retry.checks` (shell exit-0 conditions) and `retry.on_failure: abort` |

Active values:
- `loop-engineering`: `max_tool_repetitions=5`, `max_retries=3` (Beads JSONL integrity + Beads accessible)
- `implement`: `max_tool_repetitions=5`, `max_retries=3` (Beads + tsc --noEmit)
- `verify`: `max_tool_repetitions=5`, `max_retries=2` (Beads + vitest run passes)
- `research`: `max_tool_repetitions=5`, `max_retries=3` (Beads accessible)

These work **alongside** (not instead of) the Beads `loop_max_attempts` metadata and the controller's REWORK→ESCALATE→ABORT transitions. Beads tracks logical attempts; Goose enforces the runtime floor.

## Plugin token budget

Each active plugin injects hook stubs into every session context. Current overhead with all 4 loop-engineering plugins enabled:

| Plugin | Active hooks | Est. tokens |
|---|---|---|
| `prevent-catastrophe` | 1 | ~800 |
| `loop-gate` | 1 | ~600 |
| `beads-telemetry` | 6 | ~300 |
| `loop-breaker` | 2 | ~400 |
| **Total** | **10 hooks** | **~2 100** |

> ⚠️ SOTA signal: 10 plugins ≈ 40k tokens. Keep active plugin count ≤ 6 and total hook overhead ≤ 5k tokens. See `docs/loop-engineering/MAPPING.md` for the full breakdown.

## Memory and Manager stages — inline design decision

Stages 04 (Memory) and 05 (Manager) are **intentionally handled inline** in the `loop-engineering.yaml` controller session, without dedicated subagents. This reduces latency and token cost for two low-cognitive-complexity steps. A dedicated agent would be justified only if backlog management complexity grows significantly.

## Structural change workflow

For skill/agent/recipe changes:

~~~bash
node src/app/tooling/dist/generate-tables.js
for r in loop-engineering implement research verify; do goose recipe validate $r; done
node src/app/tooling/dist/check-consistency.js
node src/app/kg/dist/cli.js pipeline
~~~

Recipe eval agents arrays list only in-session agents. Summoned agents are not Layer 2 declarations.

## Validation

~~~bash
find src/recipes -name '*.yaml' -exec goose recipe validate {} \;
for p in prevent-catastrophe loop-gate beads-telemetry loop-breaker; do sh src/plugins/$p/tests/test-plugin.sh; done
node src/app/tooling/dist/check-recipe-metadata.js
node src/app/tooling/dist/check-consistency.js
node src/app/kg/dist/cli.js bootstrap --dry-run
./src/tooling/bin/build-docs
~~~

Goose currently may emit non-fatal OpenTelemetry shutdown panic messages after successful recipe validation; use the validation result/exit code as the gate and report the runtime warning separately.