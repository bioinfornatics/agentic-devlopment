---
name: cognitive-ux
description: >
  Load when evaluating usability, designing user flows, or explaining why users
  struggle with an interface using cognitive psychology evidence. Provides Laws of
  UX quick-reference (Hick, Fitts, Jakob, Miller, Gestalt, Peak-End, Von Restorff,
  Doherty) and cognitive bias analysis (anchoring, choice overload, framing, loss
  aversion). Use when auditing UX quality, making design decisions that affect
  cognitive load, or justifying design choices with research-backed principles.
metadata:
  author: phazurlabs (adapted for harness)
  upstream: https://github.com/phazurlabs/ux-ui-mastery/tree/main/skills/cognitive-psychology-ux
  version: 1.0.0
---

# Cognitive Psychology for UX Design

Every design decision is ultimately processed by a human brain. Cognitive psychology
explains why some interfaces feel effortless while others leave users confused or
exhausted. This skill provides the scientific foundations that transform design from
an opinion-driven craft into an evidence-based discipline.

## Core Laws of UX (quick reference)

| Law | Principle | Design implication |
|---|---|---|
| **Hick's Law** | Decision time increases with number of choices | Reduce options; use progressive disclosure |
| **Fitts's Law** | Time to hit target ∝ distance/size | Make frequent targets large and close |
| **Jakob's Law** | Users prefer familiar patterns | Match existing mental models; innovate carefully |
| **Miller's Law** | Working memory holds 7±2 chunks | Group related items; chunk long forms |
| **Gestalt** | Proximity, similarity, closure, continuity | Proximity groups related elements; whitespace separates |
| **Peak-End Rule** | People judge experiences by peak moment + end | Design a memorable peak and a clean exit |
| **Von Restorff** | Distinctive items are remembered | Highlight the single most important CTA |
| **Doherty Threshold** | Productivity peaks when response < 400ms | Show progress feedback for any delay >100ms |

## Cognitive Biases that affect design decisions

- **Anchoring** — first number seen biases all subsequent judgments → price display order matters
- **Confirmation bias** — users filter information supporting existing beliefs → don't bury important caveats
- **Choice overload** — too many options cause paralysis → curate, not enumerate
- **Framing effect** — "95% fat free" vs "5% fat" produce different reactions → frame positively
- **Loss aversion** — losses feel 2× larger than equivalent gains → "don't miss X" outperforms "get X"
- **Cognitive load** — mental effort required to understand and use an interface → simplify, chunk, sequence

## Applying cognitive principles in practice

**Before designing:** Ask — what cognitive load does this impose? What mental model will users bring?
**During design:** Apply the relevant law to the specific interaction. Cite the law in design rationale.
**During evaluation:** Identify where cognitive load spikes (Miller violation), where choices paralyse (Hick), where targets are hard to hit (Fitts).

## When to load references (progressive disclosure)
- Laws of UX with formulas and code examples → load `references/laws-of-ux-encyclopedia.md`
- Cognitive biases catalogue → load `references/cognitive-biases-design-patterns.md`
- Neurodesign and engagement science → load `references/neurodesign-engagement-science.md`

## Beads follow-ups
```bash
bd create "UX: reduce cognitive load in <flow> — Hick's Law violation" --assignee ux-researcher -p 2
bd create "UX: redesign target size for <element> — Fitts's Law" --assignee ui-designer -p 3
```
## Knowledge generation — orient first

Before applying this skill, generate context:
1. Read the relevant files (use `analyze` or `read` tools)
2. Identify the specific scope (component, feature, endpoint)
3. Only then apply the methodology in this skill
## Self-validation checklist

Before completing the task:
- [ ] Findings are based on evidence, not assumptions
- [ ] Each recommendation is actionable with a concrete next step
- [ ] Findings reference specific file/line/component
- [ ] Beads follow-up created for anything out of scope
