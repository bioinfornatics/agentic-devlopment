# Agentic Development Harness

```mermaid
flowchart LR
    YOU((You)) --> DEV["/dev"]
    DEV --> |"build"| BUILD[Implement]
    DEV --> |"review"| CHECK[Review]
    DEV --> |"explore"| EXPLORE[Explore]
    
    BUILD --> CODE["Code + Tests"]
    CHECK --> VERDICT["Approve/Block"]
    EXPLORE --> INSIGHT["Understanding"]
    
    style YOU fill:#fff3e0,stroke:#ff9800
    style DEV fill:#e3f2fd,stroke:#2196f3
    style CODE fill:#c8e6c9,stroke:#4caf50
    style VERDICT fill:#c8e6c9,stroke:#4caf50
    style INSIGHT fill:#c8e6c9,stroke:#4caf50
```

## Install

```bash
./scripts/install.sh
```

## Use

```bash
goose run dev
```

Describe what you want. The system handles the rest.

---

## Want More Control?

| I want to...     | Command                |
|------------------|------------------------|
| Build a feature  | `/dev` or `/implement` |
| Write a spec     | `/spec`                |
| Plan tasks       | `/plan`                |
| Review code      | `/review`              |
| Explore codebase | `/explore`             |

---

📖 **[Tutorials](tutorials/)** — Learn by doing  
📚 **[Reference](reference/)** — Detailed documentation  
🔧 **[Internal](internal/)** — For contributors
