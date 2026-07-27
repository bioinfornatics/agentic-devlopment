---
name: ux-principles
description: >
  Evaluate user experience: journey completion, interaction state coverage (loading,
  empty, error, success, disabled, focus, offline), information architecture, and
  intent alignment. Requires browser navigation evidence. Use when auditing user
  flows, reviewing interactive features, or validating interaction state handling.
  Do NOT use for accessibility conformance (use wcag-accessibility-audit), visual
  design review (use ui-design), or backend-only sessions.
metadata:
  version: 1.0.0
  scope: strategic
  dependencies:
    - interface-quality
---

# UX Principles Evaluation

Evaluates **user experience quality** in rendered interfaces. Focuses on whether the interface serves user goals effectively through complete journeys and proper state handling.

**Prerequisite**: This skill requires `interface-quality` for evidence labeling standards. Load it first or it will be loaded automatically.

## Scope boundaries

| In scope | Out of scope |
|----------|--------------|
| User intent alignment | WCAG conformance (→ wcag-accessibility-audit) |
| Journey completion | Visual design tokens (→ ui-design) |
| Interaction state coverage | Code architecture |
| Information architecture | Performance metrics |
| Error message quality | Backend logic |
| Progressive disclosure | Automated testing |

## Knowledge generation (always first)

1. **Navigate the journey** — Playwright walkthrough of primary user flow
2. **Capture states** — Screenshot each interaction state (loading, empty, error, success)
3. **Map architecture** — Document navigation paths and content hierarchy
4. **Load context** — `bd prime` for existing UX research and known issues

Only after gathering evidence: begin evaluation.

## Evaluation dimensions

### 1. User Intent Alignment

Does the interface match what users are trying to accomplish?

**Check**:
- Primary action reachable within 2 interactions from entry
- Page title/headline matches user's mental model
- Navigation labels describe destinations, not internal names
- CTAs describe outcomes, not mechanisms ("Save changes" not "Submit")

**Evidence**: Quote exact user-facing copy; document interaction count to primary action.

### 2. Journey Completion

Can users complete their goal without abandoning?

**Check**:
- Clear entry point for the journey
- Progress indication for multi-step flows
- Ability to go back without losing data
- Clear completion confirmation
- Path to related next actions

**Evidence**: Screenshot sequence of journey steps; document any dead ends.

### 3. Interaction State Coverage

All interactive elements must handle these states:

| State | What user sees | Common failures |
|-------|---------------|-----------------|
| Default | Initial appearance | — |
| Loading | Progress indication | Blank screen, no feedback |
| Empty | Guidance when no data | Generic "no results" |
| Error | Actionable message | Technical jargon, no recovery path |
| Success | Confirmation | Silent completion |
| Disabled | Why and when enabled | No explanation |
| Focus | Current element indicated | Invisible focus |
| Offline | Graceful degradation | Cryptic failure |

**Evidence**: Trigger each state in browser; document observed behavior.

**Flag missing states as findings** — "Error state not implemented for [element]"

### 4. Information Architecture

Is content organized for findability?

**Check**:
- Clear visual hierarchy (heading levels reflect importance)
- Related content grouped spatially
- Navigation depth appropriate (≤3 levels for common tasks)
- Labels match user vocabulary (not internal jargon)
- Search/filter available for large content sets

**Evidence**: Document navigation paths; quote labels; measure clicks to content.

### 5. Error Message Quality

Error messages must be:

| Criterion | Good example | Bad example |
|-----------|--------------|-------------|
| Specific | "Email must include @" | "Invalid input" |
| Actionable | "Enter a valid email address" | "Error" |
| Visible | Inline near the field | Console only |
| Timely | On blur or submit | Delayed/async |
| Recoverable | Field remains editable | Form cleared |

**Evidence**: Trigger validation errors; quote exact messages; document placement.

## Output format

```markdown
## UX Evaluation: [flow/feature name]

**Evidence**: [Playwright navigation / State screenshots / User flow recording]
**Journey**: [Description of evaluated user goal]
**Entry point**: [URL or navigation path]

### Intent Alignment
[Findings with evidence labels per interface-quality standards]

### Journey Completion
[Findings with evidence labels]

### Interaction States
| State | Element | Status | Evidence |
|-------|---------|--------|----------|
| Loading | [element] | ✓/✗ | [observation] |
| Empty | [element] | ✓/✗ | [observation] |
| Error | [element] | ✓/✗ | [observation] |
| Success | [element] | ✓/✗ | [observation] |
| Disabled | [element] | ✓/✗ | [observation] |
| Focus | [element] | ✓/✗ | [observation] |

### Information Architecture
[Findings with evidence labels]

### Error Messages
[Findings with evidence labels]

## Summary

| Dimension | Status | Findings |
|-----------|--------|----------|
| Intent alignment | PASS/FAIL | N |
| Journey completion | PASS/FAIL | N |
| Interaction states | PASS/FAIL | N missing |
| Information architecture | PASS/FAIL | N |
| Error messages | PASS/FAIL | N |

**Overall**: [PASS — UX review clear | FAIL — N findings]

## Beads follow-ups
bd create "UX: <finding>" --type bug -p 2
```

## Self-validation

Before finalizing:

- [ ] Primary user journey navigated in browser
- [ ] All interaction states triggered and documented
- [ ] Findings quote exact user-facing copy
- [ ] All findings use evidence labels from interface-quality
- [ ] No HIGH/CRITICAL findings with `[ASSUMPTION]` labels
- [ ] Zero findings documented as PASS with evidence of what was checked

## Gotchas

- **Design intent ≠ implementation** — Evaluate what users see, not what was planned
- **Happy path ≠ complete coverage** — Error and edge states matter most
- **Developer perspective ≠ user perspective** — Labels should match user vocabulary
- **Mobile** — Test touch interactions separately; hover states don't exist

## Maker/Checker

UX evaluation is verified by:
- **product-owner** — Do findings align with acceptance criteria?
- **ux-researcher** — Are journey assumptions validated by research?

Do not self-approve HIGH/CRITICAL findings without stakeholder review.

## Heuristic references

When deeper analysis needed, apply:

- **Nielsen's 10 Heuristics** — Visibility, match, control, consistency, prevention, recognition, flexibility, aesthetics, recovery, help
- **Fitts's Law** — Important targets should be large and close
- **Hick's Law** — More choices = slower decisions
- **Miller's Law** — Chunk information into 7±2 groups
- **Jakob's Law** — Users expect your site to work like others they know
