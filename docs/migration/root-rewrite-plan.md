# Root rewrite migration plan

## Target

Repository: git@github.com:bioinfornatics/agentic-devlopment.git
Branch: main
Prepared from: cbb7265526477713adc1dff7810745cedcf6d630

The rewritten root retains canonical harness sources, manifests, lockfiles, release/build/install/evaluation tooling, tests, documentation, and Eval Hub source. Eval Hub remains outside release archives.

## Remove from version control

Generated dist trees, node_modules, Vite caches, Python caches, session/runtime databases including WAL/SHM, local installations, and evaluation run outputs. The migration must use git rm --cached or a clean-index branch; deleting user working copies is not required.

## Pre-publication gates

1. All harness integration and E2E tests pass from a fresh clone.
2. Secret scan returns no real credential or private key.
3. Release dry-run produces a reproducible digest and evaluates that digest.
4. Remote, branch, target commit, and collaborator impact are shown to a human.
5. Create and verify remote tag pre-harness-rewrite-2026-07.
6. Prefer a normal commit replacing root content. Force push is prohibited unless separately and explicitly approved.

## Rollback

Reset main to the verified backup tag through a reviewed pull request. If an explicitly approved history rewrite is used, restore the tag with --force-with-lease only after another human approval.

## Publication status

Prepared only. No tag, push, branch protection change, deletion, or remote mutation has been performed.
