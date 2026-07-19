# Cognitive Biases & Design Patterns — Catalogue

> **Progressive-disclosure companion to `SKILL.md`.**  
> For each bias: definition → mechanism → UX manifestation → ethical design pattern.

---

## Overview Table

| Bias | Mechanism | UX Manifestation | Pattern |
|------|-----------|-----------------|---------|
| Anchoring | First number anchors all subsequent judgements | Original price shown next to sale price | Show value before cost; use reference price transparently |
| Confirmation bias | Seek information confirming prior belief | Users filter search to match expectations, ignore contrary results | Surfacing disconfirming options; neutral defaults |
| Choice overload | Too many options → analysis paralysis → no decision | SaaS pricing with 6+ tiers causes churn at pricing page | Tiered progressive disclosure, recommended defaults |
| Framing effect | Interpretation changes with presentation context | "90% fat-free" vs "10% fat" same information, different reception | Frame outcomes in user-benefit terms; avoid fear framing unless ethically warranted |
| Loss aversion | Losses feel ~2× more painful than equivalent gains feel good | Trial expiry warnings, cancel-flow retention screens | Use loss framing only for genuine recoverable losses; avoid dark patterns |
| Status quo bias | Prefer current state; change requires perceived justification | Users skip optional profile steps; keep default notification settings on | Design defaults deliberately; make inertia work for beneficial outcomes |
| Social proof | Infer correct behaviour from others' behaviour | "12,000 teams use this" badges, review stars | Use authentic, specific social proof; avoid fabricated or vague signals |
| Scarcity bias | Scarce items are valued higher | "Only 3 left in stock", countdown timers | Use only when scarcity is real; never fabricate |
| Bandwagon effect | Adopt behaviours because others do | Trending/Popular sections, follower counts | Pair with quality signals; avoid homogenising discovery |
| Decoy effect | Adding asymmetrically dominated option shifts choice | Three-tier pricing where middle tier looks best | Price tiers designed to guide to sustainable/profitable choice honestly |
| Cognitive load / Extraneous load | Working memory overwhelmed by irrelevant processing | Dense forms, jargon-heavy UIs, unnecessary animations | Reduce extraneous load; increase germane load only for learning products |

---

### Anchoring

**Definition:** The first piece of numerical information encountered (the "anchor") disproportionately influences subsequent judgements.

**Mechanism:** The brain uses the anchor as a starting point and adjusts insufficiently from it, even when the anchor is arbitrary. (Tversky & Kahneman, 1974)

**UX Manifestation:**
- Original price (`~~$200~~`) next to sale price (`$120`) anchors perceived value.
- Salary inputs pre-filled with a range anchor negotiation.
- The first plan shown in pricing anchors perceived affordability of subsequent plans.

**Design Pattern — Ethical use:**
- Show the genuine market value or original price alongside discounted price to help users make informed comparisons.
- Sequence pricing tiers from highest to lowest to anchor on premium and make mid-tier seem affordable.
- Always base anchor values on real data, not fabricated reference prices.

**Anti-pattern (avoid):** Inflating a "was" price artificially to manufacture a discount perception — illegal in many jurisdictions (UK Consumer Protection from Unfair Trading Regulations 2008; FTC guidelines).

---

### Confirmation Bias

**Definition:** The tendency to search for, interpret, and recall information in a way that confirms pre-existing beliefs.

**Mechanism:** Information confirming prior beliefs is processed faster and weighted more heavily by the prefrontal cortex; disconfirming information triggers mild threat response. (Wason, 1960)

**UX Manifestation:**
- Users apply filters that match their assumption ("cheap flights to Paris") and ignore results outside that frame.
- Onboarding questionnaires that present only agreeable options create false confidence.
- A/B testers who "know" which variant will win stop tests early when results confirm expectations.

**Design Pattern — Mitigation:**
- Surface best-match results *and* an "explore" rail showing unexpected high-quality options.
- Design search results to surface disconfirming options when the query has common misconceptions.
- Progress indicators and milestone screens should acknowledge realistic expectations, not only success framing.

**Design Pattern — Ethical use:**
- Personalisation legitimately exploits confirmation bias to serve relevant content — clearly labelled "Recommended for you."
- Onboarding that surfaces the user's stated goal throughout the experience reinforces commitment (positive confirmation loop).

---

### Choice Overload (Paradox of Choice)

**Definition:** Beyond a threshold number of choices, satisfaction and decision-making quality decrease.

**Mechanism:** Evaluating many options consumes working memory, increases opportunity cost regret, and raises fear of a suboptimal choice — leading to deferral or avoidance. (Schwartz, 2004; Iyengar & Lepper, 2000 — jam study)

**UX Manifestation:**
- SaaS pricing pages with 5+ tiers: users leave without subscribing.
- Filter panels with 30+ options: users either apply no filters or apply random ones.
- Onboarding "choose your integrations" with 40 logos: users skip entirely.

**Design Pattern:**
- **Recommended default:** Pre-select the best option for the median user; let power users override.
- **Progressive disclosure:** Show 3–4 options; "See all plans" expands to full set.
- **Opinionated curation:** Netflix-style "Top 10 for you" instead of browse-all-first.
- **Threshold:** 3–7 options at primary decision points; paginate or filter beyond that.

---

### Framing Effect

**Definition:** People react differently to the same information depending on whether it is presented positively or negatively.

**Mechanism:** The brain processes gains and losses in distinct neural circuits; prospect theory shows the loss circuit is more sensitive. (Kahneman & Tversky, 1979)

**UX Manifestation:**
- "Save 20%" (gain frame) vs "Don't lose 20%" (loss frame) — both communicate identical value.
- Permission prompts framed as "Allow app to send helpful updates" vs "Enable notifications."
- Error messages framed as problems vs as next steps.

**Design Pattern:**
- Frame confirmations in benefit/gain terms: "You're saving $24/month" not "You avoided a $24 charge."
- Frame permission requests around user benefit, not system capability.
- Frame error messages as actionable steps: "Try a different email address" not "Email address is invalid."
- Use loss framing only when the loss is real and user recovery is the goal (e.g., trial expiry reminders).

---

### Loss Aversion

**Definition:** The pain of losing something is approximately twice as powerful as the pleasure of gaining something of equal value.

**Mechanism:** Losses activate the amygdala (threat response) more intensely than equivalent gains activate reward circuits. Prospect theory (Kahneman & Tversky, 1979) quantifies the asymmetry at ~λ = 2.25.

**UX Manifestation:**
- Cancel flow: "You'll lose your 47 saved items" — exploits loss aversion to reduce churn.
- Trial expiry: "Your premium access ends in 3 days" — creates urgency through impending loss.
- Progress bars showing completion percentage — losing progress feels worse than not starting.

**Design Pattern — Ethical use:**
- Use loss framing to remind users of genuine accumulated value they would lose (data, history, settings).
- Progress persistence: autosave and restore draft states so loss of work feels recoverable.
- Clear offboarding: show what is deleted vs what is retained.

**Dark pattern (avoid):**
- Fabricating loss ("Your discount expires in 10:00" with a timer that resets on reload).
- Hiding cancel options then using loss language to coerce retention — FTC deceptive design guidelines.

---

### Status Quo Bias

**Definition:** A preference for the current state of affairs; change is perceived as a loss.

**Mechanism:** Changing from the status quo requires cognitive effort (evaluating options) plus loss aversion for surrendering the current state. (Samuelson & Zeckhauser, 1988)

**UX Manifestation:**
- Users keep default notification settings ON even when they'd prefer OFF if asked.
- Users skip optional profile setup steps — the default empty state persists.
- Enterprise users resist software migrations even when the new tool is objectively better.

**Design Pattern — Beneficial inertia:**
- Design defaults to serve the user's likely best outcome: privacy settings default to minimal data sharing, notification settings default to low frequency.
- GDPR-aligned consent: opt-in default for data sharing exploits status quo bias ethically.
- Onboarding should reduce the effort to change from "empty" to "set up" — pre-fill where possible.

**Dark pattern (avoid):**
- Pre-ticking marketing consent checkboxes (illegal under GDPR).
- Making cancellation harder than sign-up by design ("roach motel").

---

### Social Proof

**Definition:** People look to the behaviour of others to determine the correct behaviour in ambiguous situations.

**Mechanism:** Conformity instinct reduces cognitive effort for uncertain decisions. Social cues activate mirror neuron systems. (Cialdini, 1984)

**UX Manifestation:**
- Star ratings and review counts on product pages.
- "X people are viewing this right now" on booking sites.
- "Joined by 50,000 developers" on SaaS landing pages.
- Activity feeds showing what connections are doing.

**Design Pattern — Ethical use:**
- Display authentic, specific, verifiable social proof: named testimonials, review timestamps, verified purchase badges.
- Use relevant social proof: "Trusted by companies like yours" beats generic "1M users."
- Show negative reviews alongside positive ones — credibility of overall score improves conversion and satisfaction.

**Dark pattern (avoid):**
- Fabricated review counts, purchased reviews, or testimonials from non-customers.
- Real-time viewer counts that aren't real (FOMO manipulation).

---

### Scarcity Bias

**Definition:** Items perceived as scarce are valued more highly than identical items perceived as abundant.

**Mechanism:** Evolutionary scarcity signals resource competition; dopamine response increases for rare stimuli. (Cialdini, 1984; Worchel et al., 1975)

**UX Manifestation:**
- "Only 2 left in stock" on ecommerce product pages.
- "This deal expires in 23:47:12" countdown timers.
- "Limited beta access" waitlist mechanics.
- "Exclusive" membership tiers.

**Design Pattern — Ethical use:**
- Display real inventory counts when stock is genuinely limited (< 5 units).
- Use genuine time-limited pricing with clear terms.
- Waitlists as authentic demand management + community building.

**Dark pattern (avoid):**
- Countdown timers that reset on page reload.
- "Only 1 left" for items with unlimited digital inventory (SaaS seats, digital downloads).
- Creating artificial scarcity for non-scarce goods — FTC enforcement target.

---

### Bandwagon Effect

**Definition:** People are more likely to adopt beliefs or behaviours as more people adopt them.

**Mechanism:** Conformity instinct + social proof converge; large adoption signals safety and quality reduction of evaluation effort. (Asch, 1951)

**UX Manifestation:**
- "Trending now" or "Most popular" sections skew consumption toward already-popular content.
- High follower/subscriber counts signal trustworthiness.
- App store "Top Charts" create self-reinforcing popularity loops.

**Design Pattern:**
- Pair popularity signals with quality signals (rating score, editorial badge) to prevent low-quality viral content dominating.
- Personalise "popular" to user's network or segment rather than global charts.
- Provide "Hidden gems" or editorial curation to counterbalance bandwagon homogenisation.

**Consideration:** Bandwagon mechanics can suppress diversity and create filter bubbles. Build diversity/serendipity rails alongside popularity rails.

---

### Decoy Effect (Asymmetric Dominance)

**Definition:** Adding an asymmetrically dominated option (worse than one option, but close to another) shifts preferences toward the target option.

**Mechanism:** The decoy provides a comparison reference that makes the target option appear clearly superior, without changing objective value. (Huber, Payne & Puto, 1982)

**UX Manifestation:**
- Three-tier SaaS pricing: Starter ($9) / Pro ($29) / Enterprise ($79) — Pro is the decoy target; Enterprise makes Pro seem reasonable.
- Popcorn sizes: Small (bad value) / Medium (target) / Large (decoy — only slightly more than Medium).

**Design Pattern — Ethical use:**
- Use decoy pricing to guide users to a plan that genuinely serves their needs, not just the highest-margin plan.
- Make plan comparison tables transparent so users can verify value differences.
- Label the recommended plan clearly; do not hide the superior value of lower tiers from users who don't need higher tiers.

**Dark pattern (avoid):**
- Constructing plans specifically to confuse rather than inform (feature bundling designed to obscure comparisons).

---

### Cognitive Load / Extraneous Load

**Definition:** The total mental effort required to process information. Extraneous load is unnecessary cognitive effort caused by poor design.

**Mechanism:** Working memory has limited capacity (~4 chunks for novel information; Cowan, 2001). Extraneous load consumes capacity without contributing to learning or task completion. (Sweller, 1988)

**UX Manifestation:**
- Dense forms with all fields on one screen increase extraneous load.
- Jargon-heavy error messages force users to translate before acting.
- Decorative animations during task completion distract from information processing.
- Inconsistent interaction patterns force re-learning the interface at each screen.

**Design Pattern:**
- **Intrinsic load management:** Break complex tasks into steps (wizard pattern); sequence information in logical chunks.
- **Extraneous load reduction:** Consistent layouts, progressive disclosure, plain language, relevant inline help.
- **Germane load investment (learning products):** Use worked examples, spaced repetition, and elaborative interrogation to build lasting schemas.

**Measurement:**
- NASA-TLX scale for perceived mental demand (self-report).
- Task completion time and error rate as proxy metrics.
- Eye-tracking fixation count per page as proxy for visual search load.

---

*Last updated: 2026-07. Companion to `.agents/skills/cognitive-ux/SKILL.md`.*
