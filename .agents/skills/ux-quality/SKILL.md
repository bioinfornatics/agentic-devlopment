---
name: ux-quality
description: >
  Load when evaluating user experience quality of an interface: user intent alignment,
  information architecture, interaction state coverage (loading / empty / error /
  success / disabled / focus / offline states), and design coherence. Requires
  Playwright browser inspection or live snapshot as evidence. Use when auditing
  a user flow, reviewing an interactive feature, or validating that all interaction
  states are correctly handled and communicated to the user.
metadata:
  version: 1.0.0
  scope: strategic
---

# UX Quality Skill

Evaluates the *experience layer* — whether the interface serves user goals effectively.
Not the visual or technical layer (see ui-quality for that).

## Knowledge generation (always first)

1. Navigate with Playwright — screenshot at default viewport.
2. Run `browser_snapshot` — get the full page structure and labels.
3. Run `bd prime` — load existing UX research notes and past findings.
Only after these three steps: begin the evaluation below.

## Evaluation dimensions (in order)

### 1. User Intent
- What job is the user trying to complete?
- Is the primary action reachable within 2 interactions from landing?
- Does the headline / page title match the user's mental model of the task?
- **Evidence:** quote the exact user-facing copy that guides or fails the user.

### 2. Information Architecture
- Clear visual hierarchy: heading levels, section order, label clarity.
- Can users find what they need without guessing or backtracking?
- Are CTAs and form fields labelled for what they *do*, not what they *are*?
- **Evidence:** quote the labels; describe the visual hierarchy order as observed.

### 3. Interaction States
Full coverage expected — flag any missing state as a finding:
- Loading, empty, error, success, disabled, focus, offline.
- Are error messages actionable ("Enter a valid email address", not "Invalid input")?
- **Evidence:** trigger each state in the browser and describe observed behaviour.

### 4. Design Coherence
- Deliberate spacing, contrast rhythm, and typography — not generic AI-generated gradients.
- Consistent spacing scale? Clear type hierarchy (heading / body / caption / label)?
- Does the visual language reinforce the interaction hierarchy?
- **Evidence:** cite specific element + expected vs. observed; avoid subjective language.

## Gotchas

- Do NOT evaluate accessibility compliance here — that is ui-quality's scope.
- Do NOT base findings on code inspection alone — observe the interface in the browser.
- Findings must cite specific user-facing text or observed browser behaviour, not assumptions.
- Zero findings is valid — output "PASS — UX review clear" with the evidence checklist.

## Self-validation
Before finalising:
- [ ] User intent finding cites exact user-facing copy or observed flow step
- [ ] IA findings cite specific labels or navigation paths observed in browser
- [ ] Every interaction state finding was triggered in the browser (not assumed)
- [ ] Design coherence findings reference observed patterns, not personal taste

## Maker/Checker
ux-quality evaluation is verified by:
- **ui-designer** — does the design implementation match the UX intent?
- **product-owner** — do the findings align with the acceptance criteria?
- Do not self-approve HIGH/CRITICAL findings — require product-owner sign-off.

## Output format

```markdown
## UX Quality: [surface]

**Evidence:** Playwright navigation + browser_snapshot + [list of triggered states]

## Findings

| Priority | Dimension | Finding | Evidence |
|---|---|---|---|

## PASS / FAIL
[PASS — UX review clear | FAIL — N findings, highest severity: X]

## Beads follow-ups
bd create "UX: <finding>" --assignee ux-researcher -p 2 --json
```

## Beads loop

For Beads workflow commands (prime, ready, claim, close, remember), load skill: `beads`.

Skill-specific commands:
    bd create "UX: <finding>" --assignee ux-researcher -p 2  → file UX research findings
## Progressive disclosure
Load critique methodology when running a structured design review:
  Load `references/critique-methodology.md` — Liz Lerman, 30/60/90, Gestalt, Nielsen heuristics
Load UX research methods when planning user research:
  Load `references/ux-research-methods.md` — personas, journey maps, interview guides, usability scripts

## Progressive disclosure — skills spécialisés

Load ces skills quand le contexte le demande :
- `load skills cognitive-ux` — Laws of UX (Fitts, Hick, Gestalt), biais cognitifs, neurodesign. Charger quand on évalue des décisions de design ou la charge cognitive.
- `load skills agentic-ux` — patterns UX pour interfaces AI (trust calibration, progressive disclosure d'incertitude, safety UX). Charger pour tout produit avec des agents ou IA génératif.
- `load skills frontend-blueprint` — workflow de consultation design (BRIEFING → REFERENCES → DESIGN DIRECTION → BUILD). Charger pour accompagner la création d'une nouvelle interface.

### Structured discovery workflow (from frontend-blueprint)

Avant toute évaluation UX, collecter le contexte :
1. **BRIEFING** — comprendre le produit, utilisateurs, business goals
2. **REFERENCES** — collecter 3-5 exemples visuels d'interfaces que l'utilisateur apprécie (non négociable avant de juger)
3. **DESIGN DIRECTION** — identifier les tokens visuels implicites (couleur, typographie, espacement) des références
4. **Challenge proactif** — si les choix contredisent les bonnes pratiques UX, le dire explicitement
