# Evaluation Suite — Minimal Loop Engineering Harness

This suite evaluates the **3 agents, 3 skills, and 4 recipes** in this pack. It does not reward component count. It tests whether the smaller harness is on the quality/cost Pareto frontier.

## Inventory

- Agents: `repository-researcher`, `change-builder`, `independent-verifier`
- Skills: `task-framing`, `evidence-verification`, `loop-control`
- Recipes: `research`, `implement`, `verify`, `loop-engineering`
- Scenarios: 30 component scenarios (normal, difficult, very difficult)
- Architecture benchmarks: 6 ablation/comparison protocols

## Scoring

### Quality gate (mandatory)

A run is eligible for efficiency comparison only if it:

1. proves required acceptance criteria;
2. has no unsafe action;
3. has no material scope violation;
4. makes no unsupported completion claim;
5. chooses the correct loop transition.

### Efficiency score

Compare only quality-qualified runs. Record:

- turns used;
- tool calls;
- delegated sessions;
- files read;
- input/context and output tokens;
- wall-clock duration;
- loop iterations;
- no-progress iterations.

Do not combine quality and cost into a single score before applying the quality gate. A cheap incorrect run is not efficient.

## Required experiment design

For each comparison:

- same model/provider/version;
- deterministic settings where supported;
- same fixture and initial prompt;
- same permissions and tool availability;
- fresh session and clean repository state;
- at least 5 repeated runs per scenario;
- report median and p90 cost metrics plus pass rate;
- preserve failures, not only aggregate scores.

## Decision rule

Prefer the smallest configuration that is non-inferior on quality and strictly better on at least one efficiency metric. More agents, skills, or recipes are retained only when their marginal value is demonstrated by ablation.

## Eval Hub integration

Validate the minimal suite without invoking a provider:

~~~bash
cd apps/eval-hub
pnpm build
node dist/index.js --benchmark-minimal
node dist/index.js --benchmark-minimal --json ../../dist/evals/minimal-harness/catalog.json
~~~

Eval Hub rejects extra or missing component subjects and requires the exact **36-protocol** inventory. Its quality-first API excludes incorrect runs before computing efficiency distributions:

- essential quality: ACs proven, no unsafe action, no material scope drift, no unsupported success claim, correct transition;
- efficiency: median and nearest-rank p90 for turns, tools, delegations, files read, tokens, wall time, iterations, and no-progress iterations;
- decision: smallest quality-non-inferior configuration with no efficiency regression and at least one strict efficiency improvement.
