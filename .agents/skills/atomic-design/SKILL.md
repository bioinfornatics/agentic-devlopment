---
name: atomic-design
description: >
  Brad Frost's Atomic Design methodology for UI component hierarchies.
  Load when building components, organizing a component library, evaluating
  component structure, or structuring any UI. Atoms are indivisible elements,
  molecules are small functional groups, organisms are complex sections,
  templates are page layouts. Applies to any UI framework.
license: CC0-1.0
metadata:
  author: jwilger (adapted for harness)
  upstream: https://skills.sh/jwilger/agent-skills/atomic-design
  version: 1.2.1
---

# Atomic Design

**Value:** Building UI from small, named, composable pieces makes the interface
understandable to everyone and prevents the complexity of monolithic components.

## The Four Levels — Never Skip One

Build bottom-up. Compose upward. Never jump levels.

| Level | Definition | Size guideline | Rule |
|---|---|---|---|
| **Atom** | Indivisible UI element: Button, Input, Label, Icon | ≤50 lines | One visual element, one responsibility. All visual properties from design tokens. |
| **Molecule** | Small group of atoms as a unit: FormField (label+input+error), SearchBar | ≤100 lines | One interaction pattern per molecule. |
| **Organism** | Complex component forming a distinct section: LoginForm, DataTable, NavHeader | any | One feature area. Composed of molecules + atoms. |
| **Template** | Page-level layout arranging organisms: DashboardTemplate, AuthPage | any | Defines structure + content slots. No specific data. |

**Example hierarchy:**
```
Atom:     Button, Input, Label, ErrorMessage
Molecule: FormField (Label + Input + ErrorMessage)
Organism: LoginForm (FormField × 2 + Button)
Template: AuthPage (Header + LoginForm + Footer)
```

## Key Rules

### Presentational components (no data fetching inside)
Components receive data as props and emit events. They never fetch data, manage
business logic, or hold application state.
```
Presentational: UserCard({ name, email, avatar }) → renders UI
Container:      UserCardContainer() → fetches data, passes to UserCard
```

### Design tokens for all visual properties
Every color, spacing value, font size, shadow, and radius must come from a named token.
```css
--color-primary: #0066cc;   /* token */
--spacing-sm:    8px;
.button { background: var(--color-primary); padding: var(--spacing-sm); }
/* never: background: #0066cc; padding: 8px; */
```

### Composition over inheritance
Build complex components by nesting simpler ones. Prefer slots and children
over deep prop-forwarding chains or class inheritance.

## Evaluation checklist (when auditing component structure)

- [ ] Every atom has a single visual responsibility
- [ ] No organism was built directly from raw markup (atoms exist first)
- [ ] No component contains API calls or business logic
- [ ] Every visual property traces to a design token — no hardcoded values
- [ ] Variants are composed molecules, not flag-heavy components
- [ ] Component named by what it IS, not what data it shows

## Beads follow-ups
```bash
bd create "Refactor: extract atom from organism <name>" --assignee ui-designer -p 3
bd create "Design token: replace hardcoded <value> in <component>" --assignee ui-designer -p 3
```
