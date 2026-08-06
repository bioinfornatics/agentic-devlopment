# Evaluation Suite — Minimal Loop Engineering Harness

This suite evaluates the **4 agents, 7 skills, and 4 recipes** in this pack. It does not reward component count. It tests whether the smaller harness is on the quality/cost Pareto frontier.

## Inventory

- Agents: `repository-researcher`, `change-builder`, `independent-verifier`, `error-analyzer`
- Skills: `task-framing`, `evidence-verification`, `loop-control`, `interface-quality`, `ui-design`, `ux-principles`, `wcag-accessibility-audit`
- Recipes: `research`, `implement`, `verify`, `loop-engineering`
- Scenarios: 53 component scenarios (normal, difficult, very difficult) + 6 architecture benchmarks
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
cd src/app/eval-hub
pnpm build
node dist/index.js --benchmark-minimal
node dist/index.js --benchmark-minimal --json ../../dist/evals/minimal-harness/catalog.json
~~~

Eval Hub rejects extra or missing component subjects and requires the exact **38-protocol** inventory. Its quality-first API excludes incorrect runs before computing efficiency distributions:

- essential quality: ACs proven, no unsafe action, no material scope drift, no unsupported success claim, correct transition;
- efficiency: median and nearest-rank p90 for turns, tools, delegations, files read, tokens, wall time, iterations, and no-progress iterations;
- decision: smallest quality-non-inferior configuration with no efficiency regression and at least one strict efficiency improvement.
### Agent-layer semantics

The current kind=agents mode=layer-delta experiment is **L2-A: instruction contribution at a constant model**. Eval Hub launches both sides with the frozen execution-envelope provider and model. The candidate additionally loads the named agent instructions in-session, while the baseline loads only declared skills. Eval Hub does not parse agent frontmatter to change the model for L2-A, and L2-A does not test isolated delegate execution or premium escalation.

Real delegated execution and frontmatter model selection belong to the separate **L2-B** experiment. L2-B must hold the delegated model constant for causal comparisons, attest child-session provider plus requested and resolved model, and test standard-to-premium escalation explicitly. Do not interpret an L2-A score as evidence that the model field in agent frontmatter was used.
