# Design Token Architecture — W3C Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Covers the three-layer model, naming patterns, file formats, multi-theme implementation, platform targets, and common mistakes.

---

## The Three-Layer Model

Design tokens are structured in three semantic layers. Each layer has a distinct purpose and audience.

```
┌─────────────────────────────────────────────┐
│  Layer 3: Component Tokens                  │
│  button.background.primary.default          │
│  (consumed by component code)               │
├─────────────────────────────────────────────┤
│  Layer 2: Semantic / Alias Tokens           │
│  color.action.primary                       │
│  (theme contracts — swap here for theming)  │
├─────────────────────────────────────────────┤
│  Layer 1: Primitive / Reference Tokens      │
│  color.blue.600                             │
│  (raw values — never used in components)    │
└─────────────────────────────────────────────┘
```

### Layer 1 — Primitive Tokens

**Purpose:** Raw design decisions without semantic meaning. The complete palette, full type scale, all spacing steps.

**Naming convention:** `{category}.{scale-name}.{step}`

| Example token | Value |
|---------------|-------|
| `color.blue.100` | `#DBEAFE` |
| `color.blue.600` | `#2563EB` |
| `color.neutral.0` | `#FFFFFF` |
| `color.neutral.900` | `#111827` |
| `font-size.100` | `12px` |
| `font-size.400` | `16px` |
| `space.100` | `4px` |
| `space.400` | `16px` |
| `border-radius.100` | `2px` |
| `border-radius.400` | `8px` |

**Rules:**
- Never reference primitive tokens in component styles.
- Primitive token names carry no semantic meaning — `blue.600` does not imply "primary action."
- Primitives are brand-agnostic; they form the full material library.

---

### Layer 2 — Semantic / Alias Tokens

**Purpose:** Assign meaning to primitives. These are the tokens referenced by components. Swapping semantic token values enables theming.

**Naming convention:** `{category}.{role}.{variant}.{state}`

| Example token | References | Semantic meaning |
|---------------|------------|-----------------|
| `color.action.primary.default` | `color.blue.600` | Primary interactive element — rest |
| `color.action.primary.hover` | `color.blue.700` | Primary interactive element — hover |
| `color.action.primary.pressed` | `color.blue.800` | Primary interactive element — active |
| `color.action.primary.disabled` | `color.blue.200` | Primary interactive element — disabled |
| `color.feedback.error.default` | `color.red.600` | Error state |
| `color.feedback.success.default` | `color.green.600` | Success state |
| `color.surface.default` | `color.neutral.0` | Default page/card background |
| `color.surface.raised` | `color.neutral.50` | Elevated surface |
| `color.text.primary` | `color.neutral.900` | Primary body text |
| `color.text.secondary` | `color.neutral.600` | Supporting/caption text |
| `color.text.inverse` | `color.neutral.0` | Text on dark backgrounds |
| `color.border.default` | `color.neutral.200` | Default element border |
| `space.component.padding.sm` | `space.200` | Small component internal padding |
| `space.layout.gap.md` | `space.400` | Medium layout gap |
| `typography.body.size` | `font-size.400` | Body text size |

---

### Layer 3 — Component-Specific Tokens

**Purpose:** Scope semantic tokens to a specific component. Allows per-component overrides without polluting the semantic layer.

**Naming convention:** `{component}.{element}.{property}.{state}`

| Example token | References |
|---------------|------------|
| `button.background.primary.default` | `color.action.primary.default` |
| `button.background.primary.hover` | `color.action.primary.hover` |
| `button.text.primary.default` | `color.text.inverse` |
| `button.border-radius` | `border-radius.400` |
| `input.border.default` | `color.border.default` |
| `input.border.focused` | `color.action.primary.default` |
| `card.background.default` | `color.surface.raised` |
| `card.padding` | `space.component.padding.md` |

---

## Token Naming Pattern

```
{category}.{role}.{variant}.{state}
```

| Segment | Description | Examples |
|---------|-------------|---------|
| `category` | Token type domain | `color`, `space`, `typography`, `motion`, `elevation`, `border-radius` |
| `role` | Semantic role within category | `action`, `feedback`, `surface`, `text`, `border`, `layout`, `component` |
| `variant` | Sub-role or modifier | `primary`, `secondary`, `error`, `success`, `warning`, `info` |
| `state` | Interactive or conditional state | `default`, `hover`, `pressed`, `focused`, `disabled`, `selected` |

**Examples in full:**
```
color.action.primary.default
color.feedback.error.default
color.surface.overlay.default
space.layout.section.vertical
typography.heading.xl.line-height
motion.duration.standard
elevation.shadow.level-2
border-radius.component.button
```

---

## Token Formats

### JSON (W3C Design Tokens Format — Community Group Draft)

```json
{
  "color": {
    "blue": {
      "600": {
        "$value": "#2563EB",
        "$type": "color",
        "$description": "Primary blue — 600 step"
      }
    },
    "action": {
      "primary": {
        "default": {
          "$value": "{color.blue.600}",
          "$type": "color",
          "$description": "Primary action colour — rest state"
        },
        "hover": {
          "$value": "{color.blue.700}",
          "$type": "color"
        }
      }
    }
  }
}
```

**W3C Token Format spec fields:**
- `$value` — the token value or alias reference
- `$type` — `color` | `dimension` | `fontFamily` | `fontWeight` | `duration` | `cubicBezier` | `number` | `strokeStyle` | `border` | `transition` | `shadow` | `gradient` | `typography`
- `$description` — human-readable documentation
- `$extensions` — vendor-specific metadata

### CSS Custom Properties (Output)

```css
/* Primitive layer */
:root {
  --color-blue-600: #2563EB;
  --color-blue-700: #1D4ED8;
  --color-neutral-900: #111827;
}

/* Semantic layer — default theme */
:root {
  --color-action-primary-default: var(--color-blue-600);
  --color-action-primary-hover: var(--color-blue-700);
  --color-text-primary: var(--color-neutral-900);
}

/* Dark theme override — swap semantic layer only */
[data-theme="dark"] {
  --color-action-primary-default: var(--color-blue-400);
  --color-surface-default: var(--color-neutral-900);
  --color-text-primary: var(--color-neutral-50);
}
```

### Style Dictionary Configuration

```js
// style-dictionary.config.js
module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'ds',
      buildPath: 'dist/css/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        selector: ':root',
        filter: (token) => token.filePath.includes('semantic')
      }]
    },
    ios: {
      transformGroup: 'ios-swift',
      buildPath: 'dist/ios/',
      files: [{
        destination: 'StyleDictionaryColor.swift',
        format: 'ios-swift/class.swift',
        className: 'StyleDictionaryColor',
        filter: { type: 'color' }
      }]
    },
    android: {
      transformGroup: 'android',
      buildPath: 'dist/android/',
      files: [{
        destination: 'colors.xml',
        format: 'android/colors',
        filter: { type: 'color' }
      }]
    }
  }
};
```

---

## Multi-Theme Implementation

Theming works by **swapping the semantic layer** while leaving primitive and component layers unchanged.

```
Primitive:   color.blue.600 = #2563EB  (never changes)
             color.brand.600 = #7C3AED (never changes)

Semantic (default theme):
             color.action.primary = → color.blue.600

Semantic (purple brand theme):
             color.action.primary = → color.brand.600

Component:   button.background.primary = → color.action.primary
             (unchanged across both themes)
```

**Implementation — CSS:**
```css
/* Theme A — Blue */
[data-theme="blue"] {
  --color-action-primary-default: var(--color-blue-600);
}

/* Theme B — Purple */
[data-theme="purple"] {
  --color-action-primary-default: var(--color-brand-600);
}
```

**Implementation — Token file per theme:**
```
tokens/
  primitives/
    color.json        # raw palette — shared
    spacing.json      # raw spacing — shared
  semantic/
    default.json      # default brand semantic mapping
    dark.json         # dark mode semantic mapping
    high-contrast.json # accessibility semantic mapping
    brand-purple.json  # purple brand expression
  components/
    button.json       # references semantic layer only
```

---

## Platform Targets

### Web — CSS Custom Properties
```css
/* Consumed directly */
.btn-primary {
  background: var(--color-action-primary-default);
  color: var(--color-text-inverse);
  padding: var(--space-component-padding-sm) var(--space-component-padding-md);
  border-radius: var(--border-radius-component-button);
}
```

### iOS — Swift
```swift
// Generated by Style Dictionary
extension UIColor {
  static let actionPrimaryDefault = UIColor(named: "actionPrimaryDefault")!
}

// Usage
button.backgroundColor = .actionPrimaryDefault
```

### Android — XML / Compose
```xml
<!-- colors.xml -->
<color name="action_primary_default">#2563EB</color>
```

```kotlin
// Compose
val ActionPrimaryDefault = Color(0xFF2563EB)
val buttonColors = ButtonDefaults.buttonColors(
  containerColor = ActionPrimaryDefault
)
```

---

## Common Mistakes

### ❌ Mistake 1 — Using Primitive Tokens in Components

```scss
// WRONG — component is coupled to a specific primitive value
.btn-primary {
  background: var(--color-blue-600); // primitive!
}
```

```scss
// CORRECT — component references semantic layer
.btn-primary {
  background: var(--color-action-primary-default);
}
```

**Why it breaks:** When the theme changes, `color.blue.600` doesn't change — the semantic token does. The button never updates.

---

### ❌ Mistake 2 — Flat Token Structure (No Layers)

```json
// WRONG — flat structure conflates primitive and semantic meaning
{
  "primaryColor": "#2563EB",
  "buttonBackground": "#2563EB"
}
```

**Problem:** Two tokens with the same value but no explicit relationship. When the primary colour changes, `buttonBackground` must be manually hunted down. At scale (500+ tokens), this is unmanageable.

---

### ❌ Mistake 3 — Missing Semantic Layer

```
Primitives → Components (direct)
```

**Problem:** Every component theme variation requires rewriting component tokens. No way to express "dark mode" as a single semantic layer swap. Multi-brand becomes impossible without forking the entire component library.

---

### ❌ Mistake 4 — Semantic Tokens That Are Too Specific

```json
// WRONG — "blue" in the semantic name breaks abstraction
{
  "color.action.blue-primary": { "$value": "{color.blue.600}" }
}
```

**Problem:** The moment the action colour changes to purple (brand refresh), the semantic token name is wrong but renaming it is a breaking change.

```json
// CORRECT — semantic name describes role, not colour
{
  "color.action.primary.default": { "$value": "{color.blue.600}" }
}
```

---

### ❌ Mistake 5 — State Tokens Missing

```json
// WRONG — only default state defined
{
  "color.action.primary": { "$value": "#2563EB" }
}
```

**Problem:** Components hardcode `:hover` colour calculations (`darken(10%)`) rather than referencing a token. On dark backgrounds darken may be wrong direction. Accessibility contrast is untested.

```json
// CORRECT — all interaction states tokenised
{
  "color.action.primary.default": { "$value": "{color.blue.600}" },
  "color.action.primary.hover":   { "$value": "{color.blue.700}" },
  "color.action.primary.pressed": { "$value": "{color.blue.800}" },
  "color.action.primary.focused": { "$value": "{color.blue.600}" },
  "color.action.primary.disabled":{ "$value": "{color.blue.200}" }
}
```

---

*Last updated: 2026-07. Companion to `.agents/skills/design-systems-arch/SKILL.md`.*
