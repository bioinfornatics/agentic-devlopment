# 04 — UXR Simulation

Use simulated UX research to harden product intent, personas, jobs-to-be-done, and acceptance criteria.

## User scenario

> "Before building this, simulate user research and tell me what we should change in the spec."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe ui-ux-suite \
  --params target="<product idea or flow>" \
  --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/uiux simulate UXR for <product idea or flow>
```

Spec-first alternative:

```text
/sdd Validate product concept with UXR simulation for <product idea or flow>
```

## Recommended command

```bash
goose run --recipe ui-ux-suite   --params target="<product idea or flow>"   --params repo_path="$PWD"
```

For spec-first work:

```bash
goose run --recipe sdd-master   --params initiative="Validate product concept with UXR simulation"   --params repo_path="$PWD"
```

## UXR simulation roles

Ask Goose to simulate multiple perspectives:

- first-time user;
- power user;
- accessibility user;
- skeptical buyer;
- support/operator;
- security/compliance stakeholder;
- mobile user with poor network;
- non-native speaker.

## Prompt pattern

```text
Simulate 6 user interviews for this feature. For each persona, identify:
- job-to-be-done;
- trigger;
- success criteria;
- confusion points;
- objections;
- missing states;
- accessibility concerns.
Then convert findings into Beads-ready acceptance criteria and follow-up issues.
```

## Beads outputs

Create durable work from validated findings:

```bash
bd create "Spec: clarify onboarding success criteria" -t task -p 1 --json
bd create "UX: add empty state for first-run dashboard" -t task -p 2 --json
bd dep add <ui-empty-state-id> <spec-clarify-id>
```

## Expected output

- persona matrix;
- top product risks;
- revised acceptance criteria;
- UI states required;
- follow-up Beads;
- questions for human validation.

## Done criteria

- The spec reflects user goals, not just implementation tasks.
- Ambiguities are either resolved or gated for human decision.
- UX findings are translated into acceptance criteria and Beads.
