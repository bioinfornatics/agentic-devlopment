# HAR AC-to-Test Traceability and RED Plan

> Created: 2026-07-25
> Spec: .specs/features/harness-audit-remediation/spec.md
> ADR: docs/adr/ADR-002-har-remediation-strategy.md
> Beads: agentic-devlopment-36ws.3

## Purpose

Map every HAR acceptance criterion to:
1. A test file path and runnable command.
2. The expected failure message BEFORE implementation (RED state).
3. The expected pass condition AFTER implementation (GREEN state).

Every entry is binary measurable. No subjective criteria.

---

## Prerequisite: HAR-01 spec update

HAR-01 currently references `/dev` which is in `.goose.old/`. Before any RED task:

```bash
# Update the spec to reference /loop-engineering
sed -i 's|WHEN \`/dev\` runs|WHEN \`/loop-engineering\` runs|g' \
  .specs/features/harness-audit-remediation/spec.md
```

The RED tests for HAR-01 must be written against `loop-engineering.yaml`.

---

## Traceability table

| Criterion | Test file | Command | RED failure message | GREEN condition |
|---|---|---|---|---|
| HAR-01 lifecycle ordering | `apps/eval-hub/src/domains/execution/__tests__/har01Lifecycle.test.ts` | `npx vitest run har01` | `expected lifecycle step 'env:reviewed' before 'env:verified'` | all lifecycle order tests pass |
| HAR-01 reviewed gate | `apps/eval-hub/src/domains/execution/__tests__/har01Lifecycle.test.ts` | same | `expected gate to require env:reviewed` | gate tests pass |
| HAR-02 entrypoints | `apps/eval-hub/src/domains/execution/__tests__/har02RecipePaths.test.ts` | `npx vitest run har02` | `ENOENT: recipe entrypoint not found` | all 4 recipe files resolve |
| HAR-02 subrecipes | same | same | `ENOENT: subrecipe path not found` | all subrecipe references resolve |
| HAR-03 name uniqueness | `apps/eval-hub/src/domains/execution/__tests__/har03KGConformance.test.ts` | `npx vitest run har03` | `duplicate KG node name: <name>` | no duplicates |
| HAR-03 endpoints | same | same | `unresolved KG endpoint: <id>` | all endpoints resolve |
| HAR-03 LOADS_SKILL | same | same | `missing LOADS_SKILL relation for agent: <name>` | all agents emit LOADS_SKILL |
| HAR-04 issue_type | `apps/eval-hub/src/domains/persistence/__tests__/har04BeadsAdapter.test.ts` | `npx vitest run har04` | `expected field issue_type in evidence record` | field present |
| HAR-04 dependencies | same | same | `expected nested dependencies field` | field present |
| HAR-04 non-mutation | same | same | `source checksum changed after read` | byte-for-byte identical |
| HAR-05 lifecycle inversion | `apps/eval-hub/src/domains/execution/__tests__/har05Regression.test.ts` | `npx vitest run har05` | `lifecycle inversion detected` | rejected |
| HAR-05 dangling paths | same | same | `dangling recipe path: <path>` | rejected |
| HAR-05 invalid KG | same | same | `invalid KG endpoint` | rejected |
| HAR-05 Beads schema regression | same | same | `Beads schema field missing` | rejected |
| HAR-06 AC-EVAL-03 | `apps/eval-hub/src/domains/execution/__tests__/har06EvalTrace.test.ts` | `npx vitest run har06` | `AC-EVAL-03 has no executable evidence` | canonical validation relation present |
| HAR-06 AC-EVAL-04 | same | same | `AC-EVAL-04 has no executable evidence` | canonical validation relation present |
| HAR-06 AC-EVAL-05 | same | same | `AC-EVAL-05 has no executable evidence` | canonical validation relation present |

---

## RED plan — command for each slice

```bash
# All tests must FAIL before implementation:

# HAR-01
npx vitest run apps/eval-hub/src/domains/execution/__tests__/har01Lifecycle.test.ts
# Expected: all tests fail — lifecycle checks not yet implemented

# HAR-02
npx vitest run apps/eval-hub/src/domains/execution/__tests__/har02RecipePaths.test.ts
# Expected: all tests fail — path validators not yet implemented

# HAR-03
npx vitest run apps/eval-hub/src/domains/execution/__tests__/har03KGConformance.test.ts
# Expected: all tests fail — KG conformance checks not yet enforced

# HAR-04
npx vitest run apps/eval-hub/src/domains/persistence/__tests__/har04BeadsAdapter.test.ts
# Expected: all tests fail — Beads adapter fields not yet present

# HAR-05 (integration — depends on HAR-01..04 implementations)
npx vitest run apps/eval-hub/src/domains/execution/__tests__/har05Regression.test.ts
# Expected: all tests fail — regression suite not yet assembled

# HAR-06
npx vitest run apps/eval-hub/src/domains/execution/__tests__/har06EvalTrace.test.ts
# Expected: all tests fail — KG eval traceability not yet wired
```

## Validation constraints

- Test files added in RED state contain ONLY test code; no production code changes.
- Each slice is a separate commit touching only its declared test file.
- `npx tsc --noEmit` must exit 0 after each RED commit.
- The existing 577 tests must continue to pass after each RED commit (no regressions).

## AD-002 check per slice

```bash
python3 scripts/check-consistency.py   # after every HAR slice
node apps/kg/dist/cli.js pipeline       # after HAR-03 and HAR-06 slices
```

## Traceability commit format

```
test(HAR-0N): RED — <criterion name> tests [agentic-devlopment-36ws.N]
```
