# Remediation Proposal

AUDIT_ONLY: no Beads were created or modified. Proposed remediation Epic only.

## Proposed Epic

Title: Harness audit remediation — evidence preflight, drift triage, and handoff schema hardening

## Proposed tasks

1. F-CRIT-001: Provide read-only Beads snapshot path or approve bd prime/ready/blocked audit commands. AC: immutable snapshot hash and work-control graph included.
2. F-HIGH-002: Add subagent/provider preflight validator for all recipe-required agents/models. AC: failed model deployment is detected before delegation.
3. F-HIGH-001: Refine SPEC_DEVIATION scanner to classify examples/fixtures vs active deviation comments. AC: current instructional examples no longer block normal scan unless intentionally active.
4. F-MED-001: Add audit baseline manifest step capturing clean HEAD or patch hash. AC: final audit can be reproduced from revision+diff.
5. F-MED-002: Decide `agentic-devlopment` alias/migration. AC: preferred spelling documented and compatibility tested.

Required gates: Audit Evidence Complete → Target State Approved → Implementation Ready → Verification Complete → Independent Review Complete.
