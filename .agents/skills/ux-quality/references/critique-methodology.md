# Design Critique Methodology

*Source: phazurlabs/ux-ui-mastery design-critique-case-studies*

## Why critique is the highest-leverage design activity

Design critique is the single most cost-effective quality intervention in product
development. Identifying a design flaw in critique costs minutes; fixing it after
implementation costs days.

## Liz Lerman Critical Response Process (4 steps)

1. **Statement of Meaning** — what worked, what was meaningful, what resonated
2. **Artist as Questioner** — the author asks specific questions about their work
3. **Neutral Questions** — observers ask questions (no opinions embedded in questions)
4. **Permissioned Opinions** — opinions only with explicit permission from the author

**Why it works:** separates observation from opinion; prevents defensive responses.

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

## Nielsen's 10 Usability Heuristics (quick checklist)

1. Visibility of system status (progress, feedback)
2. Match with real world (familiar language and concepts)
3. User control and freedom (undo, redo, escape)
4. Consistency and standards (platform conventions)
5. Error prevention (design out error-prone conditions)
6. Recognition over recall (make objects and actions visible)
7. Flexibility and efficiency (shortcuts for expert users)
8. Aesthetic and minimalist design (no irrelevant information)
9. Help users recognise, diagnose, and recover from errors
10. Help and documentation (easy to find, concrete steps)

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
