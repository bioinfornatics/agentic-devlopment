# 07 — Spec Review

Review and harden a specification before implementation.

## User scenario

> "Review this spec before we build it. Is it complete and testable?"

## Run methods

### Method A — headless recipe

```bash
goose run --recipe sdd-master \
  --params initiative="review and harden the spec for <feature>" \
  --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/sdd review and harden the spec for <feature>
```

Planning alternative:

```text
/plan spec review for <feature>
```

## Recommended command

```bash
goose run --recipe sdd-master   --params initiative="review and harden the spec for <feature>"   --params repo_path="$PWD"
```

Alternative:

```bash
goose run --recipe harness-plan   --params task="spec review for <feature>"   --params repo_path="$PWD"
```

## Spec review checklist

- Problem and non-goals are clear.
- Users/personas/jobs are explicit.
- Acceptance criteria are testable.
- Data model/API/UI contracts are specified.
- Error states and edge cases are included.
- Security/privacy/compliance risks are addressed.
- Migration/rollback concerns are included.
- Observability and support workflows are included.
- Work can be split into Beads with dependencies.

## Convert spec to Beads graph

```bash
bd create "Spec: finalize <feature> acceptance criteria" -t task -p 1 --json
bd create "Implement: <feature> core path" -t task -p 1 --json
bd create "Tests: <feature> regression suite" -t task -p 1 --json
bd dep add <implement-id> <spec-id>
bd dep add <tests-id> <spec-id>
```

## Output format

```text
Spec verdict: ready | needs-clarification | not-ready
Ambiguities:
Missing acceptance criteria:
Risks:
Proposed Beads graph:
Human decisions/gates:
```

## Done criteria

- Implementation can begin without guessing.
- Test strategy follows directly from acceptance criteria.
- Open questions are gated or assigned.
