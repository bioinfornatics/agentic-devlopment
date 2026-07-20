# Concept: Layers

The harness uses a **three-layer architecture**. Each layer adds value on top of the one below.

```mermaid
flowchart TD
    subgraph "Layer 3: RECIPES"
        R["dev, sdd, review, implement..."]
    end
    
    subgraph "Layer 2: AGENTS"
        A["architect, reviewer, implementer..."]
    end
    
    subgraph "Layer 1: SKILLS"
        S["sdd, beads, code-review..."]
    end
    
    subgraph "Layer 0: GOOSE"
        G["Runtime + Extensions"]
    end
    
    R --> A
    A --> S
    S --> G
    
    style R fill:#c8e6c9
    style A fill:#e3f2fd
    style S fill:#fff9c4
    style G fill:#f5f5f5
```

## What Each Layer Does

| Layer | Contains | Purpose |
|-------|----------|---------|
| **Skills** | Methodology text | Inject expertise (how to review, how to design) |
| **Agents** | Persona + skills | Specialist identity (reviewer, architect) |
| **Recipes** | Workflow + agents | Orchestration (which agents, in what order) |

## Example: Code Review

```mermaid
flowchart LR
    subgraph "Recipe: review"
        direction TB
        R1["Load skills"]
        R2["Load agent"]
        R3["Run workflow"]
    end
    
    subgraph "Agent: review-critic"
        direction TB
        A1["Persona: critical reviewer"]
        A2["Skills: code-review, beads"]
    end
    
    subgraph "Skill: code-review"
        S1["Review methodology"]
        S2["Severity definitions"]
        S3["Checklist"]
    end
    
    R1 --> A2
    R2 --> A1
    A2 --> S1
```

When you run `/review`:
1. Recipe loads the `code-review` skill
2. Recipe loads the `review-critic` agent
3. Agent uses skill methodology to review code
4. Recipe structures the output

## Layer Delta

Each layer should add **measurable value** over the one below:

```
Recipe alone      vs  Recipe + Agents        → Better quality?
Agent + Skills    vs  Skills alone           → Better judgment?
Skills alone      vs  Nothing                → Better methodology?
```

This is how we evaluate if a layer is worth keeping.

## When to Use What

| Situation | Use |
|-----------|-----|
| Quick task, no special expertise | Just Goose (Layer 0) |
| Need specific methodology | Load a skill (Layer 1) |
| Need consistent persona | Load an agent (Layer 2) |
| Need orchestrated workflow | Run a recipe (Layer 3) |

## Practical Access

```bash
# Layer 3: Run a recipe
goose run dev

# Layer 2: Load an agent directly
load agent architect

# Layer 1: Load a skill directly  
load skills code-review

# Layer 0: Just talk to Goose
goose session
```

---

**See also:** [SDD Loop](sdd-loop.md) · [Beads Workflow](beads-workflow.md)
