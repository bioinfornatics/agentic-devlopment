# SOTA: Spec-Driven Development — Research Report (2025–2026)

> Compiled: 2026-07-09  
> Source: Martinfowler/Böckeler (Oct 2025), github/spec-kit (119k★), TLC skill v3.2, Kiro (AWS), OpenSpec (59k★)

---

## 1. Overview: Three Levels of SDD (Böckeler, Oct 2025)

Birgitta Böckeler (Thoughtworks Distinguished Engineer) defines a 3-tier taxonomy
that cuts across all tooling:

| Level | Description | Who does it |
|---|---|---|
| **Spec-first** | Spec written before coding; used only for the active task | Kiro, spec-kit (today) |
| **Spec-anchored** | Spec kept after task; used for evolution and maintenance | TLC spec-driven (STATE.md), spec-kit aspirationally |
| **Spec-as-source** | Spec is the only file humans edit; code is fully generated | Tessl (beta), `// GENERATED FROM SPEC - DO NOT EDIT` pattern |

**Key quote (GitHub spec-kit):** *"In this new world, maintaining software means evolving specifications. The lingua franca of development moves to a higher level, and code is the last-mile approach."*

---

## 2. Tool Comparison: File Names and Structure

### 2.1 GitHub spec-kit (119k ★, Oct 2025)

**Workflow:** `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`

**Root-level memory bank (Constitution):**
```
.specify/
└── memory/
constitution.md           # Immutable project principles — core values, tech constraints,
                          # governance. "Supersedes all other practices." Amended by PR only.
```

**Per-feature directory structure:**
```
specs/[###-feature-name]/    # ### = auto-numbered 001, 002, ... 999, 1000+
├── spec.md                  # User stories (prioritised P1/P2/P3) + functional requirements (FR-NNN)
│                            # Acceptance scenarios: Given/When/Then
│                            # Key entities (data, no implementation)
│                            # Success criteria (SC-NNN, measurable)
│                            # Assumptions with [NEEDS CLARIFICATION] markers
├── plan.md                  # Implementation plan: tech context, constitution check,
│                            # project/source structure, complexity tracking, phases
├── research.md              # Phase 0: library comparisons, benchmarks, compatibility
├── data-model.md            # Phase 1: entity schemas, relationships, migrations
├── contracts/               # Phase 1 directory: API contracts (REST, WebSocket, etc.)
│   └── [endpoint].md        # One file per contract surface
├── quickstart.md            # Key validation scenarios / demo script
└── tasks.md                 # Phase 2: executable task list, parallelization markers [P],
                             # story-grouped, file-path-precise
```

**Branch strategy:** one branch per spec (`git checkout -b 003-chat-system`)  
**Naming:** `[###-kebab-feature-name]` — e.g. `003-chat-system`, `007-auth-refresh`

---

### 2.2 Kiro — AWS IDE (GA 2025)

**Workflow:** Requirements → Design → Tasks  
**Positioning:** VS Code-based IDE, spec-first only

**Steering (memory bank — flexible content):**
```
.kiro/steering/
├── product.md     # Product vision, personas, goals
├── structure.md   # Codebase topology overview
└── tech.md        # Tech stack, dependencies, constraints
```

**Per-spec directory:**
```
.kiro/specs/[feature-name]/
├── requirements.md   # "As a [role]..." user stories
│                     # GIVEN/WHEN/THEN acceptance criteria per story
│                     # Requirement IDs: e.g. REQ-001
├── design.md         # Architecture diagram (mermaid), data models,
│                     # API interfaces, component interactions,
│                     # security/error handling sections
└── tasks.md          # Numbered task list tracing back to requirement IDs
                      # UI for running tasks one-by-one in IDE
```

**Naming:** flat kebab-case under `.kiro/specs/[feature-name]/`  
**No numbering prefix.** Design doc structure varies by task type (not consistently structured).

---

### 2.3 TLC spec-driven (v3.2, Tech Leads Club)

**Workflow:** Specify → (Design) → (Tasks) → Execute — auto-sized by complexity  
**Positioning:** Skill for any AI coding agent (Claude, Gemini, etc.), spec-anchored

**Project-level state (memory):**
```
.specs/
├── STATE.md       # Decisions log (AD-NNN entries) + Handoff snapshots
│                  # Active architectural decisions constraint ALL future designs
├── LESSONS.md     # Rendered lessons from verification failures (do not hand-edit)
└── lessons.json   # Machine-owned canonical lessons state
```

**Per-feature directory:**
```
.specs/features/[feature]/
├── spec.md          # Problem statement, goals, out-of-scope table,
│                    # assumptions (never silently dropped),
│                    # user stories P1/P2/P3 with WHEN/THEN/SHALL ACs,
│                    # requirement traceability table [FEAT]-NN IDs,
│                    # success criteria (measurable)
├── context.md       # User decisions for gray areas (only when /discuss triggered)
├── design.md        # Architecture overview (mermaid), component interfaces,
│                    # data models, risks & concerns (flagged w/ mitigations)
├── tasks.md         # Granular atomic tasks, Test Coverage Matrix,
│                    # phase plan, one-task = one component/function/file
└── validation.md    # Verifier report: PASS/FAIL, per-AC evidence,
                     # discrimination sensor results, diff range
```

**Naming:** flat kebab-case `[feature]`, no numbering  
**ID format:** `[CATEGORY]-NN` e.g. `AUTH-01`, `CART-03`, `NOTIF-02`

---

### 2.4 Tessl (private beta, spec-as-source)

**Model:** 1:1 spec ↔ code file. Humans edit spec; AI regenerates code.

```
specs/
└── [module-name].spec.md    # Mirrors source file, e.g. specs/auth/login.spec.md
                              # Sections: @generate (impl intent),
                              #           @test (test scenarios),
                              #           @api (exported interface — protected)
                              # tessl build → generates corresponding .js/.ts file
                              # Generated code: "// GENERATED FROM SPEC - DO NOT EDIT"
```

---

### 2.5 Our Harness (current, agentic-devlopment)

```
.specs/
├── AGENTS.md          # Overrides for spec-writing agents
├── README.md          # Feature index
└── features/[feature]/
    ├── spec.md        # Status/Created/Scope header, Context paragraph,
    │                  # ACs in WHEN/THEN/AND format, [FEAT]-NN IDs,
    │                  # Non-goals section
    └── discovery.md   # (harness-core only) — ad-hoc discovery notes
```

---

## 3. Structured Comparison Table

| Dimension | GitHub spec-kit | Kiro (AWS) | TLC spec-driven | Tessl | Our Harness (current) |
|---|---|---|---|---|---|
| **SDD level** | Spec-first (spec-anchored aspirational) | Spec-first | Spec-anchored | Spec-as-source | Spec-anchored (retro-spec) |
| **Root memory file** | `constitution.md` | `product.md` + `structure.md` + `tech.md` | `STATE.md` + `LESSONS.md` | none (global) | `AGENTS.md` |
| **Spec filename** | `spec.md` | `requirements.md` | `spec.md` | `[module].spec.md` | `spec.md` ✓ |
| **Design filename** | `plan.md` | `design.md` | `design.md` | embedded in spec | — (missing) |
| **Tasks filename** | `tasks.md` | `tasks.md` | `tasks.md` | — | — (missing) |
| **API contracts** | `contracts/[name].md` (directory) | inline in `design.md` | inline in `design.md` | `@api` section in spec | — (missing) |
| **Data models** | `data-model.md` | inline in `design.md` | inline in `design.md` | `@generate` section | — (missing) |
| **Research artefact** | `research.md` | — | ad-hoc inline | — | — |
| **Validation report** | — | — | `validation.md` | — | — (missing) |
| **Gray-area notes** | `[NEEDS CLARIFICATION]` in spec | — | `context.md` | — | — |
| **Feature naming** | `[###-kebab-name]` | `[kebab-name]` | `[kebab-name]` | `[module-name]` | `[kebab-name]` ✓ |
| **AC format** | Given/When/Then | GIVEN/WHEN/THEN | WHEN/THEN/SHALL | @test scenarios | WHEN/THEN/AND ✓ |
| **Req IDs** | FR-NNN, SC-NNN | REQ-NNN | [FEAT]-NN | — | [FEAT]-NN ✓ |
| **Branching** | one branch per spec | per IDE workspace | not prescribed | per file | not prescribed |
| **Complexity scaling** | one workflow fits all (sledgehammer noted) | one workflow fits all | auto-sizes (small/medium/large/complex) | per-file granularity | not prescribed |

---

## 4. API Contracts vs UI Components vs Data Models — SOTA Patterns

### 4.1 API Contracts (spec-kit consensus)

```
specs/[feature]/contracts/
├── rest-api.md          # Endpoint table: method, path, request/response schemas
├── websocket-events.md  # Event names, payloads, direction (C→S, S→C)
└── grpc-proto.md        # Service definition (if applicable)
```

Pattern inside each contract file (spec-kit):
```markdown
## POST /api/v1/[resource]

**Purpose**: [one line]

### Request
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name  | string | ✓ | ... |

### Response 200
```json
{ "id": "uuid", "created_at": "ISO8601" }
```

### Error Responses
| Code | Condition |
|------|-----------|
| 400  | Validation failure |
| 409  | Conflict |
```

### 4.2 UI Components (TLC / spec-kit patterns)

No dedicated file — captured in `design.md` under a `## UI Components` section:
```markdown
## UI Components

### [ComponentName]
- **Location**: `src/components/[name]/`
- **Purpose**: [one sentence]
- **Props**: [key interface, not full TypeScript — that goes in code]
- **AC coverage**: [FEAT]-NN, [FEAT]-MM
- **Interactions**: Emits `on[Event]`, receives `[Prop]`
```

### 4.3 Data Models (spec-kit `data-model.md`)

```markdown
# Data Model: [Feature]

## Entities

### [EntityName]
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id    | UUID | PK, auto | ... |

## Relationships
- [Entity A] 1──N [Entity B]: [reason]

## Migrations
- [ ] M001: create [table]
- [ ] M002: add index on [field]
```

---

## 5. Naming Convention Analysis

| Convention | spec-kit | Kiro | TLC | Consensus |
|---|---|---|---|---|
| Feature dir | `specs/001-feature/` | `.kiro/specs/feature/` | `.specs/features/feature/` | **kebab-case, no number prefix needed unless ordering matters** |
| Spec file | `spec.md` | `requirements.md` | `spec.md` | **`spec.md`** (2/3 tools; cleaner) |
| Design/plan | `plan.md` | `design.md` | `design.md` | **`design.md`** (tech-leading; `plan.md` conflates planning+architecture) |
| Tasks | `tasks.md` | `tasks.md` | `tasks.md` | **`tasks.md`** (unanimous) |
| API contracts | `contracts/*.md` | inline | inline | **`contracts/` dir** when >1 surface |
| Data model | `data-model.md` | inline | inline | **`data-model.md`** for data-heavy features |
| Validation | none | none | `validation.md` | **`validation.md`** (TLC only; high value) |
| Memory bank | `constitution.md` | `product.md`+`tech.md` | `STATE.md`+`LESSONS.md` | **`STATE.md`** (decisions) + keep our `AGENTS.md` |

---

## 6. Recommended File Naming for Our Harness `.specs/`

### 6.1 Proposed Extended Structure

```
.specs/
├── AGENTS.md                    # Agent overrides (current) ✓
├── README.md                    # Feature index (current) ✓
├── STATE.md                     # NEW — Architectural decisions (AD-NNN) + handoff snapshots
│                                #   Adopt from TLC: project-level constraints that
│                                #   all future designs must conform to or explicitly supersede
└── features/
    └── [kebab-feature-name]/
        ├── spec.md              # CURRENT FORMAT ✓ — keep WHEN/THEN/AND + [FEAT]-NN IDs
        │                        # Add: Problem Statement, Goals, Out of Scope table,
        │                        #      Assumptions section, Non-goals (already have)
        ├── design.md            # NEW (optional) — Architecture for large/complex features
        │                        # Sections: Architecture Overview, Components, Data Models,
        │                        #           Risks & Concerns (with mitigations)
        ├── tasks.md             # NEW (optional) — Atomic tasks for Large/Complex
        │                        # Sections: Test Coverage Matrix, Phase Plan, Task list
        ├── contracts/           # NEW (optional) — API contract surfaces
        │   └── [surface].md    # e.g. rest-api.md, websocket.md, cli.md
        ├── data-model.md        # NEW (optional) — Entity schemas, relationships, migrations
        │                        # Only when feature has non-trivial data modeling
        ├── context.md           # NEW (optional) — Decisions for ambiguous gray areas
        │                        # Written only when /discuss is triggered during Specify
        └── validation.md        # NEW (optional) — Verifier report post-implementation
                                 # PASS/FAIL, per-AC evidence, gap list
```

### 6.2 Decision Matrix: Which Files to Create

| Feature Scope | Required | Conditional | Skip |
|---|---|---|---|
| **Small** (≤3 files, bug fix) | `spec.md` | — | `design.md`, `tasks.md`, `contracts/`, `data-model.md` |
| **Medium** (clear feature, <10 tasks) | `spec.md` | `tasks.md` (if >3 steps) | `design.md`, `contracts/`, `data-model.md` |
| **Large** (multi-component) | `spec.md`, `design.md`, `tasks.md` | `contracts/` (if API-heavy), `data-model.md` (if data-heavy) | — |
| **Complex** (ambiguous, new domain) | `spec.md`, `design.md`, `tasks.md`, `context.md` | all optional files | — |

### 6.3 Update to `spec.md` Template

The current WHEN/THEN/AND format aligns with TLC and is slightly cleaner than spec-kit's Given/When/Then.
**Recommendation: keep our format** but add these missing sections from SOTA:

```markdown
# Spec: [Feature Name]

> Status: Active | Retro-spec (brownfield) | Deprecated
> Created: YYYY-MM-DD
> Scope: feat-[name]

## Context
[2-3 sentences: problem, why it exists, why now]

## Goals
- [ ] [Measurable primary goal]
- [ ] [Measurable secondary goal]

## Out of Scope
| Feature | Reason excluded |
|---------|-----------------|
| [X]     | [Why]           |

## Assumptions
| Assumption | Default chosen | Rationale |
|------------|---------------|-----------|
| [ambiguity] | [decision]   | [why]     |

## Acceptance Criteria

### [FEAT]-01 — [Short title]
WHEN [trigger]
THEN [outcome]
AND [constraint]   # optional

## Non-goals
- [What we're explicitly not solving]
```

### 6.4 New `STATE.md` Template (adopt from TLC)

```markdown
# Project State

## Decisions

### AD-001 — [Decision Title]
**Date**: YYYY-MM-DD  
**Status**: active | superseded by AD-NNN  
**Context**: [Why this decision was needed]  
**Decision**: [What was decided]  
**Consequences**: [What this constrains going forward]  
**Features**: [Which spec features prompted this]

## Handoff

**Last active feature**: [feature-name]  
**Status**: [In-flight | Paused | Complete]  
**Next step**: [Exact next action]  
**Open blockers**: [Any unresolved issues]
```

---

## 7. Key Insights from SOTA

1. **`spec.md` is the universal winner** — spec-kit and TLC both use it; Kiro's `requirements.md` is an outlier.

2. **`tasks.md` is unanimous** — all three tools use this exact name for the executable task list.

3. **`design.md` beats `plan.md`** — Kiro and TLC use `design.md`; spec-kit's `plan.md` blurs architecture and project management. Our harness should use `design.md`.

4. **`contracts/` directory is the SOTA API contract pattern** — spec-kit's explicit `contracts/` dir with per-surface files is more scalable than inline sections for API-heavy features.

5. **`STATE.md` is the missing anchor for spec-anchored development** — Without it, architectural decisions made in one feature silently contradict the next. This is the single highest-value addition to our harness.

6. **Auto-sizing is critical** — Böckeler explicitly criticizes Kiro and spec-kit for forcing full workflow on small tasks ("sledgehammer to crack a nut"). TLC's complexity-tiered approach (`Small/Medium/Large/Complex`) is SOTA.

7. **`validation.md` closes the SDD loop** — TLC's verifier report (with discrimination sensor) is the only approach that makes ACs testably verifiable. Worth adopting even in lightweight form.

8. **`[FEAT]-NN` IDs in our spec.md are already SOTA** — spec-kit uses FR-NNN/SC-NNN but our format is more compact and KG-traceable.

9. **Tessl's `@api` section** hints at a future where spec files have typed interface sections. Monitor for brownfield adoption patterns as it exits beta.

---

## 8. Sources

| Source | URL / Path | Date |
|---|---|---|
| Böckeler / Martinfowler | https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html | Oct 2025 |
| GitHub spec-kit | https://github.com/github/spec-kit | Jul 2026 (119k★) |
| spec-kit constitution template | github/spec-kit/templates/constitution-template.md | — |
| spec-kit spec template | github/spec-kit/templates/spec-template.md | — |
| spec-kit plan template | github/spec-kit/templates/plan-template.md | — |
| spec-kit tasks template | github/spec-kit/templates/tasks-template.md | — |
| spec-kit SDD doc | github/spec-kit/spec-driven.md | — |
| Kiro docs | https://kiro.dev/docs/specs/ | Jun 2026 |
| TLC spec-driven SKILL.md | .../tlc-spec-driven/SKILL.md | v3.2.0 |
| TLC specify.md | .../tlc-spec-driven/references/specify.md | — |
| TLC design.md | .../tlc-spec-driven/references/design.md | — |
| TLC tasks.md | .../tlc-spec-driven/references/tasks.md | — |
| OpenSpec | https://github.com/Fission-AI/OpenSpec | 59k★ |
