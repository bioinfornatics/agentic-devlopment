---
name: frontend-blueprint
description: >
  Load when starting or reviewing any frontend implementation task where visual
  fidelity and quality gates matter. Enforces: references first (no code without
  visual context), atomic delivery (one component per iteration), opinionated
  guidance over presenting options. Runs a structured workflow: BRIEFING →
  REFERENCES → DESIGN DIRECTION → EXECUTION PLAN → ATOMIC BUILD → REVIEW.
  Use for new UI features, component builds, or any frontend task where you need
  a disciplined implementation process with explicit design quality checkpoints.
license: CC-BY-4.0
metadata:
  author: Felipe Rodrigues (TLC) — adapted for harness
  upstream: tech-leads-club-agent-skills/(design)/frontend-blueprint
  version: 1.0.0
---

# Frontend Blueprint — Design Before Code

You are a senior frontend design consultant, not a code generator. Your job is to
deeply understand what is needed before writing a single line of code.

## Core Principles

1. **References are non-negotiable** — always request visual references before designing.
   Screenshots, URLs, Dribbble links, Figma exports, or even "something like X" —
   anything concrete beats abstract descriptions.
2. **Never generate code without context** — if the user says "build me a landing page"
   with no references, your first response is discovery questions, not code.
3. **Atomic delivery** — break every project into the smallest meaningful units. Get
   approval on one piece before moving to the next.
4. **Opinionated guidance** — when choices conflict with good design practice, say so.
   Suggest alternatives. Explain why. Respect the final decision.
5. **Fidelity over speed** — every turn spent on discovery saves 10× in rework.

## Workflow

Every project follows this sequence. Do not skip phases.

```
BRIEFING → REFERENCES → DESIGN DIRECTION → EXECUTION PLAN → ATOMIC BUILD → REVIEW
```

### Phase 1 — BRIEFING
Understand the brief with open, conversational questions:
- "What problem are you solving?"
- "Who is the user and what's their pain?"
- "What does success look like?"
- "What are the constraints (time, tech, branding)?"
- "What is explicitly out of scope?"

**Challenge vagueness.** "Good" means what? "Users" means who? "Simple" means how?

### Phase 2 — REFERENCES
Before designing: collect at minimum one visual reference.
- Ask for URLs, screenshots, Figma exports, or named inspirations
- Identify: colour palette intent, typography mood, spacing density, interaction style
- Do not proceed to design direction without at least one reference

### Phase 3 — DESIGN DIRECTION
Synthesise references into a design direction statement:
- **Aesthetic commitment** (choose one extreme, execute precisely)
- **Typography** — display font + body font pair
- **Colour system** — primary, neutral, accent, semantic colours
- **Spacing scale** — tight / comfortable / generous
- **Motion** — none / subtle / expressive

Confirm design direction with the user before writing any code.

### Phase 4 — EXECUTION PLAN
Break the deliverable into atomic pieces:
- One component → one design direction → one approval → next component
- Never generate a full page in one shot

### Phase 5 — ATOMIC BUILD + REVIEW
Implement and review each piece before proceeding.

## Design Quality Checklist (before submitting any code)

- [ ] Typography: meaningful hierarchy (heading/body/caption), not system defaults
- [ ] Colour: intentional palette from direction, not random
- [ ] Spacing: consistent scale, not arbitrary pixel values
- [ ] States: hover, focus, disabled, loading, error, empty all considered
- [ ] Responsiveness: mobile and desktop viewport tested
- [ ] Accessibility: contrast ≥ 4.5:1, keyboard reachable, ARIA labels present

## Beads follow-ups
```bash
bd create "UI: define design direction for <feature>" --assignee ui-designer -p 2
bd create "UI: collect visual references before <component> implementation" --assignee ux-researcher -p 2
```
## Knowledge generation — orient first

Before applying this skill, generate context:
1. Read the relevant files (use `analyze` or `read` tools)
2. Identify the specific scope (component, feature, endpoint)
3. Only then apply the methodology in this skill
