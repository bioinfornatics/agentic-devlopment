# AI Safety & Trust Guardrails Reference

Comprehensive reference for trust calibration and safety UX in agentic AI systems.
Source: Extracted from phazurlabs/ux-ui-mastery@agentic-ai-generative-ux.

---

## Trust Calibration Framework

**Goal:** Calibrated trust — users trust the AI exactly as much as its actual reliability warrants.

| Trust State | Problem | Consequence |
|-------------|---------|-------------|
| Over-trust | User accepts AI outputs without verification | Unverified acceptance of errors |
| Under-trust | User verifies everything | Wasted effort, eventual abandonment |
| Calibrated | Trust matches reliability | Optimal efficiency and safety |

### Trust Calibration Spectrum

```
Read-only report → Suggest+confirm → Auto-approve low-risk → Gate high-risk → Full autonomy
```

**Always start left. Earn trust through demonstrated reliability before moving right.**

---

## Guardrail Tier System

| Tier | Condition | Agent Behavior | Examples |
|------|-----------|----------------|----------|
| **Tier 1 — Informational** | Low-risk, reversible | Acts autonomously, logs for optional review | Formatting, caching, summarization |
| **Tier 2 — Advisory** | Medium-risk | Proposes action, explains reasoning, awaits approval | File modifications, email drafts, API calls |
| **Tier 3 — Mandatory** | High-risk, irreversible, financially significant | Cannot proceed without explicit user approval | Deletions, external communications, purchases, deployments |

### Tier Assignment Criteria

**Primary axis: Reversibility**
- Easy to undo → Lower tier
- Hard to undo → Higher tier

**Secondary axes:**
- Financial impact (higher cost → higher tier)
- External visibility (sent externally → higher tier)
- Data sensitivity (PII/secrets involved → higher tier)
- Scope of change (broad scope → higher tier)

---

## Confidence Indicator Design

### Display Patterns

| Confidence Level | Visual Treatment | Interaction |
|------------------|------------------|-------------|
| High (>90%) | Solid presentation, no hedge | Direct action allowed |
| Medium (70-90%) | Subtle warning indicator | "I believe... but verify" language |
| Low (50-70%) | Amber/yellow highlight | Explicit confirmation required |
| Very Low (<50%) | Red warning, prominent hedge | Mandatory user decision |

### Language Patterns

| Confidence | Language Example |
|------------|------------------|
| High | "The file is located at /path/to/file" |
| Medium | "The file appears to be at /path/to/file" |
| Low | "I'm not certain, but the file might be at /path/to/file. Please verify." |
| Very Low | "I cannot determine the file location. Here are possible options: [list]" |

### Anti-patterns
- ❌ Displaying confidence without calibration data
- ❌ Using hedge language uniformly regardless of actual confidence
- ❌ Hiding uncertainty to appear more capable
- ❌ Numeric percentages without user understanding of calibration

---

## Verification UX Patterns

### Inline Fact-Check Affordances

```
┌──────────────────────────────────────────────────────┐
│ "The Apollo 11 mission landed on July 20, 1969." [✓] │
└──────────────────────────────────────────────────────┘
                                                  │
                                    [✓] = verified claim indicator
                                    Click to see source
```

### Source-Grounding UI

For RAG and knowledge-based responses:
- Inline citations with numbered references: "The policy requires X [1]"
- Source panel showing retrieved documents with relevance scores
- Highlight specific passage in source that supports each claim
- Date range of sources: "Based on documents from Jan 2024 - Feb 2026"

### User-Initiated Verification Flows

| Action | Purpose |
|--------|---------|
| "Show sources" | Display all grounding documents |
| "Verify this claim" | Re-retrieve with higher precision threshold |
| "Refresh sources" | Re-retrieve with updated knowledge base |
| "Mark as incorrect" | User feedback for model improvement |

---

## Error & Failure UX

### Graceful Degradation Hierarchy

| Failure Type | Response |
|--------------|----------|
| Partial success | Show partial results + clear indication of what failed |
| Recoverable error | Explain error + suggest user action to fix |
| Unrecoverable error | Preserve user data + explain what happened + offer alternatives |
| Critical failure | Safe shutdown + preserve all state + clear escalation path |

### Error Message Structure

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Task partially completed                         │
│                                                     │
│ What happened: Could not access external API        │
│ What succeeded: Analyzed 3 of 5 requested sources   │
│ What to do: Retry later or proceed with partial     │
│             results                                 │
│                                                     │
│ [Retry] [Continue with partial] [Cancel]            │
└─────────────────────────────────────────────────────┘
```

### Escalation After Failure

- After N consecutive failures on same task → escalate to human
- N is configurable per task type (default: 3)
- Never "try harder" indefinitely — infinite retry loops erode trust

---

## Hallucination Mitigation UX

### Hallucination Taxonomy

| Type | Definition | Mitigation |
|------|------------|------------|
| **Intrinsic** | Contradicts the input/prompt | Highlight contradiction |
| **Extrinsic** | Claims not supported by sources | Require source citation |
| **Factual** | Verifiably false | Fact-check with external knowledge |
| **Faithfulness** | Doesn't reflect source accurately | Side-by-side comparison |

### Guardrails for High-Risk Domains

| Domain | Required Guardrails |
|--------|---------------------|
| Medical | Mandatory source citation + "not medical advice" disclaimer |
| Legal | Mandatory jurisdiction check + professional consultation recommendation |
| Financial | Risk disclaimers + confidence indicators |
| Safety-critical | Human-in-loop verification required |

### Production Quality Gates

| Gate | Threshold | Action if Failed |
|------|-----------|------------------|
| Automated hallucination detection | Configurable per domain | Block or flag for review |
| Citation completeness | All claims grounded | Flag unsupported claims |
| Confidence calibration | Model confidence matches accuracy | Recalibrate or warn |
| Regression monitoring | Accuracy vs baseline | Alert + investigation |

---

## Consent & Accountability Triad

From Smashing Magazine (Feb 2026): Three-pillar ethical framework for agentic interfaces.

### 1. Control
- Users maintain meaningful control over agent actions
- Pause, modify, or cancel at any time
- Clear hierarchy of what agent can/cannot do autonomously

### 2. Consent
- Informed consent for autonomous operations
- Transparent about what data is accessed
- Explicit opt-in for expanded capabilities

### 3. Accountability
- Audit trails for all agent actions
- Explainable decisions (reasoning visible on demand)
- Clear attribution of outcomes to agent or user action

---

## Transparency Patterns

### Tool Call Visibility

Always surface tool/API calls in plain language:

```
┌─────────────────────────────────────────┐
│ 🔧 Using tools:                         │
│   • Searching web for "Claude pricing"  │
│   • Reading file: /docs/pricing.md      │
│   • Calling API: company.slack/post     │
└─────────────────────────────────────────┘
```

### Reasoning Trace
- Provide "show reasoning" affordance for complex decisions
- Abbreviated by default, full trace on demand
- Essential for Tier 2 and Tier 3 actions

### Action Attribution
For multi-agent systems, always attribute actions to specific agent:
- ✅ "Research Agent searched 12 sources"
- ❌ "Sources were searched" (passive voice hides agent)

---

## When NOT to Use AI

AI is not always the answer. **Prefer direct manipulation for:**
- Binary choices
- Simple CRUD operations
- Well-defined form fills
- Single-click actions
- Tasks where user preference is clear

**AI adds value for:**
- Ambiguous goals
- Complex multi-step workflows
- Pattern recognition at scale
- Personalization
- Creative assistance

---

## AI Fatigue Prevention

NNG Group State of UX 2026 identifies AI fatigue as critical concern.

### Avoid These Patterns
- Adding AI to features that work well without it
- Replacing deterministic workflows with probabilistic alternatives
- Generating content where human-authored would be more trustworthy
- Forcing AI interaction when direct manipulation is faster
- "AI-powered" badges as marketing rather than functional indicators

### Healthy AI Integration Signals
- Users choose AI path when it genuinely helps
- Error rates decrease, not increase
- Time to completion improves
- User satisfaction remains stable or improves
