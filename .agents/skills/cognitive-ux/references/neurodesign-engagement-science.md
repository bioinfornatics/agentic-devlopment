# Neurodesign & Engagement Science — Reference

> **Progressive-disclosure companion to `SKILL.md`.**  
> Evidence-based reference for visual attention, emotional response, engagement mechanics, and ethical guardrails.

---

## Visual Attention

### Pre-Attentive Attributes

Pre-attentive processing occurs in < 250 ms, before conscious directed attention is engaged. The visual cortex extracts these features in parallel across the entire visual field. (Treisman & Gelade, 1980 — Feature Integration Theory)

| Attribute | Processing speed | Effective use in UI |
|-----------|-----------------|---------------------|
| **Colour (hue)** | ~50–150 ms | Status indicators, category coding, CTA highlighting |
| **Colour (luminance/value)** | ~50 ms | Hierarchy, focus state, disabled state |
| **Motion** | ~50 ms (fastest) | Alerts, progress, loading states — use sparingly |
| **Size** | ~100 ms | Typographic hierarchy, icon importance |
| **Shape** | ~150 ms | Icon disambiguation, component type |
| **Orientation** | ~100 ms | Arrows, directional cues |
| **Spatial position** | ~50 ms | Layout hierarchy, reading path |
| **Enclosure** | ~100 ms | Grouping (Gestalt common region) |

**Design application:**
- Use **one** pre-attentive attribute per visual hierarchy level to avoid pop-out competition.
- Colour alone must never be the sole differentiator (WCAG 1.4.1) — pair with shape or text.
- Motion is processed fastest but habituates quickly; reserve for genuine alerts and state changes.

### F-Pattern and Z-Pattern Reading

**F-Pattern** (Nielsen, 2006 — eye-tracking study of 232 users):
- Users scan web pages in an F-shaped pattern: strong horizontal scan across the top, second horizontal scan lower down, then a vertical scan down the left edge.
- Applies to text-heavy, list-heavy layouts (search results, article bodies, dashboards).

**Implications:**
- Place the most critical information in the top horizontal band and left edge.
- Avoid right-column content for key actions — it is in the "ignored" zone.
- Use subheadings to restart horizontal fixation at each F-bar.

**Z-Pattern:**
- Applies to sparse, visually designed pages (landing pages, hero sections, card grids).
- Eye begins top-left, sweeps to top-right, diagonal to bottom-left, sweeps to bottom-right.

**Implications:**
- Place logo top-left, navigation top-right, hero CTA bottom-right.
- Pair-image + text in Z-flow (image left, text right) aligns with natural scan diagonal.

### Fixation Maps and First Saccade

**Terminology:**
- **Fixation:** Eye stationary on a point (150–500 ms); active processing occurs here.
- **Saccade:** Rapid eye movement between fixation points (~30–80 ms); no processing during movement.
- **First saccade:** Where the eye lands within the first 100–200 ms of page load.

**What captures the first saccade (in order of strength):**
1. Human faces (especially eye gaze) — face detection is hardwired
2. High-contrast, large elements
3. Motion (even peripheral)
4. Warm colours (red, orange) in cool-dominant fields
5. Isolated/unique element (Von Restorff)
6. Text rendering (first word in natural reading position)

**Design application:**
- If your primary CTA competes with a face image, the face wins the first saccade — orient face gaze toward the CTA to direct attention.
- Hero sections: ensure first saccade lands on value proposition, not decoration.
- Use heatmap tools (Hotjar, Crazy Egg, FullStory) to validate fixation distribution against intent.

---

## Emotional Response

### Colour Psychology

Colour-emotion associations are **partially universal** (biological) and **partially cultural** (learned). Design for the target cultural context; do not apply Western associations globally.

| Colour | Western association | Cultural caveat | UI use |
|--------|-------------------|-----------------|--------|
| Red | Danger, urgency, passion | Luck/prosperity in China | Errors, alerts, destructive actions |
| Orange | Energy, warmth, CTA | None significant | Secondary CTAs, notifications |
| Yellow | Optimism, caution | Mourning in some ME cultures | Warning states, highlights |
| Green | Success, nature, go | Death/illness in some LatAm contexts | Success states, confirmations |
| Blue | Trust, calm, technology | Universal (sky/water) | Primary brand, trust signals |
| Purple | Creativity, luxury | Mourning in some EU traditions | Premium tiers, creative tools |
| Black | Sophistication, power | Death/mourning in Western cultures | Dark mode, luxury positioning |
| White | Cleanliness, space | Death/mourning in East Asian cultures | Default background, minimalist design |

**Physiological effects (evidence base — Elliot & Maier, 2014):**
- Red exposure increases heart rate and can slightly impair performance on analytical tasks (threat association).
- Blue environments are associated with increased creativity output.
- Green reduces perceived stress (biophilia hypothesis — Ulrich, 1983).

**Design application:**
- Do not rely on colour emotion mapping alone; test with target audience.
- Establish a semantic colour layer (danger = red, success = green) and be consistent — inconsistency erodes learned associations.
- In multi-cultural products, prefer neutral brand colours with secondary semantic coding.

### Shape Psychology

| Shape family | Psychological association | UI use |
|-------------|--------------------------|--------|
| Circles / rounded | Safety, friendliness, unity | Consumer apps, chat bubbles, avatars |
| Squares / rectangles | Stability, reliability, professionalism | B2B, dashboards, data tables |
| Sharp angles / triangles | Urgency, dynamism, precision | Alert icons, sports/gaming, directional cues |
| Irregular / organic | Creativity, naturalness | Creative tools, lifestyle brands |

**Bouba/Kiki effect (Köhler, 1929; Ramachandran, 2001):**  
People consistently associate rounded shapes with soft names ("bouba") and angular shapes with sharp names ("kiki") — suggesting cross-modal shape-meaning mapping is neurologically encoded.

**Border-radius in design systems:**
- 0px radius — enterprise/professional
- 4px radius — neutral/standard
- 8px radius — friendly/approachable
- 50% (pill) — playful, conversational (chat, tags)

### Typography Mood

Typography communicates personality before content is read (MacKiewicz & Moeller, 2004).

| Type category | Mood signal | Use case |
|--------------|------------|---------|
| Serif (Traditional) | Authority, heritage, editorial | Publishing, finance, legal |
| Serif (Modern) | Elegance, luxury, precision | Fashion, premium brands |
| Sans-serif (Humanist) | Friendly, accessible, modern | Consumer tech, healthcare |
| Sans-serif (Geometric) | Clarity, rationality, tech | B2B SaaS, data products |
| Monospace | Code, precision, authenticity | Developer tools, terminals |
| Display / Script | Personality, expressiveness | Branding, marketing |

**Reading performance:**
- No statistically significant difference in reading speed between serif and sans-serif on screens at body text sizes (Lund, 1999; Dillon, 1992).
- Line length: 45–75 characters per line for optimal reading (Bringhurst, *Elements of Typographic Style*).
- Line height: 1.4–1.6× font size for body text.

---

## Engagement Mechanics

### Variable Reward Schedules

**Neurological basis:** Variable-ratio reinforcement schedules produce the highest and most persistent response rates of any reinforcement schedule. Dopamine release is maximised by *unpredictability* of reward — not the reward itself. (Skinner, 1938; Schultz, 1997 — dopamine prediction error)

| Schedule | Description | UI example | Addiction risk |
|----------|-------------|-----------|----------------|
| Fixed-ratio | Reward after N actions | Every 10 purchases = free item | Low |
| Variable-ratio | Reward after unpredictable N actions | Slot machines, social feed likes | **High** |
| Fixed-interval | Reward after time T | Daily login bonus | Medium |
| Variable-interval | Reward after unpredictable time | Push notification timing | Medium–High |

**Variable ratio in UI:**
- Social media feeds (uncertain whether next scroll yields interesting content).
- Pull-to-refresh (uncertain whether new content awaits).
- Loot boxes and gacha mechanics (explicit gambling mechanic).
- "Someone viewed your profile" notifications (unpredictable social validation).

**Ethical guardrail:** Variable ratio schedules bypass deliberate decision-making. Use fixed-ratio or fixed-interval schedules for loyalty/engagement programs. Reserve variable ratio for genuinely serendipitous content discovery (not synthetic unpredictability).

### Progress Mechanics

**Neurological basis:** Incomplete tasks remain in working memory (Zeigarnik effect, 1927). Visible progress reduces anxiety and motivates completion through goal-gradient effect — effort and speed increase as the goal approaches. (Hull, 1932)

**UI patterns:**
- Progress bars with percentage (explicit quantification)
- Profile completion meters ("Your profile is 70% complete")
- Step indicators in wizards
- Achievement milestones ("5/10 lessons complete")
- Skill trees and unlockable content

**Goal-gradient effect:** Users complete more loyalty stamps as they approach a reward; card with 2 stamps pre-filled toward a 10-stamp goal completes faster than a blank 8-stamp card (Kivetz, Urminsky & Zheng, 2006).

**Design application:**
- Never show empty progress bars at the start — seed with a small initial value (the "endowed progress" effect).
- Show absolute progress AND distance remaining: "8 of 10 complete — 2 to go."
- Celebrate milestones explicitly (confetti, badge) to create positive peaks (Peak-End Rule).

### Social Validation Loops

**Neurological basis:** Social acceptance and belonging activate the same brain reward circuits as primary rewards (food, money). Social rejection activates pain circuits. (Eisenberger, Lieberman & Williams, 2003)

**UI patterns:**
- Like/reaction counts
- Comment threading and reply notifications
- Follower/subscriber counts visible to creator
- "X friends use this" at account creation
- Public activity feeds

**Compulsion loop structure:**
```
Post content → receive validation (likes/comments) → dopamine release 
→ increased content creation → variable timing of next validation → loop
```

**Ethical guardrail:**
- Hiding like counts (Instagram experiment, 2019) reduces anxiety without eliminating social connection.
- Give users control over visibility of their social metrics.
- Do not send validation notifications at times specifically calculated to maximise compulsive check-ins (e.g., sending "someone liked your post" precisely when predicted dormant).

### Streak Mechanics

**Neurological basis:** Loss aversion (Kahneman) + completion drive (Zeigarnik) combine. Breaking a streak feels like a loss of an accumulated asset; the impending loss motivates action disproportionate to the actual value.

**UI patterns:**
- Duolingo streak counter (daily language practice)
- GitHub contribution graph
- Fitness app "Active days" streak
- Meditation app streak with "streak freeze" purchase

**Design application:**
- Provide streak freezes/grace periods — pure loss aversion with no recovery route causes abandonment when streak breaks.
- Display streak alongside intrinsic value ("You've practiced 42 days — your vocabulary has grown 18%") to re-anchor to real progress.
- Make streak goal user-set, not platform-imposed — personalised commitment is more sustainable.

---

## Ethical Guardrails

### Legitimate vs Manipulative Engagement Mechanics

| Mechanic | Legitimate form | Manipulative form |
|----------|-----------------|-------------------|
| Progress | Shows real progress toward user-chosen goal | Artificially fragments trivial tasks to create false progress |
| Social proof | Authentic, verifiable, specific | Fabricated reviews, bots, purchased follower counts |
| Scarcity | Real inventory limits | Fake countdown timers that reset |
| Variable reward | Genuine content serendipity | Synthetic unpredictability to hijack dopamine |
| Streaks | User-set goals with grace periods | Mandatory streaks with punitive reset, no recovery |
| Loss aversion | Reminding of genuine accumulated value | Fabricated "you'll lose" framing for non-losses |
| Social validation | Authentic reactions from real connections | Manufactured notification timing for compulsive check-ins |

### The Distinction Test

**Apply this test to any engagement mechanic:**

1. **Transparency:** Would users engage with this mechanic the same way if they fully understood how it works?  
   → If no → likely manipulative.

2. **Alignment:** Does the mechanic serve the user's stated goal or the product's engagement metric?  
   → If only the metric → likely manipulative.

3. **Control:** Can the user turn it off or opt out without penalty?  
   → If no → raises ethical concern.

4. **Recovery:** If the mechanic is habit-forming, does the product support users in reducing usage if they choose?  
   → If no → manipulative by design.

### Regulatory Context

- **UK Online Safety Act (2023):** Platforms must not use "harmful design features" that cause psychological harm, including addictive design for under-18s.
- **EU Digital Services Act (2022):** Prohibits recommender systems that exploit user vulnerabilities; requires opt-out for non-personalised feeds.
- **FTC Enforcement (US):** Deceptive dark patterns including fake urgency, hidden subscription costs, and manufactured social proof are actionable.
- **GDPR (EU/UK):** Consent UX must not use deceptive techniques including pre-ticked boxes or loss aversion coercion to obtain consent.

### Neurodesign Ethics Checklist

```
□ Engagement goal aligns with user's stated goal (not just session time)
□ No fabricated scarcity, urgency, or social signals
□ Variable reward used only for genuinely unpredictable content (not synthetic)
□ Streaks and progress mechanics have graceful recovery paths
□ Social validation displays are within user's control
□ Notification timing optimises for user convenience, not compulsive checking
□ Dark patterns audit completed before each major release
□ Under-18 user journeys have additional protections (UK OSA compliance)
```

---

*Last updated: 2026-07. Companion to `.agents/skills/cognitive-ux/SKILL.md`.*
