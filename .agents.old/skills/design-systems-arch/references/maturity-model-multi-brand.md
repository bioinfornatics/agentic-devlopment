# Maturity Model & Multi-Brand Architecture — Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Full L0–L5 maturity model with observable evidence, advancement criteria, multi-brand token architecture, and real-world case studies.

---

## L0–L5 Design System Maturity Model

The maturity model describes the evolutionary stages of a design system, from no system at all to a fully federated, multi-brand, multi-platform platform.

---

### L0 — No System

**Description:** No shared design language. Each product, feature, or engineer makes independent visual decisions. Components are copy-pasted or re-implemented per feature.

**Observable evidence:**
- No shared component library in version control.
- Button implementations vary across pages (different colours, font sizes, padding).
- Design files are per-feature Figma documents with no shared styles or components.
- "Pixel-perfect" handoff is the primary designer-developer workflow.
- Brand consistency maintained only by individual discipline, not tooling.

**Pain indicators:** Brand audit reveals 5+ button variants in production. Accessibility issues repeat across teams. Every new feature reinvents the same UI patterns.

---

### L1 — Informal Patterns

**Description:** Some shared UI patterns exist but are not formalised. Engineers copy and modify from a "reference" implementation. Designers maintain a rough style guide in Figma. No versioning or governance.

**Observable evidence:**
- A Figma document named "Design Styles" or "Component Library" exists but is not used consistently.
- A shared CSS file or utility classes are used by most but not all teams.
- Some components are in a shared repo folder but not published as a package.
- There is no release process — changes are committed directly and teams notice via diff.
- No token vocabulary; colours are hex codes in CSS, not named variables.

**Pain indicators:** "What's the right blue?" is a recurring question. Figma and code are out of sync. Teams diverge from the "standard" within weeks of feature work.

---

### L2 — Documented Component Library

**Description:** A versioned component library exists and is consumed by product teams. Components are documented. A token system exists at the primitive level. Governance is informal but present.

**Observable evidence:**
- npm package `@org/design-system` is published and used by ≥2 product teams.
- Storybook or equivalent documents all shipped components with usage examples.
- A colour palette and type scale are tokenised as CSS custom properties.
- There is a person (or team) responsible for the design system.
- Breaking changes are communicated via Slack, even if not documented in a change log.
- Figma library is published and consuming teams use detach sparingly.

**Pain indicators:** Dark mode is impossible without touching every component. Theming requires a full library fork. Accessibility retrofitting is needed after shipping.

---

### L3 — Semantic Token Layer + Theming

**Description:** The three-layer token model is implemented. Semantic tokens decouple component styling from primitive values. Dark mode and basic theming are supported without component changes. Governance process is defined.

**Observable evidence:**
- Tokens are organised in primitive / semantic / component layers in source.
- Dark mode is implemented by swapping the semantic layer (CSS `[data-theme="dark"]` or equivalent).
- A Style Dictionary (or equivalent) pipeline generates outputs for web, iOS, Android.
- RFC / contribution process is documented and followed for additions.
- Deprecation policy exists with defined notice periods.
- Accessibility is built in at component specification time (WCAG 2.1 AA target).
- Decision log exists with at least the last 5 significant decisions recorded.

**Pain indicators:** Multi-brand support requires per-brand forks. Component API consistency degrades as the library grows. No automated token testing.

---

### L4 — Multi-Brand + Federated Contributions

**Description:** The semantic token layer supports multiple brand expressions simultaneously. A federated contribution model allows domain teams to extend the system without forking. Platform-level tooling (codemods, automated migration) exists.

**Observable evidence:**
- ≥2 distinct brand themes operate on the same component codebase (e.g., `brand-a` and `brand-b` semantic layers).
- Domain teams publish extensions (`@org/ds-ecommerce`) that consume `@org/design-system` without forking it.
- Automated codemods ship with every breaking change.
- CI enforces no-fork policy (import analysis linting).
- Token visual regression tests run on every PR (Chromatic or equivalent).
- Changelog is auto-generated from conventional commits / Changesets.
- Contribution time from proposal to merge is < 4 weeks for standard additions.

**Pain indicators:** Cross-platform consistency requires manual synchronisation. No automated contrast ratio validation. Documentation coverage < 100%.

---

### L5 — Platform + Ecosystem

**Description:** The design system is a platform with a governed extension ecosystem. Platform outputs include design tooling, AI-assisted component generation, and cross-platform (web/iOS/Android/TV) consistency. Contribution pipeline is fully automated. System health is measured with dashboards.

**Observable evidence:**
- Cross-platform token pipeline generates verified, tested outputs for ≥3 platforms from a single source.
- AI-assisted or automated component scaffolding from token spec.
- Real-time adoption dashboard: % of product UI using DS components, token coverage %, accessibility score trend.
- Public or org-wide contribution from non-DS-team engineers is routine (≥20% of contributions from outside core team).
- Design system has its own roadmap, OKRs, and quarterly review with stakeholders.
- WCAG 2.2 AA is enforced at CI level — accessibility regressions block merge.
- Design and code are kept in sync via automated spec generation (Figma → tokens → code).

---

## Advancement Criteria

### L0 → L1
**Must be true:**
- ≥1 person has responsibility for design consistency (even part-time).
- A Figma component library is created and all designers are invited.
- A shared colour palette is documented (even as a PDF or Notion page).

**Effort estimate:** 1–2 weeks for a single designer/engineer pair.

---

### L1 → L2
**Must be true:**
- A versioned npm package is published and used by ≥2 product teams.
- Storybook documents ≥10 core components with usage notes.
- Primitive colour and spacing tokens exist as named CSS custom properties.
- A named owner (person or team) is accountable for the system.
- A mechanism for consuming teams to report issues exists (GitHub Issues or equivalent).

**Effort estimate:** 4–8 weeks for a 2-person DS team, depending on existing component inventory.

---

### L2 → L3
**Must be true:**
- Three-layer token model is implemented (primitive, semantic, component).
- Dark mode is supported via semantic layer swap (no component-level changes needed).
- RFC and contribution process is documented and followed for the last 3 additions.
- Deprecation policy is documented with notice period and migration guide format.
- Style Dictionary (or equivalent) generates tokens for ≥2 platforms.
- WCAG 2.1 AA is documented as the accessibility standard and new components meet it at ship.

**Effort estimate:** 6–10 weeks for a 2–3 person DS team for the token migration alone.

---

### L3 → L4
**Must be true:**
- ≥2 distinct brand themes operate on shared components without forking.
- At least one domain team publishes a verified DS extension package.
- Automated codemods are available for the last 2 breaking changes.
- Token visual regression tests run in CI on every PR.
- Contribution cycle time (proposal → merge) is documented and averages < 4 weeks.

**Effort estimate:** 3–6 months for a 3–4 person DS team, heavily front-loaded on token architecture migration.

---

### L4 → L5
**Must be true:**
- Cross-platform token pipeline is live for web + ≥2 native platforms.
- Adoption dashboard is live with weekly reporting to stakeholders.
- Accessibility enforcement is automated at CI level (not just advisory).
- ≥20% of merged contributions originate from outside the core DS team.
- System has formal OKRs reviewed quarterly.

**Effort estimate:** 6–18 months. Requires DS team of ≥4 full-time with dedicated tooling engineer.

---

## Multi-Brand Architecture

### Principle

Multiple brand expressions share one primitive foundation and one component codebase. Each brand has its own **semantic layer** that maps primitives to brand-appropriate roles.

```
Primitives (shared)
  color.blue.600 = #2563EB
  color.purple.600 = #7C3AED
  color.neutral.900 = #111827

Semantic — Brand A (Blue brand)
  color.action.primary.default → color.blue.600
  color.text.primary → color.neutral.900

Semantic — Brand B (Purple brand)
  color.action.primary.default → color.purple.600
  color.text.primary → color.neutral.900

Components (shared, consume semantic)
  Button.background → color.action.primary.default
  (no change per brand — the semantic token does the work)
```

### Brand Token Organisation

**Pattern:** `brand.{brand-name}.{semantic-token}`

```json
// tokens/semantic/brand-purple.json
{
  "brand": {
    "purple": {
      "color": {
        "action": {
          "primary": {
            "default": {
              "$value": "{color.purple.600}",
              "$type": "color"
            },
            "hover": {
              "$value": "{color.purple.700}",
              "$type": "color"
            }
          }
        },
        "surface": {
          "accent": {
            "$value": "{color.purple.50}",
            "$type": "color"
          }
        }
      },
      "border-radius": {
        "component": {
          "button": {
            "$value": "24px",
            "$type": "dimension",
            "$description": "Purple brand uses pill-shaped buttons"
          }
        }
      }
    }
  }
}
```

**CSS output:**
```css
/* Applied via data-brand attribute */
[data-brand="purple"] {
  --color-action-primary-default: var(--color-purple-600);
  --color-action-primary-hover: var(--color-purple-700);
  --border-radius-component-button: 24px;
}
```

### What Each Brand Can Override

| Layer | Brand can override? | Notes |
|-------|-------------------|-------|
| Primitives | ❌ No | Primitives are shared; extend via addition only |
| Semantic tokens | ✅ Yes — this is the brand layer | Values point to different primitives |
| Component tokens | ✅ With governance | Requires RFC if change affects all brands |
| Component structure | ❌ No | Component structure is platform-owned |
| Motion/animation | ✅ Yes | Some brands use slower, more premium easing |
| Typography | ✅ Partially | Font family can vary; type scale is shared |

---

## Case Studies — Maturity Levels

### L2 — Radix UI (Radix Primitives)

**System:** Radix UI, WorkOS, ~2021 onwards.  
**Maturity evidence:** Radix Primitives is a headless, unstyled component library with a versioned npm package, Storybook-equivalent documentation, and a clear owner (WorkOS design team). No semantic token layer — styling delegated to consumers.  
**Why L2:** Components are documented and versioned. No semantic token layer that enables theming without consumer changes. Theming requires CSS-in-JS wrapper configuration per consumer.  
**L3 path:** Radix Themes (2023) adds a token layer — beginning the L2→L3 transition.

---

### L3 — GitHub Primer

**System:** GitHub Primer Design System.  
**Maturity evidence:** Three-layer token model implemented; semantic tokens documented publicly (`primer/primitives`). Dark mode and high-contrast mode via semantic layer swap. RFC process for contributions. WCAG 2.1 AA target.  
**Why L3:** Dark mode is fully supported via semantic layer. Multi-brand is limited to GitHub.com only — no external brand expression. Contribution cycle time is moderate.  
**Reference:** [primer.style](https://primer.style)

---

### L3–L4 — Google Material Design (Material 3)

**System:** Material Design 3, Google, 2021 onwards.  
**Maturity evidence:** Dynamic colour system based on Material You — users can set their own accent colour and the semantic layer adapts. Cross-platform token pipeline (web, Android, Flutter, iOS). Contribution process documented.  
**Why L3–L4:** Multi-brand via dynamic colour = semantic layer swap at runtime. Cross-platform pipeline exists. However, contribution from outside Google is advisory only — no external RFC process.  
**Reference:** [m3.material.io](https://m3.material.io)

---

### L4 — Shopify Polaris

**System:** Shopify Polaris.  
**Maturity evidence:** Three-layer token model, dark mode, 30+ semantic token categories. Domain extensions for Shopify's merchant-facing, partner, and internal admin surfaces. Public contribution process (GitHub RFC). Automated token documentation generation. Cross-platform tokens (web + React Native).  
**Why L4:** Multiple brand expressions (merchant admin vs partner dashboard) on shared component base. External contributions accepted and regularly merged. Token visual regression CI pipeline.  
**Reference:** [polaris.shopify.com](https://polaris.shopify.com)

---

### L4–L5 — IBM Carbon Design System

**System:** IBM Carbon, 2016 onwards.  
**Maturity evidence:** Full three-layer token model with theme support (White, Gray 10, Gray 90, Gray 100). Cross-platform outputs (web, React, Angular, Vue, Svelte, React Native). Federated model with Carbon-for-IBM-Products extension packages. Public roadmap and OKRs. Contribution from external IBM product teams is routine.  
**Why L4–L5:** Adoption dashboard exists internally. Multi-brand via Carbon brand themes + IBM product-level extensions. Accessibility CI enforcement. Large contributor community beyond core team.  
**Reference:** [carbondesignsystem.com](https://carbondesignsystem.com)

---

*Last updated: 2026-07. Companion to `.agents/skills/design-systems-arch/SKILL.md`.*
