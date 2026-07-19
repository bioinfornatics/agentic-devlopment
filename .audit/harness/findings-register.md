# Findings Register

```yaml
id: F-CRIT-001
title: 'Audit precondition blocker: Beads runtime evidence unavailable'
category: BEADS_BLOCKER
severity: critical
confidence: high
status: blocked
affected_layer: work-control
affected_files:
- .beads/issues.jsonl
expected_behavior: Audit examines Beads evidence without mutating work state.
observed_behavior: bd prime/ready/blocked command was declined; .beads/issues.jsonl
  is also modified in working tree.
evidence:
- 'shell bd prime attempt: user declined; git status shows M .beads/issues.jsonl'
impact: Beads integration, task ownership, gates, and remediation task model cannot
  be fully verified adversarially.
root_cause: Tool execution authorization boundary plus dirty worktree.
target_state: Allow read-only Beads inspection or provide exported Beads snapshot
  for audit.
acceptance_criteria:
- bd prime, bd ready --json, bd blocked --json evidence recorded
- No Beads mutation occurs
verification: Recorded command output or supplied immutable snapshot hash.
dependencies: []
proposed_owner: orchestrator
requires_separate_sdd_cycle: false
blocking: true
deferred: false
expected_quality_benefit: Complete work-control audit
expected_performance_benefit: Avoid repeated blind scans
```

```yaml
id: F-HIGH-001
title: SPEC_DEVIATION scanner reports markers requiring triage
category: DRIFT
severity: high
confidence: medium
status: open
affected_layer: frameworks/agents/recipes/specs
affected_files:
- .agents/agents/implementation-worker.md
- .agents/agents/review-critic.md
- .goose/recipes/subrecipes/implement.yaml
- .specs/features/spec-deviation-loop/spec.md
expected_behavior: SPEC_DEVIATION markers represent actionable implementation drift
  and are triaged to accept/reject/defer.
observed_behavior: Scanner found 7 markers; several appear to be instructional examples
  rather than actual source deviations, indicating possible false-positive handling
  gap.
evidence:
- './scripts/find-spec-deviations.sh output: 7 marker(s) found — triage required'
impact: Verification gate can fail on examples or leave true deviations unresolved.
root_cause: Scanner pattern does not distinguish instructional quoted markers from
  active deviation comments.
target_state: Scanner supports example exclusions or marked fixtures while preserving
  active drift detection.
acceptance_criteria:
- 0 untriaged active markers in normal audit
- examples are either excluded or explicitly labeled as examples
verification: ./scripts/find-spec-deviations.sh exits clean or produces only classified
  examples.
dependencies: []
proposed_owner: tdd-guide/review-critic
requires_separate_sdd_cycle: true
blocking: false
deferred: false
expected_quality_benefit: Better drift signal integrity
expected_performance_benefit: Less manual false-positive triage
```

```yaml
id: F-HIGH-002
title: Independent adversarial challenge agents unavailable during audit
category: BROKEN_HANDOFF
severity: high
confidence: high
status: blocked
affected_layer: orchestration
affected_files:
- .agents/agents/review-critic.md
- .agents/agents/principal-engineer.md
expected_behavior: Critical/high findings and proposals are challenged by review-critic
  and principal-engineer before judge freeze.
observed_behavior: Delegated sessions returned provider/model deployment errors and
  no substantive evidence.
evidence:
- 'delegate task results: 404 deployment claude-sonnet-4-5 not found; 400 temperature/thinking
  error'
impact: Audit lacks required independent adversarial challenge; findings are preserved
  but confidence capped.
root_cause: Runtime provider/model configuration mismatch for subagents.
target_state: Subagent model policy validates before orchestration or falls back to
  available model.
acceptance_criteria:
- review-critic and principal-engineer return evidence reports
- provider errors become explicit preflight blockers
verification: Successful delegated challenge outputs stored in adversarial-review.md.
dependencies: []
proposed_owner: principal-engineer
requires_separate_sdd_cycle: true
blocking: true
deferred: false
expected_quality_benefit: Restored maker/checker independence
expected_performance_benefit: Avoid failed subagent calls
```

```yaml
id: F-MED-001
title: Working tree is dirty before audit, including tracked harness, Beads, and KG
  files
category: AUDITABILITY
severity: medium
confidence: high
status: open
affected_layer: cross
affected_files:
- git status --short
expected_behavior: Audit baseline revision and source state are reproducible or dirty
  state is explicitly frozen.
observed_behavior: Many tracked files modified/deleted and many untracked files exist
  before audit.
evidence:
- git status --short output recorded in preconditions
impact: Cannot distinguish committed baseline from in-progress harness changes; line
  evidence may not match HEAD for future reviewers.
root_cause: Audit run on uncommitted working tree.
target_state: Audit against clean commit or capture patch/diff hash in manifest.
acceptance_criteria:
- clean status or patch bundle hash included
- all evidence references include revision and dirty-state caveat
verification: git status --short clean or manifest includes diff hash.
dependencies: []
proposed_owner: orchestrator
requires_separate_sdd_cycle: false
blocking: false
deferred: false
expected_quality_benefit: Reproducible audit baseline
expected_performance_benefit: Less re-validation
```

```yaml
id: F-MED-002
title: Agentic-development skill name appears intentionally misspelled but remains
  a cognitive/search hazard
category: NAMING_INCONSISTENCY
severity: medium
confidence: high
status: open
affected_layer: skills/agents/recipes
affected_files:
- .agents/skills/agentic-devlopment/SKILL.md
- AGENTS.md
expected_behavior: Skill names are memorable and typo-resistant; intentional historical
  misspellings have alias/migration guidance.
observed_behavior: Required path and skill name are `agentic-devlopment` (missing
  e); contract explicitly asks to verify if intentional.
evidence:
- .agents/skills/agentic-devlopment/SKILL.md name line; AGENTS.md maintenance table
  references agentic-devlopment
impact: Mis-triggering, missed loads, and user confusion.
root_cause: Historical directory/name typo preserved for compatibility.
target_state: Keep with documented alias or migrate to correctly spelled skill with
  compatibility shim.
acceptance_criteria:
- alias or migration plan exists
- recipes/agents updated consistently if renamed
verification: goose skills list and consistency checks show both compatibility and
  preferred spelling.
dependencies: []
proposed_owner: architect
requires_separate_sdd_cycle: true
blocking: false
deferred: false
expected_quality_benefit: Lower routing friction
expected_performance_benefit: Avoid failed skill loads
```
