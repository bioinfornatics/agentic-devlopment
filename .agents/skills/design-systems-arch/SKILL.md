---
name: design-systems-arch
description: >
  Design system architecture: W3C design token specification, component library
  patterns, theming and multi-brand architecture, governance models, and
  design-to-code integration. Load when designing or auditing a design system,
  defining token architecture, planning component libraries, or evaluating
  design system maturity and governance.
metadata:
  author: phazurlabs (adapted for harness)
  upstream: https://github.com/phazurlabs/ux-ui-mastery/tree/main/skills/design-systems-architecture
  version: 1.0.0
---

# Design Systems Architecture

"A design system is not a project. It is a product serving products." — Nathan Curtis

## Core Principles

1. **Systematic over stylistic** — define rules and relationships, not just visual recipes
2. **Tokens are the foundation** — design decisions encoded as data, not hardcoded values
3. **Composition over inheritance** — build complex components from simple, composable primitives
4. **Document the why** — every decision needs rationale to prevent future erosion
5. **Adopt, then adapt** — products adopt the system by default; request exceptions with justification

## Design Token Architecture (W3C standard)

Three semantic layers:

| Layer | Examples | Purpose |
|---|---|---|
| **Primitive/Reference tokens** | `color.blue.500 = #2563eb` | Raw values; never used directly in components |
| **Semantic tokens** | `color.action.primary = {color.blue.500}` | Intent-based aliases; what components reference |
| **Component tokens** | `button.background.default = {color.action.primary}` | Component-specific overrides |

Changing a semantic token propagates to all components that reference it.
Theming and multi-brand = swap the semantic layer; primitives and components unchanged.

## Component Library Patterns

| Pattern | When to use |
|---|---|
| **Compound component** | Complex UI with shared state (Select, Accordion, Tabs) |
| **Render prop / slot** | Flexible layout with user-controlled rendering |
| **Headless component** | Behaviour without opinions; consumers provide markup |
| **Provider pattern** | Shared context (theme, locale, auth) without prop drilling |

## Design System Maturity Model

| Level | Characteristics |
|---|---|
| L0 — Fragmented | Each team builds their own; inconsistent |
| L1 — Style guide | Shared colours and typography; no components |
| L2 — Component library | Shared components; manual tokens |
| L3 — Design tokens | Token-first; design and code are in sync |
| L4 — Multi-brand | One system, multiple brand expressions |
| L5 — Self-service | Product teams extend the system; governance automated |

## Governance

- **Decision log** — record every breaking change + rationale
- **Versioning** — semver; breaking changes in major versions only
- **Contribution process** — proposal → review → merge → release
- **Deprecation policy** — minimum 2 versions notice before removal

## Evaluation checklist

- [ ] Tokens follow 3-layer architecture (primitive → semantic → component)
- [ ] No hardcoded values in components (all via tokens)
- [ ] Theming works by swapping semantic layer only
- [ ] Every component has a documented API and usage examples
- [ ] Breaking changes follow semver and deprecation policy
- [ ] Governance process is documented and followed

## When to load references
- Token architecture detail → load `references/design-token-architecture.md`
- Governance and scaling → load `references/governance-scaling.md`
- Maturity model detail → load `references/maturity-model-multi-brand.md`
- Token specification → load `references/token-specification-guide.md`

## Beads follow-ups
```bash
bd create "Design system: migrate hardcoded values to semantic tokens in <component>" --assignee ui-designer -p 3
bd create "Design system: define governance process for component contributions" --assignee architect -p 3
```
## Knowledge generation — orient first

Before applying this skill, generate context:
1. Read the relevant files (use `analyze` or `read` tools)
2. Identify the specific scope (component, feature, endpoint)
3. Only then apply the methodology in this skill
