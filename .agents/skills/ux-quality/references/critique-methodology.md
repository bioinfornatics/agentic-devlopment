# Design Critique Methodology

*Source: phazurlabs/ux-ui-mastery design-critique-case-studies*

## Why critique is the highest-leverage design activity

Design critique is the single most cost-effective quality intervention in product
development. Identifying a design flaw in critique costs minutes; fixing it after
implementation costs days.

## Session Roles

- **Presenter:** Shares work, provides 5 min context, then listens. Resist defending.
- **Facilitator:** Manages time, enforces framework, ensures all voices heard. Not a critic.
- **Critics:** Provide structured feedback grounded in principles/heuristics/data.
- **Note-Taker:** Records who said it, what they said, question/concern/suggestion.

## Liz Lerman Critical Response Process (4 steps)

1. **Statement of Meaning** — what worked, what was meaningful, what resonated
2. **Artist as Questioner** — the author asks specific questions about their work
3. **Neutral Questions** — observers ask questions (no opinions embedded in questions)
4. **Permissioned Opinions** — opinions only with explicit permission from the author

**Why it works:** separates observation from opinion; prevents defensive responses.

## Session Formats

| Format | Description | Best For |
|---|---|---|
| **Round-Robin** | Each critic speaks in turn (2-3 min), then open discussion | Teams with uneven seniority, preventing dominance |
| **Silent Critique** | 5-8 min independent writing before any verbal discussion | Eliminating anchoring bias, complex designs |
| **Gallery Walk** | Designs posted on walls, participants circulate and leave sticky notes | Comparing multiple concepts, large teams (8+) |
| **Design Studio** | Rapid sketch → present → critique → iterate cycles | Early exploration, wide solution space |

## Feedback Frameworks

### I Like / I Wish / What If (Stanford d.school)
- **I Like:** Specific positive observations with reasoning
- **I Wish:** Desires for change framed softly
- **What If:** Generative provocations opening new possibilities

### Rose / Thorn / Bud
- **Rose:** Strengths and why they work
- **Thorn:** Pain points and which principle they violate
- **Bud:** Opportunities and unexplored directions

### Ladder of Feedback (Harvard Project Zero)
Execute in sequence:
1. **Clarify:** Ask questions to understand before evaluating
2. **Value:** Identify what is strong, effective, or promising
3. **Concern:** Raise concerns framed as questions, not declarations
4. **Suggest:** Offer constructive suggestions tied to concerns raised

### Plus / Delta
- **Plus (+):** What should be preserved
- **Delta (Δ):** What should be changed and why

## 30/60/90 Critique Framework

| Stage | Focus | Questions |
|---|---|---|
| **30% (concept)** | Direction and intent | Is this solving the right problem? Is the mental model correct? |
| **60% (structure)** | Information architecture, flows | Does the structure support user goals? Are flows logical? |
| **90% (polish)** | Visual execution, edge cases | Does it feel right? What breaks? What was missed? |

## Jobsto-be-Done lens

For every screen or flow, ask:
- What job is the user hiring this interface to do?
- What are the functional, emotional, and social jobs?
- Does the interface make the job faster, easier, and more satisfying?
- What competing options exist? Why would the user choose this?

## Gestalt principles in critique

- **Proximity** — elements close together are perceived as related → check grouping accuracy
- **Similarity** — elements that look alike are perceived as related → check visual consistency
- **Closure** — people complete incomplete shapes → use to reduce visual noise
- **Figure/Ground** — foreground vs background distinction → check contrast and depth

## Nielsen's 10 Usability Heuristics (detailed checklist)

| # | Heuristic | Check |
|---|---|---|
| H1 | **Visibility of system status** | Progress indicators, loading states, feedback on actions |
| H2 | **Match with real world** | Familiar language, concepts users already know |
| H3 | **User control and freedom** | Undo, redo, cancel, escape routes clearly available |
| H4 | **Consistency and standards** | Platform conventions followed, internal consistency |
| H5 | **Error prevention** | Dangerous actions require confirmation, form validation inline |
| H6 | **Recognition over recall** | Objects/options visible, no memorization required |
| H7 | **Flexibility and efficiency** | Shortcuts for experts, accelerators available |
| H8 | **Aesthetic and minimalist design** | No irrelevant info, visual hierarchy clear |
| H9 | **Help recognize/recover from errors** | Error messages in plain language with solutions |
| H10 | **Help and documentation** | Easy to find, task-oriented, concrete steps |

### Redesign Failure Patterns (from phazurlabs case studies)

| Pattern | Example | Violated Heuristic |
|---|---|---|
| **Breaking spatial memory** | Snapchat 2018 — scrambled left/right swipe model | H4 Consistency |
| **Forcing wrong paradigm** | Windows 8 — touch-first UI on keyboard/mouse | H7 Flexibility |
| **Removing user agency** | Digg v4 — removed bury button, killed community | H3 User control |
| **Destroying brand vocabulary** | Twitter→X — "tweet" became "post" while users kept saying "tweet" | H4 Consistency, H2 Match real world |
| **Forced adoption through integration** | Google Plus — required for YouTube comments | H3 User control |
| **Feature removal as "modernization"** | Sonos 2024 — removed local library, alarms, queue | H3 User control |

**Core lesson:** Spatial memory in mobile interfaces is sacred. Reorganizing where content lives is like rearranging someone's home while they sleep.

## Output format for critique

```markdown
## Design Critique: [Screen/Flow]
Stage: 30% | 60% | 90%

## What's working
[3-5 specific observations]

## Primary concern
[The author's stated concern — address this first]

## Findings (by heuristic / JTBD / Gestalt)
| Severity | Principle violated | Observation | Recommendation |
|---|---|---|---|

## Questions (neutral — no embedded opinions)
- [Question 1]

## Next steps
[Concrete, prioritised actions]
```

---

## Structured Discovery (frontend-blueprint pattern)

Avant tout audit UX ou design review, collecter ces artefacts :

| Étape | Question | Livrable |
|---|---|---|
| Briefing | Qui sont les utilisateurs ? Quel problème ? | 1 paragraph |
| Références | Quels produits l'utilisateur aime-t-il ? | 3-5 screenshots annotés |
| Direction | Quels tokens visuels émergent des références ? | Liste couleur/typo/espacement |
| Friction | Qu'est-ce qui est flou ou contradictoire ? | Questions ouvertes |

**Règle fondamentale (Paul Bakaus / TLC) :** Never evaluate a design without references. "References are non-negotiable."

## WCAG 2.2 AA — checklist de vérification rapide

| Critère | Test | Outil |
|---|---|---|
| 1.1.1 Alt text | Toutes images ont alt ou aria-label | Browser dev tools |
| 1.3.1 Info & Relations | Structure sémantique (headings, lists) | axe-core |
| 1.4.3 Contrast | ≥ 4.5:1 texte normal, ≥ 3:1 grand texte | WebAIM contrast checker |
| 1.4.11 Non-text contrast | ≥ 3:1 pour UI components | DevTools |
| 2.1.1 Keyboard | Tous les workflows via Tab/Shift-Tab | Test manuel |
| 2.4.3 Focus order | Focus logique et visible | `:focus-visible` CSS |
| 2.4.6 Headings | Hiérarchie h1→h2→h3 cohérente | HeadingsMap extension |
| 2.5.3 Label in Name | Label visible inclus dans accessible name | axe-core |
| 3.2.2 On Input | Pas de changement de contexte inattendu | Test manuel |
| 4.1.2 Name, Role, Value | ARIA correct sur éléments custom | axe-core |
