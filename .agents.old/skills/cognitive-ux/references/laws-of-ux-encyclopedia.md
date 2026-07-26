# Laws of UX — Encyclopedia Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Use this when you need formal definitions, research provenance, threshold values, or concrete code examples for any law referenced in the cognitive-ux skill.

---

## Hick's Law

### Formal Definition
The time required to make a decision increases logarithmically with the number of choices available.

### Mathematical Formula
```
RT = a + b · log₂(n + 1)
```
- `RT` — reaction time (ms)
- `a` — non-decision overhead (motor prep ≈ 200 ms)
- `b` — empirical constant ≈ 150 ms/bit
- `n` — number of equally probable choices

*Hick (1952) and Hyman (1953) independently confirmed the information-theoretic framing.*

### Research Origin
- William Edmund Hick, "On the rate of gain of information" — *Quarterly Journal of Experimental Psychology*, 1952.
- Ray Hyman, "Stimulus information as a determinant of reaction time" — *Journal of Experimental Psychology*, 1953.

### Practical Threshold Values
| Choices (n) | Added decision time (approx.) |
|-------------|-------------------------------|
| 2 → 4       | +150 ms                       |
| 4 → 8       | +150 ms                       |
| 8 → 16      | +150 ms                       |
| >7 options  | Cognitive strain becomes noticeable |

Navigation menus beyond **7 top-level items** measurably increase task completion time.

### Design Implications
- Limit primary navigation to 5–7 items.
- Progressive disclosure: surface the most common 3–5 actions; hide advanced options behind "More."
- Reduce choice at decision points (checkout, onboarding) to cut abandonment.
- Group options categorically; the log formula applies per category, not total count.

### Implementation Example
```tsx
// Progressive-disclosure pattern: primary + overflow
const PRIMARY_ACTIONS = actions.slice(0, 5);
const OVERFLOW_ACTIONS = actions.slice(5);

<ActionBar>
  {PRIMARY_ACTIONS.map(a => <Button key={a.id} {...a} />)}
  {OVERFLOW_ACTIONS.length > 0 && (
    <OverflowMenu items={OVERFLOW_ACTIONS} label="More" />
  )}
</ActionBar>
```

### Common Misapplications
- Applying Hick's Law to sequential decisions (each step is its own RT calculation, not cumulative).
- Collapsing all options into one "More" menu so often that the primary set becomes useless.
- Ignoring the `+1` in the formula — zero choices still takes non-zero time.

---

## Fitts's Law

### Formal Definition
The time required to rapidly move to a target area is a function of the ratio between the distance to the target and the width of the target.

### Mathematical Formula
```
MT = a + b · log₂(2D / W)
```
- `MT` — movement time (ms)
- `a` — start/stop latency ≈ 70 ms (device-dependent)
- `b` — speed ≈ 100–200 ms/bit (device-dependent)
- `D` — distance from current position to target centre
- `W` — width of target along the axis of movement
- `ID = log₂(2D/W)` — index of difficulty (bits)

*Paul Fitts, "The information capacity of the human motor system in controlling the amplitude of movement" — Journal of Experimental Psychology, 1954.*

### Research Origin
Paul Fitts (1954). Confirmed for touchscreens by Soukoreff & MacKenzie (2004) with adjusted constants.

### Practical Threshold Values
| Minimum touch target | Platform recommendation |
|----------------------|------------------------|
| 44 × 44 pt           | Apple HIG              |
| 48 × 48 dp           | Material Design        |
| 24 × 24 CSS px       | WCAG 2.5.5 (AAA)      |

Edge/corner targets are effectively infinite width in one axis — exploit this for destructive or important actions placed on screen edges.

### Design Implications
- Make primary CTAs large and centrally placed.
- Do not place two destructive actions adjacent; increase distance or reduce size of the more dangerous one.
- Exploit screen edges and corners for persistent controls (back button, FAB).
- On mobile, prefer bottom-sheet patterns to keep targets in thumb reach zone.

### Implementation Example
```css
/* Minimum touch target with visual label smaller than target */
.btn-icon {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px; /* expand hit area beyond visible icon */
}
```

### Common Misapplications
- Treating Fitts's Law as applying only to mouse; it applies to all pointing devices (stylus, touch, eye-tracking).
- Making destructive actions large — contradicts the law intentionally to introduce friction.
- Ignoring the distance axis (D); a tiny, nearby button can outperform a large, distant one.

---

## Jakob's Law

### Formal Definition
Users spend most of their time on other sites. They prefer your site to work the same way as all the other sites they already know.

### Research Origin
Jakob Nielsen, NNGroup, 2000. Derived from cumulative usability research across thousands of user tests.

### Practical Threshold Values
No formula; qualitative. **Mental model transfer** occurs when:
- Navigation patterns match convention (hamburger = menu, magnifier = search).
- Standard interactions are preserved (pull-to-refresh, swipe-to-dismiss, long-press = context menu).

Deviation cost: users take **2–5× longer** on novel patterns vs conventional ones in first-session testing.

### Design Implications
- Prefer established patterns over "creative" navigation unless there is a measurable user-experience gain.
- Innovate in product logic, not in basic affordances.
- When deviating, provide explicit signposting and onboarding.
- Audit competitor and platform-native patterns before designing navigation.

### Implementation Example
```
✅ Search bar in header, top-right or full-width
✅ Logo top-left → home
✅ "Hamburger" ≡ off-canvas nav on mobile

❌ Search hidden under profile icon
❌ Logo centred with no click action
❌ Swipe-left = navigate forward (reverses convention)
```

### Common Misapplications
- Using Jakob's Law to justify stagnation — it applies to **interaction conventions**, not visual style.
- Assuming "users know Amazon's checkout" means your B2B SaaS should copy it exactly; the relevant reference class is the user's habitual apps, not all websites.

---

## Miller's Law

### Formal Definition
The average person can hold approximately **7 (± 2)** items in working memory at one time.

### Mathematical Formula
```
Capacity = 7 ± 2 "chunks"
```
A *chunk* is a meaningful unit (a digit, a word, a concept the user already recognises).

*George A. Miller, "The magical number seven, plus or minus two" — Psychological Review, 1956.*

### Research Origin
George A. Miller (1956). Updated by Cowan (2001): pure capacity without chunking ≈ 4 ± 1 items.

### Practical Threshold Values
| Guideline | Value |
|-----------|-------|
| Optimal list length (no scroll) | 5–7 items |
| Phone number chunks | 3-3-4 (chunked to 3 units) |
| Navigation items | ≤7 |
| Wizard steps visible at once | ≤5 |

### Design Implications
- Group related items into chunks (sections, cards) — each group counts as one item, not n.
- Limit form fields visible at one step to 5–7.
- Use progress indicators to externalise memory load across multi-step flows.
- Chunk phone numbers, credit cards, serial numbers in input masks.

### Implementation Example
```tsx
// Input mask that chunks 16-digit card number into 4 groups of 4
<MaskedInput
  mask="9999 9999 9999 9999"
  placeholder="0000 0000 0000 0000"
  aria-label="Card number"
/>
```

### Common Misapplications
- Citing "7 ± 2" as a hard limit for any UI element count — it applies specifically to *working memory* during active recall, not to scanning a visible list.
- Ignoring Cowan's revision: for novel, unchunked information the limit is closer to 4.

---

## Gestalt Principles

*Max Wertheimer, Kurt Koffka, Wolfgang Köhler — Gestalt psychology, 1920s–1930s. Applied to visual design by Gestalt school and systematised for HCI by Ware (2004).*

### Principle 1 — Proximity

**Definition:** Objects close to each other are perceived as a group.

**Design implication:**  
- Use spacing to communicate grouping without explicit borders.
- Form label above field → perceived as a unit. Label to the left with wide gap → ambiguous.
- `gap` in CSS flex/grid is the primary Gestalt proximity tool.

```css
/* Form group — proximity signals label + input are related */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px; /* tight = related */
  margin-bottom: 24px; /* loose = new group */
}
```

---

### Principle 2 — Similarity

**Definition:** Objects sharing visual characteristics (colour, shape, size, texture) are perceived as related.

**Design implication:**  
- All primary buttons same colour → perceived as one action class.
- Consistent icon style → perceived as navigation system.
- Breaking similarity deliberately draws attention (Von Restorff).

```scss
// Token-driven similarity: all interactive elements share --color-action
.btn-primary, .link-primary, .chip-selectable:checked {
  color: var(--color-action-600);
}
```

---

### Principle 3 — Closure

**Definition:** The mind fills in missing information to complete a familiar shape.

**Design implication:**  
- Truncated cards imply "more below" — use deliberate bleed to suggest scroll.
- Progress rings don't need to be complete to be understood.
- Skeleton loaders use incomplete shapes to imply loading content.

```css
/* Bleed-out card implies continuation — closure in action */
.card-list {
  overflow-x: auto;
  padding-right: 0; /* last card intentionally cut off */
}
```

---

### Principle 4 — Continuity

**Definition:** Elements arranged on a line or curve are perceived as related and the eye follows the implied path.

**Design implication:**  
- Left-align form labels → eye follows vertical line.
- Timelines and breadcrumbs exploit continuity to imply sequence.
- Avoid abrupt directional changes in multi-step flows.

---

### Principle 5 — Figure-Ground

**Definition:** The mind separates visual fields into a figure (foreground, focus) and a ground (background).

**Design implication:**  
- Modal overlays use scrim to push background to "ground."
- Tooltips and popovers must have sufficient elevation (shadow + background) to read as figure.
- Ambiguous figure-ground (reversible images) disorients users — avoid in functional UI.

```css
/* Scrim creates figure-ground separation for modals */
.modal-scrim {
  background: rgba(0 0 0 / 0.48);
  backdrop-filter: blur(2px);
}
```

---

### Principle 6 — Common Region

**Definition:** Elements within the same enclosed area are perceived as a group, even without other similarity.

**Design implication:**  
- Card borders / background fill create common region more powerfully than proximity alone.
- Use cards to unambiguously group disparate element types (icon + heading + body + CTA).
- Table rows use alternating fills to create common region per row.

---

## Peak-End Rule

### Formal Definition
People judge an experience almost entirely on how they felt at its most intense point (peak) and at its end, rather than based on the sum or average of every moment.

### Research Origin
Daniel Kahneman, Barbara Frederickson et al., "When More Pain Is Preferred to Less: Adding a Better End" — *Psychological Science*, 1993.

### Practical Threshold Values
No formula. Empirically:
- The **peak** (positive or negative) and the **end** account for ~80% of remembered experience.
- Duration neglect: a 30-second frustrating experience with a good ending is rated better than a 10-second frustrating one with a bad ending.

### Design Implications
- Engineer the **end state** carefully: confirmation pages, success states, offboarding moments.
- Identify the highest-pain step in a flow (peak) and redesign or add delight there.
- Don't end flows on error states; always route to a positive recovery message.
- Onboarding "aha moment" = engineered positive peak.

### Implementation Example
```
Checkout flow negative peak: payment form + CVV friction
→ mitigation: card scanner, Apple/Google Pay, remember card
Checkout flow end: order confirmation with personalised message
→ "Your order is on its way, Alice! Track it here →"
```

### Common Misapplications
- Optimising average experience at the expense of peak and end moments.
- Adding unnecessary steps before the end to "add value" — duration neglect means this rarely helps.

---

## Von Restorff Effect (Isolation Effect)

### Formal Definition
When multiple homogeneous stimuli are presented, the one that differs from the rest is most likely to be remembered.

### Research Origin
Hedwig von Restorff, "Über die Wirkung von Bereichsbildungen im Spurenfeld" — *Psychologie und Physiologie der Sinnesorgane*, 1933.

### Practical Threshold Values
- One isolated element per visual cluster for maximum effect; two or more isolated elements cancel each other out.
- Contrast ratio between isolated element and peers should be perceptually significant (not just a token shift).

### Design Implications
- Highlight a single recommended pricing plan per tier table.
- Use a distinct colour/shape for the primary CTA when surrounded by secondary actions.
- Sparingly use badges ("New," "Popular") — more than 1–2 per screen neutralises the effect.

### Implementation Example
```tsx
<PricingTable>
  <Plan name="Starter" />
  <Plan name="Pro" highlighted badge="Most Popular" /> {/* ONE isolation */}
  <Plan name="Enterprise" />
</PricingTable>
```

### Common Misapplications
- Highlighting every new feature badge → visual noise, no isolation effect.
- Using Von Restorff to make destructive actions prominent by accident (red delete button most visible in a form).

---

## Doherty Threshold

### Formal Definition
Productivity soars and users experience flow when a computer and its users interact at a pace of less than **400 ms**.

### Research Origin
Walter J. Doherty & Ahrvind J. Thadani, "The Economic Value of Rapid Response Time" — IBM Systems Journal, 1982.

### Practical Threshold Values
| Response time | User perception |
|---------------|-----------------|
| < 100 ms      | Instantaneous — feels like direct manipulation |
| 100–300 ms    | Fast — no feedback needed |
| 300–1000 ms   | Noticeable delay — spinner optional |
| > 1000 ms     | Disrupted flow — spinner required |
| > 10 s        | User attention lost, likely abandonment |

### Design Implications
- Optimistic UI updates: apply state change immediately, reconcile with server asynchronously.
- Skeleton screens vs spinners: skeletons are preferable for > 300 ms waits (preserve layout continuity).
- Perceived performance > actual performance: animations, progress bars, and pre-fetching all reduce perceived latency.

### Implementation Example
```tsx
// Optimistic update pattern — apply before server confirms
function toggleLike(postId: string) {
  // 1. Update UI immediately
  setLiked(prev => !prev);
  // 2. Send to server; revert on failure
  api.toggleLike(postId).catch(() => setLiked(prev => !prev));
}
```

### Common Misapplications
- Using animation to mask latency beyond 400 ms without actually improving performance — users notice the deception after repeated use.
- Adding spinners for sub-100 ms operations → makes app feel slower.

---

## Parkinson's Law

### Formal Definition
Work expands so as to fill the time available for its completion. Applied to UX: data entry expands to fill the time the form allows.

### Research Origin
C. Northcote Parkinson, "Parkinson's Law" — *The Economist*, 1955. UX application attributed to various practitioners in the 2010s.

### Practical Threshold Values
No formula. Heuristic:
- Forms with no time pressure or visible progress become elongated by users (excessive explanations, re-reading, second-guessing).
- Progress indicators that show "3 of 5 steps" create an implicit time box.

### Design Implications
- Show progress explicitly in multi-step flows.
- Use time-boxed interactions for tasks that benefit from brevity (profile setup, quick settings).
- Limit optional fields — more fields available = more time spent, lower completion rate.
- Inline validation reduces re-reading and correction loops.

### Implementation Example
```tsx
<Wizard currentStep={step} totalSteps={5}>
  <WizardStep title="Basic info" estimatedTime="~1 min">
    {/* Progress makes implicit time box explicit */}
  </WizardStep>
</Wizard>
```

### Common Misapplications
- Interpreting Parkinson's Law as a reason to make forms shorter at the cost of completeness; the real lever is *perceived* time box, not fewer fields.
- Applying to development estimates only — the UX application is distinct and valuable.

---

*Last updated: 2026-07. Companion to `.agents/skills/cognitive-ux/SKILL.md`.*
