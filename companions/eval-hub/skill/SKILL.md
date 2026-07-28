---
name: eval-hub
description: Run the separately packaged Eval Hub companion to evaluate an installed harness release, inspect integrity reports, or serve the local dashboard. Use when an exact release digest and Goose binary must be evaluated; do not use to build, mutate, or self-approve the harness being evaluated.
---

# Eval Hub Companion

Use the packaged Eval Hub application through the launcher in this skill. Eval Hub is an evaluator and remains separate from the core harness release.

## Required inputs

Before an evaluation identify the installed harness release path or digest, exact Goose binary path and SHA-256, layers/subjects/workers/timeout/repetitions, early-stop policy, and output directory. Do not infer a release from ambient user skills. Do not compile or download while evaluating.

## Invocation

Run `scripts/eval-hub --help` or `scripts/eval-hub --companion-self-check`. For layered evaluation, use the release-aware wrapper documented in `references/CLI.md`.

## Integrity method

1. Verify the companion binary digest before every launch.
2. Verify the installed harness release before evaluation.
3. Run only against the explicit project or release root.
4. Preserve paired comparisons and exclusion reasons.
5. Reject grading if the Goose binary or harness release changes.
6. Report intervals and exclusions without overstating direction.
7. Keep prompts, secrets, session DBs, and mutable plugin data outside release artifacts.

Load `references/INTEGRITY.md` when interpreting results. Load `references/PROVENANCE.md` when auditing package identity.

## Operational boundaries

- `--help` and `--companion-self-check` are bounded and side-effect free.
- `--run` can invoke providers and write evidence; confirm budgets and credentials.
- `--server` and `--tui` are interactive; do not start them unattended.
- Never treat Eval Hub execution as proof the harness passed.
- Never add Eval Hub to the core harness archive.

## Output

Return command, exit code, companion manifest digest, harness release digest, external lock digest, Goose binary digest, run ID, reports, exclusions, and interpretation.

## Agent Skills compatibility

This follows <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>: main instructions in `SKILL.md`, detailed material in `references/`, utilities in `scripts/`. Goose discovers `.agents/skills/eval-hub`; installation is done by the companion installer, not runtime code.
