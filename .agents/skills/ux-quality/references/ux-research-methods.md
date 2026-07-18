# UX Research Methods Reference

Comprehensive reference for user research planning, execution, and synthesis.
Source: Extracted and adapted from rampstackco/claude-skills@ux-research (97 installs).

---

## Research Question Framework

Bad questions produce bad research. Spend disproportionate time on framing.

**Good research questions are:**
- **Specific** — not "How do users feel about our product?"
- **Open-ended** — not "Do users like feature X?"
- **Decision-relevant** — the answer changes what gets built
- **Researchable** — can be answered through user contact, not just analysis

### Question Transformation Table

| Weak Question | Better Question |
|---|---|
| "Do users like our onboarding?" | "Where in onboarding do new users feel uncertain about whether to continue?" |
| "What features should we build?" | "What unmet needs do current users have when [specific job]?" |
| "Why is conversion low?" | "What's the user mental model when they reach the pricing page, and where does it diverge from our intent?" |
| "Is this design good?" | "Where do users hesitate, backtrack, or express confusion?" |
| "Do users want feature X?" | "What problem are users solving when they request X, and what's their current workaround?" |

---

## Research Method Selection

The method follows the question.

### Generative Methods (what's true?)

| Method | Best For | Sample Size | Duration |
|---|---|---|---|
| **In-depth interviews** | Context, motivation, mental models | 5-15 participants | 60 min each |
| **Contextual inquiry** | Workflow understanding, environment | 5-10 participants | 2-4 hours each |
| **Diary studies** | Behaviors over time, longitudinal patterns | 10-20 participants | Days to weeks |
| **Field research** | Cultural and contextual understanding | Variable | Hours to days |
| **Qualitative surveys** | Broad signal with depth | 50-200 responses | Async |

### Validation Methods (is this hypothesis right?)

| Method | Best For | Sample Size | Duration |
|---|---|---|---|
| **Concept testing** | Reactions to descriptions, mockups, prototypes | 6-12 participants | 30-45 min |
| **Card sorts** | Information architecture validation | 15-30 participants | 20-30 min |
| **Tree tests** | Findability without visual design influence | 50+ participants | 10-15 min |
| **Usability testing** | Task completion, usability issues | 5-8 (moderated), 15-30 (unmoderated) | 45-60 min |

---

## Personas (Lightweight Format)

### Template

```markdown
## [Persona Name]

**Archetype:** [One-line descriptor]

**Job-to-be-done:** [Primary job they're hiring the product for]

**Context:**
- Role/situation: [...]
- Frequency of use: [...]
- Tech comfort: [...]

**Goals:**
1. [Primary goal]
2. [Secondary goal]

**Pain points:**
1. [Major friction]
2. [Secondary friction]

**Mental model:** [How they think about the problem space]

**Quote:** "[Verbatim quote from research that captures their perspective]"
```

### Anti-patterns in Personas

- **Demographics without behaviors** — Age, location, hobbies don't predict product behavior
- **Fictional details** — Personas should be grounded in actual research quotes
- **Too many personas** — 3-5 is usually sufficient; more fragments focus
- **Static personas** — Refresh when research shows drift

---

## Journey Mapping

### Journey Map Structure (Rows)

| Lane | Content |
|---|---|
| **Phase** | Major stages (Awareness → Consideration → Onboarding → Activation → Retention) |
| **Steps** | Specific actions within each phase |
| **Touchpoints** | Web, app, email, support, in-person |
| **Goals** | What user is trying to accomplish |
| **Thoughts** | Internal dialogue |
| **Emotions** | Emotional state (often as curve visualization) |
| **Pain points** | Friction, frustration, failure |
| **Opportunities** | Where experience could improve |

### Journey Phase Templates

**SaaS Journey:**
```
Trigger → Discovery → Evaluation → Trial → Onboarding → Activation → Habit → Expansion → Renewal → Advocacy
```

**E-commerce Journey:**
```
Need → Discovery → Research → Decision → Purchase → Wait → Receive → Use → Reorder/Recommend
```

**Service Journey:**
```
Awareness → Inquiry → Quote → Decision → Delivery → Resolution → Follow-up → Repeat
```

---

## Interview Guide Template

### Structure (60-minute session)

1. **Welcome + Rapport** (5-10 min)
   - Purpose, recording consent, "no wrong answers"
   - Easy opener: "Tell me about yourself and what a typical day/week looks like"

2. **Context** (10-15 min)
   - "Walk me through how you handle [task] today, start to finish"
   - "What tools do you use? Why those specifically?"
   - "Who else is involved?"

3. **Core Questions** (20-30 min)
   - "Tell me about the last time you [specific situation]"
   - "What was hardest about that?"
   - "What did you try? What worked, what didn't?"
   - "If you had a magic wand, what would you change?"

4. **Stimulus Reactions** (10-15 min, optional)
   - Show prototype/concept
   - "What's your initial reaction?"
   - "What questions does this raise?"
   - "What's confusing or unclear?"

5. **Wrap-up** (5-10 min)
   - "Is there anything I should have asked but didn't?"
   - "One piece of advice for the team building this?"
   - Thank, incentive confirmation, follow-up permission

### Probe Library

| Probe Type | Example |
|---|---|
| Depth | "Tell me more about that" |
| Clarification | "Help me understand what you mean by [term]" |
| Specifics | "Give me an example" |
| Contradiction | "Earlier you said X, now Y. Help me understand" |
| Emotional | "What was that like for you?" |
| Motivation | "Why does that matter to you?" |
| Sequence | "What did you do next?" |

### Interview Anti-patterns

| Anti-pattern | Why It Fails |
|---|---|
| Leading questions | "Don't you find this confusing?" biases response |
| Hypothetical questions | "Would you use X?" poorly predicts behavior |
| Multiple questions | Participant only answers last one |
| Filling silence | Rushing past moments of reflection |
| Defending the product | Makes participant reluctant to criticize |
| "Why" repeatedly | Becomes interrogation after 2-3x |

---

## Usability Testing Scripts

### Task Design Rules

1. State user goal, not system action ("find a place to stay" not "click search")
2. Provide context (why are you doing this?)
3. Don't reveal the path
4. Don't use product terminology in task framing

### Task Script Template

```markdown
## Task [N]: [Goal]

**Scenario:** [Context for why they're doing this]

> "[User-facing task instruction]"

**Success criteria:**
- [ ] [Observable outcome 1]
- [ ] [Observable outcome 2]

**Observe:**
- Time to completion
- Clicks/steps taken
- Hesitations, backtracking
- Verbal expressions of confusion
- Task abandonment point (if any)

**Follow-up questions:**
- "What was easy or difficult about that?"
- "What were you looking for?"
- "What would you expect to happen if you [action]?"
```

### Sample Task Bank

| Task Type | Example |
|---|---|
| Discovery | "You're looking for a way to [goal]. See if this product can help." |
| Comparison | "You're evaluating options for [need]. Figure out which plan fits a team of [N]." |
| Recovery | "You signed up but forgot your password. Get back into your account." |
| Configuration | "You want to [setting change]. Make that happen." |
| First-run | "You just landed on this page. Figure out what this product does and if it's for you." |

---

## Synthesis Framework

### Process

1. **Capture observations** — Single data points: quotes, behaviors, emotions, moments
2. **Affinity mapping** — Cluster observations into themes (physical or digital sticky notes)
3. **Find patterns** — Themes appearing across multiple participants are signal
4. **Identify insights** — Non-obvious findings that explain "why" or imply "so what"
5. **Test against data** — If insight only fits some interviews, it's hypothesis, not insight
6. **Distinguish signal from noise** — 6/8 participants is signal; 1/8 may be noise

### Insight Quality Heuristics

Strong insights:
- Surprise the team (insights you already knew aren't insights)
- Explain a "why" the team was guessing about
- Imply specific actions ("so what?")
- Hold up across multiple data points
- Can be stated in 1-2 sentences

### Findings Document Template

```markdown
# [Topic] Research Findings

## Question Answered
[Specific research question]

## Method
[Approach, sample size, dates]

## Top Insights

### 1. [Insight statement]
**Evidence:** [Supporting quotes, behaviors]
**Implication:** [What this means for product/strategy]

### 2. [Insight statement]
...

## Themes (supporting observations)
- [Theme 1]
- [Theme 2]

## Outliers Worth Investigating
[Single-participant observations that may be signal]

## Recommended Next Steps
1. [Specific action]
2. [Specific action]
```

---

## Failure Patterns

| Pattern | Why It Fails |
|---|---|
| Research without a decision | Findings have no home; effort wasted |
| Vague questions | Bad questions produce uninterpretable answers |
| Recruiting "anyone willing" | Sample doesn't match audience |
| Leading questions | Findings reflect researcher, not user |
| Skipping synthesis | Notes alone aren't insights |
| Confirming existing beliefs | Suspect those especially |
| Findings that never ship | Research that doesn't change decisions is decoration |
| One-time research | Continuous discovery beats episodic research |

---

## Tools Reference

### Research Operations
- **Recruiting:** UserInterviews, Respondent, in-product intercepts, customer support referrals
- **Incentives:** $50-150 for 60 min (more for executives/specialized professions)
- **No-show buffer:** Recruit 7 to schedule 5 (20-30% no-show rate)

### Session Tools
- **Moderated remote:** Zoom, Google Meet, Lookback
- **Unmoderated:** UserTesting, Maze, Hotjar Engage
- **Recording:** Always audio + video with consent
- **Note-taking:** Dedicated notetaker when possible

### Synthesis Tools
- **Affinity mapping:** Miro, FigJam, physical sticky notes
- **Repository:** Dovetail, EnjoyHQ, or structured docs
- **Communication:** Highlight reels (5-10 min video), top-line insights docs
