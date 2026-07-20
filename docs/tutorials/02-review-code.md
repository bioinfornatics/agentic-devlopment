# Tutorial: Review Code

```mermaid
flowchart LR
    CODE["Your Code"] --> REVIEW["/review"]
    REVIEW --> ANALYZE["Analyze"]
    ANALYZE --> VERDICT{Verdict}
    VERDICT --> |"✅"| APPROVE["APPROVE"]
    VERDICT --> |"⚠️"| NITS["PASS-WITH-NITS"]
    VERDICT --> |"❌"| BLOCK["BLOCK"]
    
    style CODE fill:#fff3e0,stroke:#ff9800
    style REVIEW fill:#e3f2fd,stroke:#2196f3
    style APPROVE fill:#c8e6c9,stroke:#4caf50
    style NITS fill:#fff9c4,stroke:#fbc02d
    style BLOCK fill:#ffcdd2,stroke:#f44336
```

## Step 1: Start Review

```bash
goose run review
```

Or in an existing session:
```
/review
```

## Step 2: Specify What to Review

```
> Review the authentication module I just added
```

Or be specific:
```
> Review src/auth/*.ts against the spec in .specs/features/auth/spec.md
```

## Step 3: Understand the Verdict

```mermaid
flowchart TD
    subgraph "Review Checks"
        A["Code Quality"] 
        B["Test Coverage"]
        C["Spec Compliance"]
        D["Security"]
        E["Beads Hygiene"]
    end
    
    A --> V{Verdict}
    B --> V
    C --> V
    D --> V
    E --> V
```

| Verdict | Meaning | Action |
|---------|---------|--------|
| **APPROVE** | Ready to merge | Proceed |
| **PASS-WITH-NITS** | Minor issues | Fix or ignore |
| **BLOCK** | Serious issues | Must fix |

## Step 4: Address Findings

Each finding includes:
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Location:** File and line
- **Issue:** What's wrong
- **Suggestion:** How to fix

## Review Scopes

| Scope | Command | What's checked |
|-------|---------|----------------|
| Code only | `/review scope=code` | Logic, style, tests |
| Docs only | `/review scope=docs` | Documentation quality |
| Full | `/review scope=full` | Everything |

---

**Next:** [Explore Codebase →](03-explore-codebase.md)
