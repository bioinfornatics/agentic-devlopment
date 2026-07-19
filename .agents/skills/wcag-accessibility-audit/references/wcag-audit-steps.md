## Audit Procedure

Follow these steps systematically:

### Step 1: Preparation (15 minutes)

1. **Understand the interface:**
   - Review `interface_description` and `urls_or_screenshots`
   - Identify key user flows (homepage, forms, navigation, media content)
   - Note `target_conformance_level` (default: AA)

2. **Set up tools:**
   - Browser extensions: axe DevTools, WAVE, Lighthouse
   - Screen reader: NVDA (Windows), VoiceOver (Mac), JAWS
   - Keyboard only (unplug mouse)
   - Color contrast analyzer

3. **Define scope:**
   - Select representative pages (10-15 pages or key templates)
   - Include: homepage, main navigation, forms, dynamic content, media

### Step 2: Automated Testing (20 minutes)

Run automated tools to catch obvious issues:

**Recommended Tools:**
- **axe DevTools** (browser extension) - Most accurate automated tool
- **WAVE** (WebAIM) - Visual accessibility evaluation
- **Lighthouse** (Chrome DevTools) - Accessibility score + issues
- **HTML Validator** - W3C Markup Validation Service
- **Color Contrast Analyzer** - WebAIM or Stark

**Document:**
- Tool-detected violations
- Success criteria failed
- Affected components/pages
- Auto-generated severity (Critical/Serious/Moderate/Minor)

**Note**: Automated tools catch ~30-40% of issues. Manual testing is essential.

### Step 3: Manual Testing (60-90 minutes)

Manually test what automation misses:

#### Keyboard Navigation Test (15 minutes)
- [ ] Navigate entire site with Tab key only
- [ ] Test all interactive elements (links, buttons, forms, dropdowns)
- [ ] Check focus visibility (can you see where you are?)
- [ ] Verify logical focus order
- [ ] Test modal dialogs (open/close with keyboard, trap focus)
- [ ] No keyboard traps (can always navigate away)
- [ ] Test keyboard shortcuts (if any)

#### Screen Reader Test (20 minutes)
**NVDA (Windows) / VoiceOver (Mac) / JAWS**
- [ ] Navigate by headings (H key)
- [ ] Navigate by landmarks (D key)
- [ ] Navigate by links (K key)
- [ ] Navigate by form controls
- [ ] Verify alt text is meaningful
- [ ] Check form labels are announced
- [ ] Test dynamic content (ARIA live regions)
- [ ] Verify button/link purpose is clear

#### Visual/Content Test (15 minutes)
- [ ] Zoom to 200% (no horizontal scroll on desktop)
- [ ] Test at 320px width (mobile reflow)
- [ ] Check color contrast (text, buttons, icons)
- [ ] Verify information not conveyed by color alone
- [ ] Test with text spacing adjustments
- [ ] Check video captions/transcripts
- [ ] Check audio descriptions (if applicable)

#### Form Test (15 minutes)
- [ ] All inputs have visible, persistent labels
- [ ] Required fields indicated (not by color alone)
- [ ] Error messages are specific and helpful
- [ ] Errors identified and associated with fields
- [ ] Suggestions provided to fix errors
- [ ] Confirmation before submission (legal/financial)
- [ ] Can review and edit before final submit

#### Semantic HTML Test (10 minutes)
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Lists use `<ul>`, `<ol>`, `<li>`
- [ ] Buttons use `<button>` not `<div>`
- [ ] Links use `<a href>`
- [ ] Landmark regions (header, nav, main, footer)
- [ ] Tables have `<th>` headers and captions
- [ ] Form controls use proper elements

#### ARIA Test (10 minutes)
- [ ] ARIA used appropriately (HTML first)
- [ ] No ARIA is better than bad ARIA
- [ ] aria-label/aria-labelledby for custom controls
- [ ] aria-live for dynamic content
- [ ] aria-expanded, aria-pressed, aria-checked for state
- [ ] role="button" for custom buttons
- [ ] Verify ARIA doesn't conflict with HTML semantics

### Step 4: Reporting (30 minutes)

Generate comprehensive, prioritized report.

---

