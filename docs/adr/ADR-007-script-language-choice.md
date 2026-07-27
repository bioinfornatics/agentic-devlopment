# ADR-007: Script Language Choice (Shell vs Python vs TypeScript)

**Status**: Accepted  
**Date**: 2026-07-26  
**Context**: Choosing the right language for different script contexts in the loop engineering pack.

## Decision

Use **the right tool for the context**:

| Context | Language | Rationale |
|---------|----------|-----------|
| Goose plugin hooks | **Shell** | Only supported format, minimal overhead |
| CI/pre-commit validation | **Python** | Rich stdlib, no compile step, universal |
| Complex data processing | **TypeScript** | Type safety, when running in Goose session |
| One-off automation | **Shell** | Simplest, most portable |

## Constraints

### 1. Goose Hooks (Shell required)

```json
// hooks.json - ONLY supports shell commands
{
  "type": "command",
  "command": "${PLUGIN_ROOT}/scripts/some-script.sh"
}
```

Hooks are invoked as external processes by the Goose runtime. They:
- Receive JSON payload on stdin
- Must emit JSON decision on stdout
- Have strict timeouts (5-10s)
- Run outside the TypeScript sandbox

**TypeScript is NOT an option here** without modifying Goose core.

### 2. execute_typescript Limitations

```typescript
// execute_typescript runs in a Deno sandbox
async function run() {
  // ✅ Can call SDK functions
  const result = await Developer.shell({ command: "ls" });
  
  // ❌ Cannot access filesystem directly
  // const fs = require('fs');  // NOT AVAILABLE
  // Deno.readFile(...)         // NOT AVAILABLE
  
  // ❌ Cannot make HTTP requests directly
  // fetch(...)                  // NOT AVAILABLE
}
```

The TypeScript sandbox only exposes registered SDK functions. It cannot:
- Read/write files directly (must use `Developer.shell` or `Developer.write`)
- Make network requests (no `fetch`)
- Access environment variables directly
- Spawn child processes

### 3. CI/Pre-commit Context

Scripts like `check-consistency.py` run:
- In CI pipelines (GitHub Actions, GitLab CI)
- In pre-commit hooks
- On developer machines

Requirements:
- No Goose session needed
- Fast startup
- Minimal dependencies

**Python wins** here:
- Universal availability
- Rich standard library (json, yaml, pathlib)
- No compile/transpile step
- Works in any CI environment

### 4. TypeScript Advantages (when applicable)

TypeScript excels when:
- Running inside a Goose session
- Complex data transformations needed
- Type safety matters
- Reusing existing TypeScript codebase

## Migration Path: Shell Trampoline Pattern

**Implemented in loop-breaker v2.2.0**

The shell script acts as a minimal "trampoline" that detects available TypeScript runtimes and delegates to the TypeScript implementation:

```bash
#!/usr/bin/env sh
# Shell trampoline - detects TS runtime and delegates

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TS_SCRIPT="$SCRIPT_DIR/count-failures.ts"

# Runtime detection order: bun > deno > tsx > npx tsx
if command -v bun >/dev/null 2>&1; then
  exec bun run "$TS_SCRIPT"
elif command -v deno >/dev/null 2>&1; then
  exec deno run --allow-read --allow-write "$TS_SCRIPT"
fi

# Fallback: embedded shell implementation
# ... minimal shell logic for environments without TS runtime
```

### Benefits

1. **TypeScript for logic** — Type safety, better maintainability
2. **Shell for compatibility** — Works with Goose hooks system
3. **Graceful fallback** — Pure shell implementation if no TS runtime
4. **Zero build step** — bun/deno run TypeScript directly

### Runtime Detection Chain (v2.4)

Simplified to runtimes that can compile to standalone binaries:

| Priority | Check | Command |
|----------|-------|---------|
| 1 | pre-compiled binary | `./bin/loop-breaker` |
| 2 | `bun` + deps installed | `bun run src/index.ts` |
| 3 | `deno` | `deno run --allow-* src/index.ts` |
| 4 | none | Embedded shell fallback |

```bash
# 1. Pre-compiled binary (fastest)
if [ -x "$BIN" ]; then
  "$BIN"
fi

# 2. Bun with installed dependencies
if command -v bun && [ -d "$PLUGIN_ROOT/node_modules" ]; then
  bun run "$TS_SCRIPT"
fi

# 3. Deno (no deps needed, imports from URL)
if command -v deno; then
  deno run --allow-read --allow-write --allow-env "$TS_SCRIPT"
fi

# 4. Shell fallback
```

### Compilation to Standalone Binary

Both bun and deno support compiling TypeScript to a standalone executable:

```bash
# Bun (recommended - smaller output)
bun build ./src/index.ts --compile --outfile ./bin/loop-breaker

# Deno
deno compile --allow-read --allow-write --allow-env --output ./bin/loop-breaker ./src/index.ts
```

This produces a single binary with all dependencies bundled, eliminating runtime requirements.

### SQLite for Persistent State

Plugins that need persistent state across sessions use SQLite with Drizzle ORM:

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const errorPatterns = sqliteTable("error_patterns", {
  id: integer("id").primaryKey(),
  signature: text("signature").notNull().unique(),
  tool: text("tool").notNull(),
  correction: text("correction").notNull(),
  useCount: integer("use_count").default(0),
});
```

Database is stored in `$PLUGIN_ROOT/data/` and compiled into the binary.

## Consequences

### Positive
- Each script uses the most appropriate language
- Minimal dependencies in CI
- Hooks remain fast and reliable
- Python scripts work everywhere

### Negative
- Multiple languages to maintain
- Developers need Python + Shell knowledge
- No unified type system across scripts

### Neutral
- TypeScript available for in-session complex logic via `execute_typescript`
- Can migrate individual scripts to TypeScript if Goose adds native support

## Related Decisions

- ADR-001: Loop Engineering Architecture
- ADR-006: Plugin System Design

## Future Considerations

If Goose adds `type: "typescript"` hook support:
- Migrate hooks to TypeScript
- Keep Python for CI-only scripts
- Document the SDK function limitations
