# 10 — Release Readiness

Prepare and verify a release with gates and durable handoff.

> **Note:** There is no standalone `release` recipe in the active pack. Release readiness is
> orchestrated through the standard `loop-engineering` recipe with a release-scoped Beads epic,
> or executed manually using the verification gate commands below.

## User scenario

> "Prepare release 1.2.3, wait for CI, verify packages, and hand off."

## Run method — loop-engineering recipe

```bash
# Create a release epic in Beads, then run the loop-engineering recipe
bd create --title "Release gate: 1.2.3" --type epic
goose recipe run loop-engineering
```

## Manual release verification sequence

When release is blocked, run these checks directly:

```bash
# 1. Recipe validation
find src/recipes -name '*.yaml' -exec goose recipe validate {} \;

# 2. Plugin tests
for p in prevent-catastrophe loop-gate beads-telemetry loop-breaker; do
  sh src/plugins/$p/tests/test-plugin.sh
done

# 3. KG bootstrap dry-run
node src/app/kg/dist/cli.js bootstrap --dry-run

# 4. Check consistency (metadata, recipe contracts)
node src/app/harness-release/dist/validate-harness-manifests.js
node src/app/harness-release/dist/validate-harness-manifests.js

# 5. Full test suite
cd apps && pnpm -r test

# 6. TypeScript tooling and corpus tests
pnpm --dir src/app --filter @harness/tooling test

# 7. Docs build
./src/tooling/bin/build-docs
```

## Release phases

1. Preflight git/worktree/branch.
2. Verify clean or intentionally dirty state.
3. Confirm versions/changelog.
4. Run tests/build.
5. Commit/tag/push only with explicit authority.
6. Create Beads gate for CI wait.
7. Verify artifacts/packages/docs.
8. Close release bead or create follow-ups.

## Beads gates

```bash
bd gate create --blocks <verify-issue> --type gh:run --await-id <run-id> --reason "Wait for release CI"
bd gate check --type gh:run
```

## Release checklist

- version consistent across files;
- changelog complete;
- tests pass;
- CI green;
- artifacts published;
- install smoke passes;
- rollback notes written.

## Done criteria

- No irreversible operation happened without authority.
- Async waits are represented by Beads gates.
- Verification is evidence-based.