# Domain E: Framework Adherence — Evaluation Checklist

**Purpose:** This reference is used by the LLM-as-judge system to evaluate whether an agent session
correctly followed the development methodologies mandated by the agentic harness. Framework adherence
is not bureaucratic box-checking — it is the structural guarantee that agentic work is *traceable*,
*reversible*, and *reviewable* by humans and downstream agents alike.

**Why it matters for agentic systems:** Agents lack the implicit context that human developers carry
between sessions. Without explicit methodology — specs with IDs, RED→GREEN evidence, constrained
generation — each session risks diverging from intent, accumulating invisible technical debt, or
producing untestable artifacts. The frameworks below exist precisely to make agentic work auditable.

---

## Section E1 — Spec-Driven Development (SDD)

SDD ensures every non-trivial change is grounded in a written intent with traceable acceptance criteria
before any code is written. The spec is the contract between the agent that writes and the agent (or
human) that reviews.

### E1.1 — Spec Existence

- [ ] **E1.1a** Feature has a spec file at `.specs/features/*/spec.md` (required for Medium, Large,
  and Complex tier features)
- [ ] **E1.1b** Micro and Small features have acceptance criteria documented in the Bead description
  (may skip a dedicated spec file)
- [ ] **E1.1c** Spec file exists *before* any implementation file is created or modified (chronological
  order verifiable in transcript)
- [ ] **E1.1d** Spec is linked from the relevant Bead or task (`bd create --spec <path>`)

### E1.2 — Acceptance Criteria Quality

- [ ] **E1.2a** Acceptance criteria use `[FEAT]-NN` IDs (e.g., `[SDD]-01`, `[KG]-03`) — unique,
  sequential, no gaps or duplicates within a spec
- [ ] **E1.2b** Each AC uses WHEN/THEN/SHALL format: testable condition, observable outcome, mandatory
  qualifier
- [ ] **E1.2c** No vague ACs accepted silently: phrases like "should work", "handles edge cases",
  "is fast" flagged as `SPEC_PRECISION_GAP` findings before implementation begins
- [ ] **E1.2d** ACs are traceable: each `[FEAT]-NN` ID referenced in at least one test assertion
  (see E1.5)

### E1.3 — Scale Assessment

- [ ] **E1.3a** Scale tier explicitly chosen: Micro / Small / Medium / Large / Complex
- [ ] **E1.3b** Scale assessment present at the start of the session or within the spec preamble
- [ ] **E1.3c** Tier choice justified (e.g., "3 files touched, no API surface change → Small")
- [ ] **E1.3d** If actual scope exceeds initial tier, re-assessment recorded (not silently expanded)

### E1.4 — SDD Loop Phase Order

The SDD loop has seven mandatory phases. Phases must appear in transcript order:

| Phase | Marker | Required Evidence |
|-------|--------|-------------------|
| 1. Intent | "Intent:" or bead creation | `bd create` call or explicit intent statement |
| 2. Spec | Spec file written / updated | `write()` or `edit()` on a `.specs/` file |
| 3. Graph | KG pipeline run | `node apps/kg/dist/cli.js pipeline` in shell output |
| 4. TDD | Tests written before implementation | RED phase evidence (see E2) |
| 5. Implement | Implementation code written | `write()` / `edit()` on source files |
| 6. Verify | Tests pass + consistency check | GREEN phase + `check-consistency.py` |
| 7. Learn | Bead closed, KG updated | `bd close` + optional `pipeline` re-run |

- [ ] **E1.4a** Phases 1–7 appear in order (no phase written after a later phase has begun)
- [ ] **E1.4b** No phase silently skipped for Medium+ features
- [ ] **E1.4c** If a phase is skipped for Micro/Small, the skip is explicitly acknowledged in transcript
- [ ] **E1.4d** Loop branch decision recorded at end of Verify phase (see E1.8)

### E1.5 — Spec-Anchored Tests

- [ ] **E1.5a** Each test that validates a feature contains a comment or describe-block referencing
  the `[FEAT]-NN` ID it covers (e.g., `// [SDD]-02: WHEN pipeline runs THEN derived.jsonl updated`)
- [ ] **E1.5b** Assertion values match spec-defined outcomes (not just existence checks like
  `.toBeDefined()`)
- [ ] **E1.5c** Tests cover negative / failure paths defined in WHEN/THEN ACs, not only happy path
- [ ] **E1.5d** No test anchors a spec ID it was not written to satisfy (ghost anchors flagged)

### E1.6 — Maker/Checker Split

- [ ] **E1.6a** Implementation step uses one agent or session identity; review step uses a different
  one (transcript shows different agent loaded or delegate() used)
- [ ] **E1.6b** Checker agent has not seen the implementation context before forming its verdict
  (no context leakage from maker to checker in same session)
- [ ] **E1.6c** If maker/checker split was not done, an explicit waiver is recorded with justification
  (acceptable for Micro-tier, not for Medium+)

### E1.7 — Beads Integration

- [ ] **E1.7a** `bd create` called before first file write (chronological order verified in transcript)
- [ ] **E1.7b** `bd update --claim` called when agent begins active work on the bead
- [ ] **E1.7c** `bd close --reason <text>` called after verification passes
- [ ] **E1.7d** Discovered work filed as child beads with `--deps discovered-from:<parent-id>`
  (not appended silently to the current bead scope)
- [ ] **E1.7e** Bead description contains the acceptance criteria that were used to drive the work

### E1.8 — Loop Branch Decision

After Verify phase, exactly one of these decisions must be recorded:

| Branch | Meaning | Required Action |
|--------|---------|-----------------|
| `PASS` | All ACs satisfied, tests green | Close bead, run KG pipeline |
| `FAIL-IMPL` | Tests fail; spec is correct | Re-enter Implement phase |
| `FAIL-SPEC` | Tests reveal spec was wrong | Re-enter Spec phase, update IDs |
| `ESCALATE` | 3+ iterations, no resolution | Summon principal-engineer |

- [ ] **E1.8a** Branch decision recorded explicitly in transcript (not implied)
- [ ] **E1.8b** `ESCALATE` triggered if 3 or more iterations completed without PASS
- [ ] **E1.8c** No further iteration attempted after `ESCALATE` without human confirmation

### E1.9 — Deviation Flags

- [ ] **E1.9a** `SPEC_DEVIATION` comment added to any implementation that differs from the spec
  (not left as silent divergence)
- [ ] **E1.9b** Each `SPEC_DEVIATION` is a finding in the judge report
- [ ] **E1.9c** `SPEC_PRECISION_GAP` recorded when an AC is too vague to test, before
  implementation begins

---

### E1 Scoring

**Measurement method:**

```
N_criteria_in_spec  = count of [FEAT]-NN IDs in the spec file
N_anchored          = count of [FEAT]-NN IDs referenced in at least one test assertion
anchor_ratio        = N_anchored / N_criteria_in_spec
```

| Score | Condition |
|-------|-----------|
| **PASS** | `anchor_ratio ≥ 0.80` AND all 7 SDD phases present in order AND no unresolved `SPEC_DEVIATION` |
| **PARTIAL** | `0.50 ≤ anchor_ratio < 0.80` OR exactly one SDD phase skipped (with waiver for Small) |
| **FAIL** | `anchor_ratio < 0.50` OR no spec file for a Medium+ feature OR phases out of order without waiver |

---

## Section E2 — Test-Driven Development (TDD)

TDD is the micro-loop inside the SDD Implement→Verify phases. It ensures implementation is driven
by executable specifications, not by intuition. The judge evaluates TDD by checking for evidence of
the RED→GREEN→REFACTOR cycle in the transcript.

### E2.1 — RED Phase

- [ ] **E2.1a** Failing test written *before* any implementation code for the feature under test
- [ ] **E2.1b** Test run executed after writing the test, before writing implementation
  (`shell('pnpm test')` or equivalent)
- [ ] **E2.1c** Test run output shows the specific failure message (not just "tests failed")
- [ ] **E2.1d** Failure message matches the test's assertion (confirms the test is testing the
  right thing, not failing for a compile error)
- [ ] **E2.1e** No implementation files created or edited between test write and RED confirmation

### E2.2 — GREEN Phase

- [ ] **E2.2a** Implementation written after RED confirmation
- [ ] **E2.2b** Test run executed after writing implementation
- [ ] **E2.2c** Test run output shows all tests passing (including pre-existing tests)
- [ ] **E2.2d** Only the minimal implementation needed to pass the test written (no speculative code)
- [ ] **E2.2e** No tests deleted or weakened to achieve GREEN

### E2.3 — REFACTOR Phase

- [ ] **E2.3a** If refactoring done, it occurs *after* GREEN and before the next RED
- [ ] **E2.3b** No new tests added during REFACTOR phase (refactor is structural, not behavioral)
- [ ] **E2.3c** Tests still pass after REFACTOR (GREEN maintained)
- [ ] **E2.3d** If no refactoring needed, this is explicitly noted (not silently skipped)

### E2.4 — Coverage Gate

- [ ] **E2.4a** Coverage metric reported (`pnpm test --coverage` or equivalent)
- [ ] **E2.4b** Coverage ≥ 80% for new code paths
- [ ] **E2.4c** If coverage < 80%, explicit justification provided (e.g., "error path not reachable
  in unit test; covered by integration test")
- [ ] **E2.4d** Coverage is meaningful: tests exercise failure modes, boundary conditions, and
  not just happy paths

### E2.5 — Assertion Quality

- [ ] **E2.5a** Assertions check specific values, not just existence
  - ❌ Bad: `expect(result).toBeDefined()`
  - ✅ Good: `expect(result.status).toBe('active')`
- [ ] **E2.5b** Assertions anchored to AC values defined in the spec (not arbitrary "reasonable" values)
- [ ] **E2.5c** No silent `.skip` or `.only` left in test files after session ends
- [ ] **E2.5d** No test that always passes regardless of implementation (tautology test)

### E2.6 — Test Integrity

- [ ] **E2.6a** No existing test deleted during the session without explicit justification
- [ ] **E2.6b** No existing test weakened (assertion strengthened → accepted; assertion weakened → finding)
- [ ] **E2.6c** Test file covers the specific behavior described in the bead's ACs
- [ ] **E2.6d** Integration-level changes include at least one integration test (not only unit tests)

---

### E2 Evidence Templates

The judge should locate these patterns in the transcript to confirm TDD adherence:

**RED evidence:**
```
Turn N: write('.../feature.test.ts') → [test file with failing assertion]
Turn N+1: shell('pnpm test') → FAIL
  ● feature › should return active status
    Expected: "active"
    Received: undefined
```

**GREEN evidence:**
```
Turn M: write('.../feature.ts') → [implementation]
Turn M+1: shell('pnpm test') → PASS
  ✓ feature › should return active status (12ms)
  Tests: 1 passed, 1 total
```

**REFACTOR evidence:**
```
Turn P: edit('.../feature.ts') → [structural cleanup, no behavioral change]
Turn P+1: shell('pnpm test') → PASS (still green)
```

---

### E2 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | RED phase confirmed in transcript + GREEN phase confirmed + coverage ≥ 80% or justified + no tests deleted/weakened |
| **PARTIAL** | RED or GREEN missing from transcript but tests exist + anchored assertions present |
| **FAIL** | Tests written after implementation OR no tests at all for non-trivial change OR existing tests deleted without justification |

---

## Section E3 — Generative-Driven Design (GDD)

GDD governs the use of LLM generation for harness artifacts. Generation without constraints produces
inconsistent, unvalidatable artifacts. GDD mandates that every generated artifact is produced from a
defined schema, template, or reference standard — and that the output is validated before acceptance.

**GDD applies to:**
- Skills generated by `skill-creator`
- Recipes generated from templates
- Eval scenarios generated by the harness
- Documentation generated by `build-docs.sh`
- Knowledge graph entries generated by `apps/kg`

### E3.1 — Constrained Generation

- [ ] **E3.1a** Generation is constrained by a schema, template, or reference standard (not open-ended)
- [ ] **E3.1b** Constraint source is explicitly named in the transcript (e.g., "using
  `.agents/skills/skill-creator/SKILL.md` template")
- [ ] **E3.1c** Constraint source exists in the repository (not referenced but absent)
- [ ] **E3.1d** Prompt used for generation is deterministic (same input → consistent output structure)

### E3.2 — Validation of Generated Output

- [ ] **E3.2a** Generated artifact is validated against the constraint before being accepted
- [ ] **E3.2b** Validation mechanism defined and used:
  - Recipes: `goose recipe validate <file>`
  - YAML/JSON: schema validation tool
  - Skills: structural review against SKILL.md template
  - Docs: `./scripts/build-docs.sh` builds without error
- [ ] **E3.2c** Validation output is shown in transcript (not implied)
- [ ] **E3.2d** Validation failure → artifact corrected, not silently accepted

### E3.3 — Generation Parameters

- [ ] **E3.3a** Generation parameters documented if non-default (model, temperature, prompt variant)
- [ ] **E3.3b** If re-generation is needed (first pass invalid), the new parameters or prompt
  adjustments are noted
- [ ] **E3.3c** Generated artifacts are committed with a note that they are generated (not
  hand-maintained)

### E3.4 — Versioning and Reproducibility

- [ ] **E3.4a** Generated artifacts versioned (tracked in git, not re-generated silently on each use)
- [ ] **E3.4b** Failure modes for generation documented (what invalid output looks like and how to
  detect it)
- [ ] **E3.4c** Re-generation process documented if the artifact needs to be regenerated in future

---

### E3 Scoring

| Score | Condition |
|-------|-----------|
| **PASS** | Constraint source named + validation mechanism used + validation output shown + artifact versioned |
| **PARTIAL** | Constraint implicit but recognizable + validation done but output not shown in transcript |
| **FAIL** | No constraint identified + no validation performed + artifact accepted without checking |

---

## Cross-Framework Quality Matrix

This table shows which frameworks apply to each type of harness change. A session should be judged
against all applicable frameworks for its change type.

| Change Type | SDD | TDD | GDD | Notes |
|-------------|:---:|:---:|:---:|-------|
| New skill | ✅ | ⚠️ | ✅ | GDD: skill-creator template; SDD: spec for skill behavior; TDD if skill has testable logic |
| New agent | ✅ | ⚠️ | ✅ | GDD: agent template; SDD: spec for agent persona/scope |
| New recipe | ✅ | ❌ | ✅ | GDD: recipe template + `goose recipe validate`; SDD: spec for workflow |
| Bug fix | ❌ | ✅ | ❌ | TDD only: RED (reproduces bug) → GREEN (fix) |
| Feature implementation | ✅ | ✅ | ⚠️ | SDD: spec + phases; TDD: RED→GREEN; GDD if artifacts generated |
| Documentation update | ❌ | ❌ | ✅ | GDD: constrained by doc templates; `build-docs.sh` validates |
| Eval scenario addition | ✅ | ❌ | ✅ | GDD: eval JSON schema; SDD: AC for what the eval measures |
| KG pipeline change | ✅ | ✅ | ❌ | SDD: spec; TDD: bootstrap --dry-run as RED/GREEN |
| Refactor (no behavior change) | ❌ | ✅ | ❌ | TDD: GREEN maintained through refactor |

**Legend:** ✅ Required · ⚠️ Conditional · ❌ Not applicable

---

## Domain E Scoring Rubric

Each sub-domain (E1, E2, E3) scores independently. Domain E overall score is derived from the
applicable sub-domains for the session's change type.

| Domain E Score | Condition |
|----------------|-----------|
| **PASS** | All applicable sub-domains score PASS |
| **PARTIAL** | At least one applicable sub-domain scores PARTIAL, none score FAIL |
| **FAIL** | Any applicable sub-domain scores FAIL |

---

## Evidence Templates for Domain E

### SDD Evidence (E1)

```
# Spec existence
Turn 3: write('.specs/features/my-feature/spec.md') → [spec with [FEAT]-NN IDs]

# Phase order
Turn 3: [Spec written]
Turn 5: shell('node apps/kg/dist/cli.js pipeline') → [Graph phase]
Turn 7: write('.../feature.test.ts') → [TDD phase]
Turn 9: write('.../feature.ts') → [Implement phase]
Turn 11: shell('pnpm test') → PASS [Verify phase]
Turn 12: shell('bd close --reason "All ACs satisfied"') → [Learn phase]

# Anchor ratio
Spec has: [FEAT]-01, [FEAT]-02, [FEAT]-03 (N=3)
Tests reference: [FEAT]-01, [FEAT]-02 (N_anchored=2)
Ratio: 2/3 = 0.67 → PARTIAL
```

### TDD Evidence (E2)

```
# RED
Turn 7: write('.../feature.test.ts') → test expecting status='active'
Turn 8: shell('pnpm test') → FAIL: Expected "active" Received undefined

# GREEN
Turn 9: write('.../feature.ts') → implementation setting status='active'
Turn 10: shell('pnpm test') → PASS: 1 passed

# Coverage
Turn 10: shell('pnpm test --coverage') → Lines: 87.5%
```

### GDD Evidence (E3)

```
# Constraint named
Turn 2: "Using skill-creator template at .agents/skills/skill-creator/SKILL.md"

# Validation
Turn 15: shell('goose recipe validate .goose/recipes/new-recipe.yaml') → ✓ valid

# Versioning
Turn 16: shell('git add .goose/recipes/new-recipe.yaml') → [artifact committed]
```

---

## Calibration Anchors

### E1 — SDD Calibration

**PASS anchor:** Session begins with `bd create`, writes spec with 4 `[FEAT]-NN` IDs in WHEN/THEN/SHALL
format, runs KG pipeline, writes tests that reference all 4 IDs, implements, runs tests (green), runs
`check-consistency.py`, closes bead. Loop branch: PASS recorded in final message. No `SPEC_DEVIATION`
comments in code.

**PARTIAL anchor:** Session writes spec with 3 IDs, writes tests referencing 2 IDs (66% ratio), skips
the KG pipeline step (Graph phase missing), implements and verifies. Loop branch not explicitly stated.
Scale assessment done but not documented as Micro/Small/Medium/Large.

**FAIL anchor:** Session jumps directly to implementation without writing a spec for a Large feature.
Tests added after implementation. No `[FEAT]-NN` IDs anywhere. Bead created but never closed.

---

### E2 — TDD Calibration

**PASS anchor:** Turn 5 writes test, turn 6 runs `pnpm test` and transcript shows failure with
specific assertion message. Turn 8 writes implementation, turn 9 runs `pnpm test` and shows all
passing. Coverage report shows 85%. No pre-existing tests deleted. All assertions check specific values.

**PARTIAL anchor:** Test file written before implementation file (good), but no `pnpm test` run shown
between test write and implementation write (RED not confirmed in transcript). Tests pass at the end.
Coverage not reported.

**FAIL anchor:** Implementation file (`feature.ts`) written at turn 4, test file (`feature.test.ts`)
written at turn 9. Tests pass. No RED phase possible because code existed before tests.

---

### E3 — GDD Calibration

**PASS anchor:** Session uses `skill-creator` recipe to generate a new skill. Transcript shows the
template file referenced explicitly. After generation, `goose recipe validate` and structural review
performed. Output matches SKILL.md template structure. Artifact committed to git.

**PARTIAL anchor:** Recipe generated from template but template not explicitly named in transcript.
Validation attempted but output not shown (only "ran validate, looks fine" stated). Artifact committed.

**FAIL anchor:** Agent generates a recipe YAML from scratch without referencing any template. No
validation run. Recipe has incorrect structure. No `goose recipe validate` call in transcript.

---

*Last updated: harness-judge reference library. Do not edit this file directly — it is maintained
as part of the harness-judge skill. To update evaluation criteria, file a bead against the
`harness-judge` skill and follow the SDD loop.*
