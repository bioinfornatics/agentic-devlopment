---
name: atomic-design
description: >
  Load when building, auditing, or organizing UI components and design systems using
  Brad Frost's Atomic Design hierarchy (extended with quarks). Defines six levels:
  quarks (design tokens), atoms (indivisible elements ≤50 lines), molecules (small
  functional groups ≤100 lines), organisms (complex feature sections), templates
  (page-level layouts with content slots), pages (templates with real content).
  Use when deciding where a component belongs in the hierarchy, evaluating component
  size violations, structuring a component library, or applying composition rules.
  Applies to any UI framework (React, Vue, Svelte, etc.).
  Do NOT use for backend services, API design, or sessions with no UI component hierarchy to evaluate.
license: CC0-1.0
metadata:
  author: jwilger + thebushidocollective (adapted for harness)
  upstream: https://skills.sh/jwilger/agent-skills/atomic-design
  version: 1.3.0
---

# Atomic Design

**Value:** Building UI from small, named, composable pieces makes the interface
understandable to everyone and prevents the complexity of monolithic components.

## The Six Levels — Build Bottom-Up, Compose Upward

| Level | Definition | Examples | Rule |
|---|---|---|---|
| **Quark** | Design tokens and primitive values | Colors, spacing scales, typography, shadows, radii, durations | Pure values, not UI. Cannot import from other levels. Single source of truth. |
| **Atom** | Indivisible UI element (≤50 lines) | Button, Input, Label, Icon, Avatar | One visual element, one responsibility. All styling from quarks. |
| **Molecule** | Small group of atoms as a unit (≤100 lines) | FormField (label+input+error), SearchBar, Card header | One interaction pattern per molecule. Composed of atoms only. |
| **Organism** | Complex section forming a distinct feature | LoginForm, DataTable, NavHeader, ProductCard, CommentSection | One feature area. Composed of molecules + atoms. May contain business logic. |
| **Template** | Page-level layout with content slots | DashboardTemplate, AuthPage, BlogPostLayout | Defines structure + placeholder content. No specific data. |
| **Page** | Templates with real representative content | Homepage, ProductDetail, UserProfile | What users actually see. Used for testing and validation. |

**Example hierarchy:**
```
Quark:    --color-primary, --spacing-sm, --font-size-lg
Atom:     Button, Input, Label, ErrorMessage
Molecule: FormField (Label + Input + ErrorMessage)
Organism: LoginForm (FormField × 2 + Button)
Template: AuthPage (Header + LoginForm + Footer)
Page:     Login (/login with real branding and copy)
```

## Key Rules

### 1. Presentational components (no data fetching inside)
Components receive data as props and emit events. They never fetch data, manage
business logic, or hold application state.
```typescript
// Presentational: UserCard({ name, email, avatar }) → renders UI
// Container:      UserCardContainer() → fetches data, passes to UserCard

// BAD: Atom with business logic
const PriceButton = ({ productId }) => {
  const price = useProductPrice(productId); // WRONG!
  return <Button>${price}</Button>;
};

// GOOD: Atom receives processed data
const PriceButton = ({ price, onClick }) => (
  <Button onClick={onClick}>${price}</Button>
);
```

### 2. Design tokens for all visual properties (quarks)
Every color, spacing value, font size, shadow, and radius must come from a quark.
```css
--color-primary: #0066cc;   /* quark */
--spacing-sm:    8px;
.button { background: var(--color-primary); padding: var(--spacing-sm); }
/* never: background: #0066cc; padding: 8px; */
```

### 3. Props flow downward, imports flow downward
```typescript
// Atoms receive primitive props
interface ButtonProps { variant: 'primary' | 'secondary'; size: 'sm' | 'md' | 'lg'; }

// Molecules receive atoms' props via spread
interface SearchFormProps { onSubmit: (q: string) => void; inputProps?: Partial<InputProps>; }

// NEVER import upward (atoms importing from molecules = circular dependency)
```

### 4. Composition over inheritance
Build complex components by nesting simpler ones. Prefer slots and children
over deep prop-forwarding chains or class inheritance.

### 5. Document component purpose with @level
```typescript
/**
 * Button - Atomic component for user actions
 * @level Atom
 */
export const Button = ({ ... }) => { ... };

/**
 * SearchForm - Search input with submit button
 * @level Molecule
 * @composition Input, Button
 */
export const SearchForm = ({ ... }) => { ... };
```

## Common Pitfalls

| Pitfall | Bad | Good |
|---|---|---|
| Over-atomization | ButtonText, ButtonContainer as separate atoms | Single Button atom |
| Under-atomization | MegaForm with inline labels/inputs | FormField molecules composed into ContactForm |
| Circular deps | `atoms/Icon.tsx` imports from `molecules/` | Imports always flow downward |
| Inconsistent naming | btn.tsx, InputField.tsx, text-label.tsx | Button.tsx, Input.tsx, Label.tsx (PascalCase) |

## Evaluation checklist (when auditing component structure)

- [ ] Every atom has a single visual responsibility
- [ ] No organism was built directly from raw markup (atoms exist first)
- [ ] No component contains API calls or business logic (except organisms+)
- [ ] Every visual property traces to a design token (quark) — no hardcoded values
- [ ] Variants are composed molecules, not flag-heavy components
- [ ] Component named by what it IS, not what data it shows
- [ ] @level documented in JSDoc for each component
- [ ] Props flow downward; imports flow downward (no circular deps)

## Directory Structure

```
components/
├── quarks/           # Design tokens (CSS vars, theme files)
│   ├── colors.css
│   ├── spacing.css
│   └── typography.css
├── atoms/            # Indivisible elements
│   ├── Button/
│   ├── Input/
│   └── Icon/
├── molecules/        # Atom compositions
│   ├── FormField/
│   └── SearchBar/
├── organisms/        # Complex sections
│   ├── Header/
│   └── LoginForm/
├── templates/        # Page layouts
│   └── DashboardLayout/
└── pages/            # Real content instances
    └── Login/
```

## Beads follow-ups
```bash
bd create "Refactor: extract atom from organism <name>" --assignee ui-designer -p 3
bd create "Design token: replace hardcoded <value> in <component>" --assignee ui-designer -p 3
```

## Knowledge generation — orient first

Before applying this skill, generate context:
1. Read the relevant files (use `analyze` or `read` tools)
2. Identify the specific scope (component, feature, endpoint)
3. Only then apply the methodology in this skill
