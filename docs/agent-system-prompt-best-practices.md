# Agent System Prompt & Definition Best Practices

> Research compiled from: OpenAI Agents SDK, Anthropic "Building Effective Agents", browser-use production system prompt, Google ADK, OpenAI Codex AGENTS.md, and related production examples.
>
> Generated: 2026-07-06

---

## 1. What Is an "Agent Definition"?

An agent definition is the totality of instructions, constraints, tool declarations, and behavioral contracts that shape how an LLM-based agent operates. It manifests in several forms across the ecosystem:

| Form | Used by | Scope |
|------|---------|-------|
| System prompt (natural language) | All LLM agents | Per-call behavioral spec |
| `AGENTS.md` / `CLAUDE.md` | Codex, Cursor, Goose | Repo-level coding conventions |
| Code-side agent struct | OpenAI SDK, Google ADK | Typed definition: name + instructions + tools + guardrails |
| Recipe YAML | Goose | Workflow-level agent configuration |
| `.cursorrules` / `SYSTEM.md` | Cursor, IDE tools | Persona + code style rules |

---

## 2. Structural Sections Found in High-Quality Agent Definitions

Analysis of production agent definitions (browser-use, OpenAI Codex, Google ADK) reveals a **canonical 10-section structure**:

```
1. IDENTITY & ROLE          — Who the agent is and what it excels at
2. INPUT SPECIFICATION      — What data/context arrives at each step
3. TOOL INVENTORY           — What tools exist and when to use each
4. OPERATING RULES          — Domain-specific constraints (the "browser rules" layer)
5. PLANNING PROTOCOL        — When/how to plan vs. act directly
6. STEP LOOP STRUCTURE      — How a single turn is processed
7. OUTPUT FORMAT            — Exact schema the agent must emit
8. TASK COMPLETION RULES    — When/how to declare done; verification checklist
9. ERROR RECOVERY           — What to do when actions fail or loops are detected
10. CRITICAL REMINDERS      — Short, imperative "never forget" bullets
```

### Evidence: browser-use `system_prompt.md` section map

```xml
<intro>          → IDENTITY (role + capabilities)
<language_settings> → OPERATING RULES (language)
<input>          → INPUT SPECIFICATION (user_request, history, browser_state...)
<user_request>   → PRIORITY + TASK CONTRACT
<agent_history>  → STEP LOOP STRUCTURE
<browser_state>  → TOOL CONTEXT (DOM representation protocol)
<browser_vision> → TOOL CONTEXT (screenshot as ground truth)
<browser_rules>  → OPERATING RULES (50+ domain-specific rules)
<file_system>    → OPERATING RULES (memory/state layer)
<planning>       → PLANNING PROTOCOL (when to plan vs. act)
<task_completion_rules> → TASK COMPLETION + pre-done verification
<action_rules>   → STEP LOOP STRUCTURE (max actions per step)
<efficiency_guidelines> → TOOL INVENTORY (action categories: safe/page-changing)
<reasoning_rules> → STEP LOOP STRUCTURE (think-before-act pattern)
<examples>       → OUTPUT FORMAT (concrete templates for todo, memory, etc.)
<output>         → OUTPUT FORMAT (JSON schema)
<critical_reminders> → CRITICAL REMINDERS (12 imperative bullets)
<error_recovery> → ERROR RECOVERY (8-step procedure)
```

---

## 3. How Leading Projects Handle Each Dimension

### 3.1 Identity

**Minimal (bad):** `You are a helpful assistant.`

**Production (browser-use):**
```
You are an AI agent designed to operate in an iterative loop to automate 
browser tasks. Your ultimate goal is accomplishing the task provided in 
<user_request>.
<intro>
You excel at following tasks:
1. Navigating complex websites and extracting precise information
2. Automating form submissions and interactive web actions
...
```

**Production (OpenAI Agents SDK code-side):**
```python
Agent(
    name="greeting_agent",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant. Greet the user warmly.",
)
```

**Key insight (Anthropic):** Identity must include what the agent does, what it excels at, and implicit scope boundaries. Google ADK defines identity as: `name + instructions + tools` — the triple that constitutes an agent blueprint.

---

### 3.2 Tools Awareness

**Google ADK** treats tools as a first-class part of the agent definition (passed at construction time). Agent instructions should describe *when* to use each tool, not just *that* tools exist.

**browser-use `<efficiency_guidelines>`** categorizes actions by side-effect risk:
```
Page-changing (always last): navigate, search, go_back, switch, evaluate
Potentially page-changing: click (on links/buttons that navigate)
Safe to chain: input, scroll, find_text, extract, search_page, find_elements
```

**Anthropic (Appendix 2: "Prompt Engineering Your Tools"):**
> Tool definitions and specifications should be given just as much prompt engineering attention as your overall prompts. There are often several ways to specify the same information, and we should think about which formats are easiest for the model to use.

**Key insight:** Tool docs are as critical as agent instructions. Each tool entry should have: name, description of *when* to use it (not just *what* it does), parameter semantics, and side-effect classification.

---

### 3.3 Step Protocols (The Agent Loop)

**browser-use** mandates a structured per-step output:
```json
{
  "thinking":              "systematic reasoning applying all rules",
  "evaluation_previous_goal": "Success|Failure|Uncertain — one sentence",
  "memory":                "1-3 sentences of progress state",
  "next_goal":             "one clear sentence: next immediate goal",
  "current_plan_item":     0,
  "plan_update":           ["optional revised plan items"],
  "action":                [{"action_name": {...params}}]
}
```

This enforces: **reflect → evaluate → remember → plan → act** — never just act.

**OpenAI Codex AGENTS.md** enforces tool usage patterns across the whole session:
```
- Run just fmt after all code changes, no approval needed
- Run tests for specific project changed, not the full suite by default
- Run just fix before finalizing large changes
```

**Anthropic principle:**
> Maintain simplicity in your agent's design. Prioritize transparency by explicitly showing the agent's planning steps.

---

### 3.4 Output Formats

Three dominant patterns:

| Pattern | When to use | Example |
|---------|-------------|---------|
| **Strict JSON schema** | Autonomous agents with structured action spaces | browser-use JSON envelope |
| **Structured prose with XML tags** | Long-form reasoning agents | `<thinking>`, `<answer>`, `<plan>` |
| **Code-side typed output** | SDK-level agents | OpenAI `Agent(output_type=MyPydanticModel)` |

**browser-use** enforces: `Action list should NEVER be empty.` — a critical completeness guardrail baked into the format spec itself.

---

### 3.5 Guardrails

**OpenAI SDK** defines guardrails as a separate structural component:
```python
# Guardrails run in parallel with the agent, not inside the agent prompt
Agent(
    instructions="...",
    guardrails=[input_guardrail, output_guardrail]
)
```

**browser-use** inlines guardrails into operating rules:
```
- Never repeat the same failing action more than 2-3 times
- If blocked by login/403, try alternative approaches — never retry blindly
- CAPTCHAs are solved automatically — do NOT attempt manual solve
- If at 75% step budget, shift strategy to consolidate partial results
```

**Anthropic (Parallelization pattern):**
> Implementing guardrails where one model instance processes user queries while another screens them for inappropriate content. This tends to perform better than having the same LLM call handle both guardrails and the core response.

**Key insight:** Inline guardrails work for simple agents; parallel guardrail agents scale better for production. Both require explicit "when to escalate vs. self-recover" logic.

---

### 3.6 Error Handling

**browser-use** `<error_recovery>` (8-step explicit procedure):
```
1. Verify current state using screenshot as ground truth
2. Check if popup/modal/overlay is blocking interaction
3. If element not found, scroll to reveal more content
4. If action fails repeatedly (2-3 times), try alternative approach
5. If blocked by login/403, consider alternative sites or search engines
6. If page structure is different than expected, re-analyze and adapt
7. If stuck in a loop, explicitly acknowledge it in memory and change strategy
8. If max_steps approaching, prioritize completing most important parts
```

**OpenAI Codex AGENTS.md (loop detection):**
```
Detect and break out of unproductive loops: if you are on the same URL 
for 3+ steps without meaningful progress, or the same action fails 2-3 
times, try a different approach. Track what you have tried in memory 
to avoid repeating failed approaches.
```

**Anthropic principle:**
> It's crucial for agents to gain "ground truth" from the environment at each step (tool call results, code execution) to assess progress. Agents can pause for human feedback at checkpoints or blockers.

---

### 3.7 Planning Protocols

**browser-use** introduces a **complexity-gated planning rule**:
```
Simple task (1-3 actions): Act directly. Do NOT output plan_update.
Complex but clear task: Output plan_update immediately with 3-10 items.
Complex and unclear task: Explore first, then plan once you understand.
```

**OpenAI Codex AGENTS.md** externalizes planning to filesystem:
```
- todo.md: Use for checklist of known subtasks
- results.md: Use to accumulate results on long tasks
- Do NOT use the file system if task is <10 steps
```

**Anthropic:** Recommends choosing the right workflow pattern before writing instructions — prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer — each implies different planning structures.

---

## 4. Minimal vs. Production Agent Definitions

### 4.1 Minimal (1-liner anti-pattern)
```python
Agent(instruction="You are a helpful coding assistant.")
```
Problems:
- No tool semantics → model improvises usage
- No output format → unpredictable structure
- No error policy → model halts or hallucinates on failure
- No identity boundary → scope creep
- No step protocol → no reflection, no progress tracking

### 4.2 The Google ADK Minimal-but-Complete Pattern
```python
Agent(
    name="greeting_agent",        # identity: role name
    model="gemini-2.5-flash",     # capability contract
    instruction="You are a helpful assistant. Greet the user warmly.",
)
```
Appropriate for single-turn, tool-free, low-stakes agents. The key: it's minimal *because the task is minimal*, not because of laziness.

### 4.3 Production Multi-Step Agent (browser-use pattern)
~800 tokens of system prompt covering all 10 sections. Justified because:
- Agent operates autonomously for 50-100 steps
- Actions have real-world side effects (form submission, navigation)
- Errors compound across steps
- Output must be machine-parseable for action execution

### 4.4 Repo-Level Coding Agent (AGENTS.md pattern — Codex/Goose)
Separate from the system prompt. Contains:
- Project architecture overview + pointers to deeper skill docs
- Code style rules (language-specific)
- Tool/command procedures (when to run tests, formatters, linters)
- Sandbox constraints and limitations
- Architecture invariants (never do X, always do Y before finalizing)

---

## 5. Distilled Best Practices (Prioritized)

### P0 — Foundation
1. **Always specify an identity** with role + domain + what the agent excels at. One paragraph, not one line.
2. **Enumerate tools with usage guidance**, not just names. Include: when to use, when NOT to use, side-effect class.
3. **Mandate a step protocol**: think → evaluate last action → update memory → set next goal → act. Never jump to action.

### P1 — Structure
4. **Use XML tags or clear section headers** for long system prompts. Improves model section-finding and reduces instruction blending.
5. **Define output format explicitly**. If the agent produces structured output, provide a schema with field-level commentary.
6. **Separate task completion from task progress**. A dedicated "done" action or done-condition block prevents premature termination and over-running.

### P2 — Robustness
7. **Inline error recovery steps** (not just "handle errors"). Specify: max retries per action type, fallback strategies, when to escalate vs. self-recover.
8. **Add loop detection instructions** explicitly. Agents without them will retry indefinitely.
9. **Budget-aware behavior**: define what to do when approaching step/token limits (consolidate, deliver partial results, don't just fail).
10. **Complexity-gated planning**: instruct the agent to plan only when task complexity warrants it, and to revise the plan only when unexpected obstacles arise.

### P3 — Quality
11. **Provide examples** for all output patterns (not just format, but examples of good memory entries, evaluation statements, etc.).
12. **End with a "Critical Reminders" block**: 8-12 imperative bullets of the most important constraints. These serve as "last read" before acting.
13. **Separate guardrails from core instructions** when possible — either via parallel guardrail agents (Anthropic) or code-side validator layers (OpenAI SDK).
14. **Treat tool documentation with the same rigor as agent instructions** (Anthropic Appendix 2 principle).

---

## 6. Anti-Patterns to Avoid

| Anti-pattern | Why it fails |
|---|---|
| Identity in one sentence | No role boundary, scope creep, confused handoff targets |
| Tool list without usage guidance | Model improvises tool calls, bypasses safety constraints |
| No step protocol | No reflection → compounding errors with no self-correction |
| No done/completion criteria | Agent over-runs or terminates prematurely |
| Guardrails only in instructions | Instructions get overridden by context; guardrails need structural separation |
| No error recovery policy | First failure halts agent or triggers infinite retry |
| No output format spec | Unparseable output breaks downstream consumers |
| Monolithic instruction wall | No section structure → model loses track of rules in long prompts |
| Planning always OR planning never | Fixed planning is wasteful for simple tasks; no planning breaks complex tasks |
| `AGENTS.md` as free-form notes | Needs: architecture pointer, tool procedures, invariants, and style rules |

---

## 7. AGENTS.md / Repo-Level Agent Definition Patterns

Based on OpenAI Codex `AGENTS.md` and Google ADK `AGENTS.md`:

### Mandatory sections for a repo-level agent definition file:

```markdown
## Project Overview
Brief description + pointers to architecture skill/doc (not inline docs)

## Key Components
Bulleted list: Agent | Runner | Tool | Session | Memory | Workflow

## Code Style Rules
Language-specific rules, link to style guide, linter conventions

## Tool/Command Procedures  
Which commands to run when (fmt, test, lint, build) + scope rules

## Architecture Invariants
"Never do X" and "Always do Y before Z" rules that protect core integrity

## Sandbox Constraints (if applicable)
Network access, file system limits, environment variables that affect behavior

## Skills / Documentation Pointers
Point to deeper skill docs rather than inlining long methodology text
```

### Key distinction:
- **Don't inline long reference material** into AGENTS.md — point to skill docs
- **Don't duplicate** what's in the skill system; use AGENTS.md as an index + invariants file
- **Keep AGENTS.md compact** so agents read it fully rather than skimming

---

## 8. Contrast Table: Minimal → Production

| Dimension | Minimal (toy) | Intermediate | Production |
|---|---|---|---|
| Identity | 1 line | Role + domain | Role + domain + capabilities + scope |
| Tools | Not mentioned | Listed | Listed + usage policy + side-effect class |
| Step protocol | None | Think-then-act | Evaluate → Memory → Goal → Plan? → Act |
| Output format | None | Described | Full JSON schema with field docs |
| Planning | Always or never | Simple heuristic | Complexity-gated with plan revision policy |
| Error handling | None | "Handle errors" | 8-step recovery procedure + loop detection |
| Guardrails | None | Inline warnings | Parallel agents or code-side validators |
| Completion | None | "Say done when finished" | done action + pre-done verification checklist |
| Budget awareness | None | None | Explicit 75%/100% strategy shifts |
| Examples | None | 1-2 format examples | Examples for every output field pattern |

---

## 9. Key Research Sources

| Source | Type | Key Contribution |
|---|---|---|
| [browser-use system_prompt.md](https://github.com/browser-use/browser-use/blob/main/browser_use/agent/system_prompts/system_prompt.md) | Production system prompt | Complete 10-section template; loop detection; pre-done verification |
| [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | Research + guidelines | Simplicity principle; ACI (agent-computer interface); workflow taxonomy |
| [OpenAI Agents SDK README](https://github.com/openai/openai-agents-python) | SDK documentation | Agent = instructions + tools + guardrails + handoffs (typed definition) |
| [OpenAI Codex AGENTS.md](https://github.com/openai/codex/blob/main/AGENTS.md) | Repo agent definition | Code style rules; tool procedures; architecture invariants; sandbox constraints |
| [Google ADK AGENTS.md + README](https://github.com/google/adk-python) | Framework + repo definition | Agent blueprint: identity + instructions + tools; skill-based architecture docs |
| [Anthropic Cookbook patterns/agents](https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents) | Reference implementations | Orchestrator-workers, evaluator-optimizer, async multi-agent patterns |
