# Design System Governance & Scaling — Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Decision log format, contribution process, deprecation policy, versioning, scaling patterns, and governance anti-patterns.

---

## Decision Log Format

Every breaking change to the design system must be recorded in the decision log before it is merged. The log is the institutional memory of the system.

### Decision Entry Template

```markdown
## DSL-{NNN} — {Short title}

**Date:** YYYY-MM-DD  
**Status:** Proposed | Under Review | Accepted | Rejected | Superseded by DSL-{NNN}  
**Type:** Breaking | Non-breaking | Deprecation | Addition  
**Affected:** [List tokens, components, or APIs changed]  
**Author:** @{github-handle}  
**Reviewers:** @{handle}, @{handle}

### Context
[Why is this change being considered? What problem does it solve?
What constraints exist? What alternatives were evaluated?]

### Decision
[What was decided? State the outcome clearly.]

### Rationale
[Why was this option chosen over alternatives?
Include tradeoff analysis.]

### Migration path
[How do consumers update to the new API?
Link to codemod if one exists.]

### Rollback plan
[If this change causes unexpected harm, how is it reversed?]

### References
- [RFC link]
- [Figma comparison]
- [Accessibility audit]
```

**Storage:** `/design-system/decisions/DSL-{NNN}-{slug}.md` in monorepo.  
**Index:** `/design-system/decisions/README.md` — table of all decisions, auto-generated.

---

## Contribution Process

The contribution pipeline balances openness (anyone can improve the system) with quality (every change is reviewed against system standards).

### Stage 1 — Proposal

**Who:** Any team member.  
**How:** Open a GitHub Discussion in the design system repository using the Proposal template.  
**Contains:**
- Problem statement (what user/developer need is unmet)
- Proposed solution (what would change)
- Scope estimate (new component, token change, variant addition)
- Examples of the need across 2+ consuming teams (generalisation test)

**Exit criteria:** Proposal receives a response from the design system team within 5 business days.

---

### Stage 2 — RFC (Request for Comments)

**Who:** Design system team + proposal author.  
**How:** Convert approved Proposal to RFC pull request with full specification.  
**Contains:**
- Full component/token specification
- API design (props, slot names, token names)
- Accessibility requirements (WCAG criteria targeted)
- Usage guidelines draft
- Open questions section

**Review period:** 10 business days. All consuming teams are notified via Slack/email.  
**Feedback:** Comments on PR; major concerns escalate to synchronous RFC review meeting.

---

### Stage 3 — Review

**Who:** Design system maintainers (≥2 approvals required).  
**Checklist:**
```
□ Naming follows token/component naming conventions
□ API is consistent with existing system patterns
□ Accessibility requirements documented and testable
□ No duplication of existing components (uniqueness check)
□ Token additions use all three layers correctly
□ Visual spec in Figma matches code implementation
□ Breaking changes have migration guide
□ Changelog entry drafted
```

---

### Stage 4 — Approval & Implementation

**Who:** Design system team implements (or reviews community-contributed implementation).  
**Requirements:**
- Unit tests for all component states
- Storybook stories for all documented variants
- Token visual regression tests updated
- Accessibility automated test pass (axe-core)
- Manual keyboard navigation test
- Screen reader test (NVDA + Chrome, VoiceOver + Safari)

---

### Stage 5 — Release

**When:** Releases follow semantic versioning on a **bi-weekly cadence** (fixed-schedule) or on-demand for critical accessibility/security fixes.  
**Channels:**
- npm publish `@org/design-system@{version}`
- Figma library publish with version annotation
- Slack announcement in #design-system with changelog summary
- Email digest to all consuming team tech leads

---

## Deprecation Policy

### Notice Period

| Change severity | Notice period | Example |
|----------------|--------------|---------|
| Additive (no removal) | None | New component added |
| Non-breaking change | 1 sprint | Token value change with same name |
| Soft deprecation | 2 minor versions | Component marked `@deprecated` |
| Hard removal | 1 major version after soft | Component removed from exports |

**Minimum soft-deprecation period:** 3 months (or until consuming teams confirm migration).

### Deprecation Markers

**In code:**
```tsx
/**
 * @deprecated Use <Button variant="secondary" /> instead.
 * Will be removed in v5.0.0.
 * Migration guide: https://ds.org/migration/v5
 */
export const OutlineButton: React.FC<OutlineButtonProps> = (props) => {
  // implementation
};
```

**In Figma:**
- Deprecated components moved to "Deprecated" section in library.
- Red `[DEPRECATED]` prefix in component name.
- Description field links to replacement.

**In Storybook:**
```ts
export default {
  title: 'Deprecated/OutlineButton',
  component: OutlineButton,
  parameters: {
    docs: {
      description: {
        component: '⚠️ **Deprecated.** Use `Button variant="secondary"`. Removal in v5.0.0.'
      }
    }
  }
} satisfies Meta<typeof OutlineButton>;
```

### Migration Guide Requirements

Every deprecation must ship with a migration guide that includes:
1. **Why:** Reason for deprecation.
2. **What replaces it:** Exact replacement API with before/after code samples.
3. **Codemod:** Automated migration script where feasible.
4. **Timeline:** Exact version for removal.
5. **Support:** Who to contact with questions.

### Codemods

```bash
# Example: automated migration from OutlineButton to Button
npx @org/ds-codemods --transform button-outline-to-secondary ./src

# Dry run first
npx @org/ds-codemods --transform button-outline-to-secondary ./src --dry-run
```

Codemod tooling: **jscodeshift** for JS/TSX transforms, **postcss** for CSS token renames.

### Sunset Timeline

```
v4.2.0 — OutlineButton marked @deprecated, replacement documented
v4.3.0 — Build warning emitted when OutlineButton is imported
v4.4.0 — Console warning at runtime
v5.0.0 — OutlineButton removed from exports (breaking)
```

---

## Versioning

### Semantic Versioning Applied to Design Systems

```
{MAJOR}.{MINOR}.{PATCH}
   │       │      └── Bug fixes, documentation, accessibility fixes (no API change)
   │       └───────── New components, new tokens, new variants (backwards compatible)
   └───────────────── Breaking changes (removed APIs, renamed tokens, changed semantics)
```

### What Constitutes a Breaking Change

| Category | Breaking | Non-breaking |
|----------|----------|-------------|
| Token rename | ✅ (old name removed) | ❌ (alias kept) |
| Token value change (colour shift) | ✅ (visual regression) | ❌ (if within tolerance) |
| Token removal | ✅ always | — |
| Component prop rename | ✅ (old prop removed) | ❌ (old prop aliased) |
| Component prop type narrowed | ✅ | — |
| Component prop added (required) | ✅ | — |
| Component prop added (optional) | ❌ | ✅ |
| Component removed | ✅ | — |
| CSS class name change | ✅ | — |
| Default prop value change | ✅ (behaviour change) | — |
| Internal implementation refactor | ❌ | ✅ |
| Storybook story added | ❌ | ✅ |

### Token Versioning Edge Cases

- **Colour value drift within tolerance:** Change of < 5% luminance, no hue shift → patch. > 5% luminance or any hue shift → minor with migration note.
- **Spacing value change:** Any change to a spacing token value that affects existing layouts → **major** (layout-breaking).
- **Alias retargeting:** Semantic token pointing to a different primitive → **minor** if visual change is intentional and announced.

---

## Scaling Patterns

### Federated Model (Platform Team + Domain Teams)

```
Platform Team (Core DS)
├── Primitive tokens
├── Semantic tokens
├── Core components (Button, Input, Modal, Typography)
└── Design system tooling, Storybook, CI/CD

Domain Team A (e-commerce)
├── Domain tokens (category-specific semantic overrides)
├── Domain components (ProductCard, CartSummary)
└── Consumes core DS; extends, does not fork

Domain Team B (marketing)
├── Domain tokens (campaign-specific brand expressions)
├── Domain components (HeroBanner, TestimonialCard)
└── Consumes core DS; extends, does not fork
```

**Governance:** Platform team owns the contract (Layer 1 + Layer 2). Domain teams own their extensions (Layer 3 + custom components). Domain teams cannot modify Layer 1 or Layer 2 — only consume and extend.

**Meeting cadence:** Weekly office hours (async); monthly design system guild (sync); quarterly roadmap review.

---

### Hub-and-Spoke Model

```
Hub: Central Design System Team
├── Full ownership of tokens + core components
├── Accepts contributions via RFC process
└── Provides support channel for spoke teams

Spokes: Consuming Product Teams
├── Consume core DS as versioned npm package
├── Submit contributions upstream via RFC
└── Do NOT maintain local forks
```

**When to use:** Smaller organisations (< 5 product teams), single brand, no significant domain specialisation.

**Risk:** Hub becomes bottleneck. Mitigate with clear SLAs (RFC response ≤ 5 days, PR review ≤ 3 days).

---

### Monorepo vs Polyrepo

| Dimension | Monorepo | Polyrepo |
|-----------|----------|----------|
| Atomic cross-package changes | ✅ Easy | ❌ Requires coordinated PRs |
| CI/CD complexity | Medium (workspace tooling) | High (inter-package versioning) |
| Package isolation | ❌ Harder (shared toolchain) | ✅ Strong |
| Dependency conflicts | ✅ Resolved at root | ❌ Each package manages separately |
| Onboarding | ✅ Single clone | ❌ Multiple repos to configure |
| Recommended for DS | ✅ Preferred | Only for fully independent platform teams |

**Tooling for monorepo:** pnpm workspaces + Turborepo (build caching) + Changesets (versioning + changelog generation).

---

## Governance Anti-Patterns

### Anti-Pattern 1 — Design System by Committee

**Symptom:** Every design decision requires consensus from all stakeholders. No single decision authority. Meetings end without resolution. Changes take 6+ months from proposal to release.

**Root cause:** No clear ownership model. RACI not defined for design system decisions.

**Fix:** Appoint a Design System Lead with final decision authority. Adopt an RFC process with a defined review window after which the DS Lead decides. Document the decision in the log regardless of outcome.

---

### Anti-Pattern 2 — No Decision Authority

**Symptom:** Anyone can merge changes to the design system. Token values change without announcement. Component APIs change between patch versions. Consuming teams discover breaking changes at deployment.

**Root cause:** No governance process. Design system treated as a shared internal library with no ownership.

**Fix:** Establish a CODEOWNERS file requiring DS team approval for all changes to token files and core components. Enforce semver via CI (automated semantic-release or Changesets). Require decision log entries for all breaking changes.

---

### Anti-Pattern 3 — Silent Deprecation

**Symptom:** A component disappears from the next major version with no warning. Consuming teams discover the removal when their build fails. Migration is not documented.

**Root cause:** No deprecation policy. DS team assumed deprecation was "obvious" from internal discussions.

**Fix:** Mandatory deprecation policy (see above). CI lint rule that catches imports of deprecated components and emits build warnings. Breaking change reviewers check for silent deprecations before approving major version PR.

---

### Anti-Pattern 4 — Fork Culture

**Symptom:** Product teams maintain local copies of DS components with "minor tweaks." Divergence grows. Security patches in core DS don't reach forked copies. Brand updates require hunting down all forks.

**Root cause:** Core DS doesn't support the customisation patterns product teams need, so they fork rather than contribute.

**Fix:** Audit fork reasons → they are a backlog of missing extension points. Add slot-based composition, theming escape hatches, and CSS class override support. Then establish a firm no-fork policy enforced by automated import analysis.

---

### Anti-Pattern 5 — Documentation Debt

**Symptom:** Components exist in code and Figma with no usage guidelines. Teams implement components differently across products. "How do I use X?" questions dominate the DS Slack channel.

**Root cause:** Documentation treated as optional/deferred. Code ships without stories or guidelines.

**Fix:** Block component merge until Storybook story, usage guidelines, and accessibility notes are present (PR checklist enforcement). Assign rotating documentation owner each sprint.

---

*Last updated: 2026-07. Companion to `.agents/skills/design-systems-arch/SKILL.md`.*
