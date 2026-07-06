# Global / Architecture Review

**When to use:** full codebase audit, architecture assessment, pattern consistency, technical debt mapping.
**Exploration budget:** entry points first, expand 1 level. **At most 15 files.** Sample — do not scan everything.

## Exploration strategy (sample and expand)
1. Run `analyze` on the root directory (depth 3) for structure overview
2. Identify entry points: `main.*`, `index.*`, `app.*`, key config files
3. Read entry points + their immediate dependencies (1 level deep)
4. Stop at 15 files. Defer unread modules to recommended follow-ups.

## Review dimensions (in order)
1. **Architecture coherence** — Does the structure match a recognizable pattern? Is it consistent?
2. **Coupling** — Do modules depend on internals of others? Are boundaries clear?
3. **Modularity** — Single responsibility? High cohesion per module?
4. **Test coverage** — Is there a test strategy? Are critical paths covered?
5. **Technical debt** — Naming inconsistencies, dead code, TODO comments, deprecated patterns.
6. **Scalability risk** — What breaks first at 10× load?

## Red flags (name when found)
- **Big Ball of Mud**: no clear structure, everything depends on everything
- **God Object**: one class/module does everything
- **Tight Coupling**: components depend on internal state of others
- **Speculative Abstraction**: layers added for future requirements that don't exist
- **Magic**: undocumented behavior that "just works"
- **Inconsistent patterns**: same problem solved N different ways across modules

## Output additions for global review
```markdown
## Architecture assessment
[Current style, consistency, major concerns]

## Technical debt map
| Area | Debt type | Severity | Suggested action |
| ---- | --------- | -------- | ---------------- |

## Top 3 risks
[Ranked by blast radius if unaddressed]
```

## Gotchas specific to global review
- Do not flag naming inconsistency without checking if it is intentional (legacy vs new).
- "Could be cleaner" is not a finding — flag only structural risks with concrete maintenance consequences.
- Large file count ≠ problem. Large coupling count = problem. Distinguish them.
