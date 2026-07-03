# 11 — Incident / SRE Investigation

Investigate failures, flaky CI, production symptoms, or operational risk.

## User scenario

> "CI is flaky / service is failing / users report errors. Investigate and create follow-up work."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-research \
  --params task="investigate flaky CI failure" \
  --params repo_path="$PWD" \
  --params constraints="Read-only first. Identify repro, impact, mitigation, and follow-up Beads."
```

### Method B — slash command in an interactive Goose session

```text
/research investigate flaky CI failure; read-only first; identify repro, impact, mitigation, and follow-up Beads
```

Planning alternative:

```text
/plan stabilize flaky CI
```

## Recommended command

```bash
goose run --recipe harness-research   --params task="investigate flaky CI failure"   --params repo_path="$PWD"   --params constraints="Read-only first. Identify repro, impact, mitigation, and follow-up Beads."
```

If action planning is needed:

```bash
goose run --recipe harness-plan   --params task="stabilize flaky CI"   --params repo_path="$PWD"
```

## Investigation flow

1. Define symptom and blast radius.
2. Collect evidence: logs, CI output, recent changes, tests.
3. Reproduce locally if safe.
4. Identify likely root causes.
5. Separate mitigation from permanent fix.
6. Create Beads for durable work.
7. Use gates for external waits.

## Beads examples

```bash
bd create "Incident: investigate flaky auth integration test" -t bug -p 1 --json
bd create "Mitigation: quarantine flaky test with owner approval" -t task -p 1 --deps discovered-from:<incident-id> --json
bd create "Fix: remove timing dependency in auth test" -t task -p 1 --deps discovered-from:<incident-id> --json
```

## Output format

```text
Incident summary:
Impact:
Evidence:
Hypotheses:
Reproduction:
Mitigation:
Permanent fixes:
Beads graph:
Open questions/gates:
```

## Done criteria

- Incident has an owner/work item.
- Mitigation and permanent fix are not conflated.
- Follow-up work is in Beads.
