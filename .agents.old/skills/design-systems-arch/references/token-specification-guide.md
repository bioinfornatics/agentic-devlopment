# Token Specification & Documentation Standard — Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Token spec format, taxonomy, Style Dictionary configuration, testing, and documentation templates.

---

## Token Spec Format

Every design token must have a complete specification entry before it is implemented. The spec is the source of truth; code and Figma derive from it, not the other way around.

### Token Spec Record

```yaml
# token-spec.yaml
- name: color.action.primary.default
  value: "{color.blue.600}"           # alias reference or literal value
  resolves-to: "#2563EB"              # computed value for documentation
  type: color                         # W3C token type
  category: color
  role: action
  variant: primary
  state: default
  description: >
    The primary interactive element colour at rest state.
    Used for primary buttons, links, focus rings, and active navigation items.
  usage:
    - component: Button (variant=primary)
    - component: Link (variant=primary)
    - component: NavigationItem (state=active)
  do: Use for the single most important action on a screen.
  do-not: Do not use for decorative elements or informational content.
  deprecated: false
  deprecated-since: null
  replaced-by: null
  added-in: "2.0.0"
  figma-variable: "Action/Primary/Default"
  wcag-contrast:
    on-white: "5.74:1"    # AA passes (≥4.5:1)
    on-neutral-900: "N/A" # not used on dark backgrounds
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full dot-notation token name |
| `value` | string | Alias `{other.token}` or literal value |
| `resolves-to` | string | Computed/resolved value |
| `type` | enum | W3C type (see taxonomy below) |
| `description` | string | Human-readable purpose |
| `usage` | array | Components / contexts where this token is used |
| `added-in` | semver | Version when token was introduced |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `do` / `do-not` | string | Usage guidelines |
| `deprecated` | boolean | Whether token is deprecated |
| `deprecated-since` | semver | Version of deprecation |
| `replaced-by` | string | Replacement token name |
| `wcag-contrast` | object | Contrast ratio on common backgrounds |
| `figma-variable` | string | Figma variable path for sync verification |

---

## Token Taxonomy

### Colour

**Category prefix:** `color`

| Sub-category | Role segment | State segment | Examples |
|-------------|-------------|--------------|---------|
| Action | `action.primary` `action.secondary` `action.danger` | `default` `hover` `pressed` `focused` `disabled` | `color.action.primary.default` |
| Feedback | `feedback.error` `feedback.success` `feedback.warning` `feedback.info` | `default` `subtle` `on-color` | `color.feedback.error.default` |
| Surface | `surface.default` `surface.raised` `surface.overlay` `surface.accent` | — (surfaces don't have interaction states) | `color.surface.raised` |
| Text | `text.primary` `text.secondary` `text.disabled` `text.inverse` `text.link` | — | `color.text.secondary` |
| Border | `border.default` `border.strong` `border.focus` `border.error` `border.disabled` | — | `color.border.focus` |
| Interaction | `interaction.hover` `interaction.pressed` `interaction.selected` | — | `color.interaction.hover` |

**Value format:** Hex `#RRGGBB` or `#RRGGBBAA`, or alias `{color.blue.600}`.  
**Required WCAG checks:** All `text.*` and `action.*` tokens must document contrast ratio against their expected background.

---

### Spacing

**Category prefix:** `space`

| Sub-category | Description | Scale |
|-------------|-------------|-------|
| `space.layout.*` | Gaps between layout regions | `xs` `sm` `md` `lg` `xl` `2xl` |
| `space.component.*` | Internal component padding/gap | `padding.xs` `padding.sm` `padding.md` `padding.lg` `gap.sm` `gap.md` |
| `space.inline.*` | Inline/horizontal spacing | `xs` `sm` `md` `lg` |

**Value format:** `px` or `rem` dimension.  
**Scale baseline:** Multiples of 4px base unit.

```
space.100 = 4px
space.200 = 8px
space.300 = 12px
space.400 = 16px
space.500 = 20px
space.600 = 24px
space.800 = 32px
space.1000 = 40px
space.1200 = 48px
space.1600 = 64px
```

---

### Typography

**Category prefix:** `typography`

| Sub-category | Tokens |
|-------------|--------|
| `typography.font-family.*` | `sans` `serif` `mono` |
| `typography.font-size.*` | `xs` `sm` `md` `lg` `xl` `2xl` `3xl` `4xl` `5xl` |
| `typography.font-weight.*` | `regular` (400) `medium` (500) `semibold` (600) `bold` (700) |
| `typography.line-height.*` | `tight` (1.2) `normal` (1.5) `relaxed` (1.75) |
| `typography.letter-spacing.*` | `tight` (-0.02em) `normal` (0) `wide` (0.05em) `wider` (0.1em) |

**Composite typography tokens** (W3C `typography` type — bundles related props):
```json
{
  "typography": {
    "heading": {
      "xl": {
        "$value": {
          "fontFamily": "{typography.font-family.sans}",
          "fontSize": "{typography.font-size.4xl}",
          "fontWeight": "{typography.font-weight.bold}",
          "lineHeight": "{typography.line-height.tight}",
          "letterSpacing": "{typography.letter-spacing.tight}"
        },
        "$type": "typography"
      }
    }
  }
}
```

---

### Motion

**Category prefix:** `motion`

| Sub-category | Description | Values |
|-------------|-------------|--------|
| `motion.duration.*` | Timing for animations | `instant` (0ms) `fast` (100ms) `standard` (200ms) `slow` (400ms) `deliberate` (600ms) |
| `motion.easing.*` | Easing curves (cubic-bezier) | `linear` `ease-in` `ease-out` `ease-in-out` `spring` |
| `motion.transition.*` | Composite transition specs | `fade` `slide` `scale` |

**WCAG note:** All transitions must respect `prefers-reduced-motion`. Token values should default to reduced values when the media query is active; implement this at the CSS variable level:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-standard: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

---

### Elevation

**Category prefix:** `elevation`

| Sub-category | Description | Values |
|-------------|-------------|--------|
| `elevation.shadow.*` | Box shadow values | `level-0` through `level-5` |
| `elevation.z-index.*` | Z-index layers | `base` (0) `raised` (10) `dropdown` (100) `sticky` (200) `overlay` (300) `modal` (400) `toast` (500) `tooltip` (600) |

```json
{
  "elevation": {
    "shadow": {
      "level-2": {
        "$value": "0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "$type": "shadow",
        "$description": "Card elevation — raised surface"
      }
    },
    "z-index": {
      "modal": {
        "$value": 400,
        "$type": "number"
      }
    }
  }
}
```

---

### Border Radius

**Category prefix:** `border-radius`

| Token | Value | Use |
|-------|-------|-----|
| `border-radius.none` | `0` | Data tables, code blocks |
| `border-radius.sm` | `2px` | Badges, tags |
| `border-radius.md` | `4px` | Inputs, select |
| `border-radius.lg` | `8px` | Cards, dialogs |
| `border-radius.xl` | `12px` | Large cards, sheets |
| `border-radius.full` | `9999px` | Pills, avatars, toggles |
| `border-radius.component.button` | `{border-radius.md}` | Buttonspecific (overridable per brand) |

---

## Style Dictionary Configuration

### Full Production Config

```js
// style-dictionary.config.js
const StyleDictionary = require('style-dictionary');

// Custom transform: px to rem for web
StyleDictionary.registerTransform({
  name: 'size/pxToRem',
  type: 'value',
  matcher: (token) => token.type === 'dimension',
  transformer: (token) => {
    const val = parseFloat(token.value);
    return isNaN(val) ? token.value : `${val / 16}rem`;
  }
});

// Custom format: typed CSS custom properties with fallbacks
StyleDictionary.registerFormat({
  name: 'css/typed-custom-properties',
  formatter: ({ dictionary, options }) => {
    const selector = options.selector || ':root';
    const props = dictionary.allTokens
      .map(token => `  --${token.name}: ${token.value};`)
      .join('\n');
    return `${selector} {\n${props}\n}`;
  }
});

module.exports = {
  source: [
    'tokens/primitives/**/*.json',
    'tokens/semantic/**/*.json',
    'tokens/components/**/*.json'
  ],
  platforms: {
    // Web — CSS custom properties
    'css/default': {
      transformGroup: 'css',
      prefix: 'ds',
      buildPath: 'dist/web/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/typed-custom-properties',
          selector: ':root',
          filter: (token) => !token.filePath.includes('primitives')
        },
        {
          destination: 'primitives.css',
          format: 'css/typed-custom-properties',
          selector: ':root',
          filter: (token) => token.filePath.includes('primitives')
        }
      ]
    },

    // JS/TS — ESM export for CSS-in-JS
    'js/esm': {
      transformGroup: 'js',
      prefix: 'ds',
      buildPath: 'dist/js/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6'
        },
        {
          destination: 'tokens.d.ts',
          format: 'typescript/es6-declarations'
        }
      ]
    },

    // iOS — Swift
    'ios/swift': {
      transformGroup: 'ios-swift',
      buildPath: 'dist/ios/',
      files: [
        {
          destination: 'DesignTokens.swift',
          format: 'ios-swift/class.swift',
          className: 'DesignTokens',
          filter: (token) => ['color', 'dimension'].includes(token.type)
        }
      ]
    },

    // Android — XML resources
    'android/xml': {
      transformGroup: 'android',
      buildPath: 'dist/android/',
      files: [
        {
          destination: 'colors.xml',
          format: 'android/colors',
          filter: (token) => token.type === 'color'
        },
        {
          destination: 'dimens.xml',
          format: 'android/dimens',
          filter: (token) => token.type === 'dimension'
        }
      ]
    }
  }
};
```

### Transform Groups

| Transform group | Transforms included |
|----------------|-------------------|
| `css` | `attribute/cti`, `name/cti/kebab`, `time/seconds`, `color/css`, `asset/url` |
| `js` | `attribute/cti`, `name/cti/camel`, `color/hex`, `size/rem` |
| `ios-swift` | `attribute/cti`, `name/cti/camel`, `color/UIColorSwift`, `content/swift/literal` |
| `android` | `attribute/cti`, `name/cti/snake`, `color/hex8android`, `size/remToSp`, `size/remToDp` |

---

## Token Testing

### Visual Regression for Token Changes

**Tooling:** Chromatic (cloud) or reg-suit (self-hosted) with Storybook.

```bash
# Run Chromatic on every PR that touches token files
npx chromatic --project-token=$CHROMATIC_TOKEN --auto-accept-changes=main
```

**Strategy:**
- Storybook contains a "Token Showcase" story that renders every semantic token in context.
- Any change to `tokens/semantic/**` triggers a full visual regression baseline comparison.
- Reviewers approve or reject visual diffs before merge.

### Computed Value Assertions

```ts
// tokens.test.ts — verify resolved token values
import tokens from '../dist/js/tokens';
import { describe, it, expect } from 'vitest';

describe('Semantic token resolution', () => {
  it('action.primary.default resolves to blue-600', () => {
    expect(tokens.colorActionPrimaryDefault).toBe('#2563EB');
  });

  it('surface.default is white in light theme', () => {
    expect(tokens.colorSurfaceDefault).toBe('#FFFFFF');
  });

  it('all tokens have non-empty values', () => {
    Object.entries(tokens).forEach(([name, value]) => {
      expect(value, `Token ${name} is empty`).toBeTruthy();
    });
  });
});
```

### Contrast Ratio Checks

```ts
// contrast.test.ts — WCAG 2.1 automated checks
import { getContrastRatio } from '@a11y/color-contrast';
import tokens from '../dist/js/tokens';
import { describe, it, expect } from 'vitest';

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;

describe('WCAG contrast — text on surfaces', () => {
  it('text.primary on surface.default meets AA', () => {
    const ratio = getContrastRatio(
      tokens.colorTextPrimary,
      tokens.colorSurfaceDefault
    );
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('text.secondary on surface.default meets AA', () => {
    const ratio = getContrastRatio(
      tokens.colorTextSecondary,
      tokens.colorSurfaceDefault
    );
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('action.primary.default on surface.default meets AA (large text)', () => {
    const ratio = getContrastRatio(
      tokens.colorActionPrimaryDefault,
      tokens.colorSurfaceDefault
    );
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
});
```

---

## Documentation Template

One H3 per token category. Use in generated documentation and Storybook.

---

### Colour Tokens

| Token | Value | Role | Contrast on White |
|-------|-------|------|------------------|
| `color.action.primary.default` | `#2563EB` | Primary CTA, links | 5.74:1 ✅ AA |
| `color.action.primary.hover` | `#1D4ED8` | Primary hover | 7.12:1 ✅ AA |
| `color.action.primary.disabled` | `#BFDBFE` | Disabled state | 1.98:1 ❌ (not text) |
| `color.feedback.error.default` | `#DC2626` | Error indicators | 5.25:1 ✅ AA |
| `color.surface.default` | `#FFFFFF` | Page background | — |
| `color.surface.raised` | `#F9FAFB` | Card background | — |
| `color.text.primary` | `#111827` | Body text | 16.75:1 ✅ AAA |
| `color.text.secondary` | `#6B7280` | Caption text | 4.62:1 ✅ AA |

**Usage example:**
```css
.card {
  background: var(--ds-color-surface-raised);
  color: var(--ds-color-text-primary);
  border: 1px solid var(--ds-color-border-default);
}

.btn-primary {
  background: var(--ds-color-action-primary-default);
  color: var(--ds-color-text-inverse);
}
.btn-primary:hover {
  background: var(--ds-color-action-primary-hover);
}
```

---

### Spacing Tokens

| Token | Value | Use |
|-------|-------|-----|
| `space.100` | `4px` | Icon padding, tight inline gaps |
| `space.200` | `8px` | Component internal gap (compact) |
| `space.300` | `12px` | Component internal gap (default) |
| `space.400` | `16px` | Component internal padding (default) |
| `space.600` | `24px` | Section internal padding |
| `space.800` | `32px` | Layout column gap |
| `space.1200` | `48px` | Section vertical margin |
| `space.1600` | `64px` | Hero section vertical padding |

**Usage example:**
```css
.form-field {
  padding: var(--ds-space-300) var(--ds-space-400);
  gap: var(--ds-space-200);
}

.layout-section {
  margin-bottom: var(--ds-space-1200);
  padding: 0 var(--ds-space-800);
}
```

---

### Typography Tokens

| Token | Value | Use |
|-------|-------|-----|
| `typography.font-size.xs` | `0.75rem` / `12px` | Labels, captions |
| `typography.font-size.sm` | `0.875rem` / `14px` | Secondary body, metadata |
| `typography.font-size.md` | `1rem` / `16px` | Primary body text |
| `typography.font-size.lg` | `1.125rem` / `18px` | Lead paragraph |
| `typography.font-size.xl` | `1.25rem` / `20px` | Section heading |
| `typography.font-size.2xl` | `1.5rem` / `24px` | Sub-page heading |
| `typography.font-size.3xl` | `1.875rem` / `30px` | Page heading |
| `typography.font-size.4xl` | `2.25rem` / `36px` | Display heading |
| `typography.line-height.tight` | `1.2` | Headings |
| `typography.line-height.normal` | `1.5` | Body text |
| `typography.font-weight.regular` | `400` | Body |
| `typography.font-weight.semibold` | `600` | Labels, UI text |
| `typography.font-weight.bold` | `700` | Headings |

**Usage example:**
```css
.heading-xl {
  font-family: var(--ds-typography-font-family-sans);
  font-size: var(--ds-typography-font-size-3xl);
  font-weight: var(--ds-typography-font-weight-bold);
  line-height: var(--ds-typography-line-height-tight);
  letter-spacing: var(--ds-typography-letter-spacing-tight);
}

.body {
  font-family: var(--ds-typography-font-family-sans);
  font-size: var(--ds-typography-font-size-md);
  font-weight: var(--ds-typography-font-weight-regular);
  line-height: var(--ds-typography-line-height-normal);
}
```

---

### Motion Tokens

| Token | Value | Use |
|-------|-------|-----|
| `motion.duration.instant` | `0ms` | Immediate feedback (hover border) |
| `motion.duration.fast` | `100ms` | Micro-interactions (button press) |
| `motion.duration.standard` | `200ms` | Most transitions (open/close) |
| `motion.duration.slow` | `400ms` | Page transitions, large expansions |
| `motion.easing.ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter transitions |
| `motion.easing.ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit transitions |
| `motion.easing.ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes |

**Usage example:**
```css
.modal {
  transition:
    opacity var(--ds-motion-duration-standard) var(--ds-motion-easing-ease-out),
    transform var(--ds-motion-duration-standard) var(--ds-motion-easing-ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    transition: none;
  }
}
```

---

### Elevation Tokens

| Token | Value | Use |
|-------|-------|-----|
| `elevation.shadow.level-0` | `none` | Flat surfaces |
| `elevation.shadow.level-1` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (input focus) |
| `elevation.shadow.level-2` | `0 2px 4px rgba(0,0,0,0.08)` | Cards |
| `elevation.shadow.level-3` | `0 4px 8px rgba(0,0,0,0.12)` | Dropdowns, tooltips |
| `elevation.shadow.level-4` | `0 8px 16px rgba(0,0,0,0.16)` | Modals |
| `elevation.shadow.level-5` | `0 16px 32px rgba(0,0,0,0.20)` | Full-screen overlays |
| `elevation.z-index.dropdown` | `100` | Dropdown menus |
| `elevation.z-index.sticky` | `200` | Sticky headers |
| `elevation.z-index.modal` | `400` | Modals and dialogs |
| `elevation.z-index.toast` | `500` | Toast notifications |
| `elevation.z-index.tooltip` | `600` | Tooltips |

**Usage example:**
```css
.card {
  box-shadow: var(--ds-elevation-shadow-level-2);
}

.dropdown-menu {
  box-shadow: var(--ds-elevation-shadow-level-3);
  z-index: var(--ds-elevation-z-index-dropdown);
}
```

---

### Border Radius Tokens

| Token | Value | Use |
|-------|-------|-----|
| `border-radius.none` | `0` | Tables, code blocks, images |
| `border-radius.sm` | `2px` | Badges, tags, chips |
| `border-radius.md` | `4px` | Inputs, selects, default components |
| `border-radius.lg` | `8px` | Cards, dialogs, panels |
| `border-radius.xl` | `12px` | Large cards, sheets |
| `border-radius.full` | `9999px` | Pills, avatars, toggle switches |

**Usage example:**
```css
.card {
  border-radius: var(--ds-border-radius-lg);
}

.badge {
  border-radius: var(--ds-border-radius-full);
}

.input {
  border-radius: var(--ds-border-radius-md);
}
```

---

*Last updated: 2026-07. Companion to `.agents/skills/design-systems-arch/SKILL.md`.*
