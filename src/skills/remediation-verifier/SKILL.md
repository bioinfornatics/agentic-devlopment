---
name: remediation-verifier
description: >
  Verify that a harness remediation achieved its stated goal without introducing
  regressions. Use after applying any change to plugins, recipes, agents, skills,
  or manifests. Do not use for product-level feature verification.
---

# Remediation verification

A claimed fix is a hypothesis until deterministic evidence confirms it.
This skill governs the verification of harness-level changes, not product changes.

## Verification sequence

### 1. Define the before/after contract

Before running any check, state:

```yaml
remediation:
  finding_id: FND-XXX
  root_cause: ""
  change_description: ""
  expected_effect: ""
  rollback: "git revert <sha>"
  verification_commands: []
```

Never verify without a written expected effect.

### 2. Run deterministic checks — harness layer

Run the full harness validation suite after every change:

```sh
# 1. Manifest integrity
node src/app/harness-release/dist/validate-harness-manifests.js

# 2. Recipe validity
find src/recipes -name '*.yaml' -exec goose recipe validate {} \;

# 3. Plugin smoke tests
for p in prevent-catastrophe loop-gate beads-telemetry loop-breaker budget-tracker; do
  bash src/plugins/$p/tests/test-plugin.sh
done

# 4. Knowledge graph dry-run
node src/app/kg/dist/cli.js bootstrap --dry-run

# 5. Docs build (syntax check)
bash -n src/tooling/bin/build-docs
```

All five checks must pass before claiming a fix is verified.

### 3. Verify the specific fix

For each finding, run the discriminating test that proved the defect:

```sh
# Example: FND-008 — correct guard path
grep 'harness-manager/dist/loop-transition-guard' src/recipes/loop-engineering.yaml | wc -l
# expected: 2

# Example: FND-005 — no stale tooling refs
grep -c 'tooling/dist' AGENTS.md
# expected: 0

# Example: budget-tracker — blocking works
GOOSE_TOOL_BUDGET=0 bash src/plugins/budget-tracker/tests/test-plugin.sh
# expected: All tests passed
```

### 4. Regression check

For every file changed, check its consumers:

```sh
# Which files reference a changed recipe?
grep -r 'loop-engineering' src/ docs/ AGENTS.md --include='*.yaml' --include='*.md' -l

# Which plugins reference a changed path?
grep -r 'src/app/tooling' src/plugins/ --include='*.sh' --include='*.json'
```

### 5. Evidence record

Persist compact evidence in Beads before closing the task:

```sh
bd comment TASK_ID "EVIDENCE: validate-manifests=OK recipes=4/4-valid plugin-tests=5/5-passed discriminating-test=<cmd>=<exit>=<observed>"
bd tag TASK_ID env:reviewed
bd close TASK_ID --reason "verified: <expected effect> confirmed by <command>"
```

A model assertion is not evidence. An exit code from a deterministic command is evidence.

## Verification gate

Do not close a remediation task unless:

- [ ] All 5 harness suite checks pass.
- [ ] The discriminating test for the specific finding passes.
- [ ] No regression was introduced in files that consume the changed artifact.
- [ ] Evidence is persisted in Beads (command + exit code + artifact path).
- [ ] The task has the `env:reviewed` label.
- [ ] The change is committed (git sha in Beads comment).

## Common false positives

| Claim | Why it is insufficient |
|---|---|
| "goose recipe validate passes" | validate ignores unknown YAML fields; semantic errors are not caught |
| "the test passed locally" | check if the test was actually exercising the changed code path |
| "no errors in logs" | absence of logged errors ≠ correct behaviour |
| "the model says it works" | model assertion is not evidence |
| "it worked before so it still works" | confirm with a targeted discriminating test |