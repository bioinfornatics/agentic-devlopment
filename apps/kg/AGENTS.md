# AGENTS.md — apps/kg (@harness/kg)

> Overrides root AGENTS.md for this directory. Language: TypeScript + Node 22.

## Setup

```bash
pnpm install    # install devDependencies (typescript, @types/node)
pnpm build      # tsc → dist/
```

## Commands

```bash
node dist/cli.js bootstrap            # scan harness → .knowledge/memory.jsonl
node dist/cli.js bootstrap --dry-run  # preview without writing
node dist/cli.js reason               # forward chaining → .knowledge/derived.jsonl
node dist/cli.js reason --rules       # list active rules
node dist/cli.js pipeline             # bootstrap + reason
node dist/cli.js visualize            # open dist/kg/index.html
```

## Code style

- TypeScript strict mode, NodeNext module resolution
- All types in `src/types.ts` (Entity, Relation, KG, makeRel, makeStatus)
- No external runtime dependencies (only devDependencies)
- Each rule in `src/reason.ts` typed as `Rule = (kg: KG, rs: Set<string>) => Relation[]`

## Adding a reasoning rule

1. Add `const RN: Rule = ...` in `src/reason.ts`
2. Append to `export const RULES` array with `{ name: "RN:description", fn: RN }`
3. Run `pnpm build && node dist/cli.js reason --rules` to verify

## File locations

```
src/types.ts      # Shared types — Entity, Relation, KG, makeRel, makeStatus
src/bootstrap.ts  # Scan .agents/, .goose/recipes/, docs/ → memory.jsonl
src/reason.ts     # 5 forward-chaining rules + RULES export
src/cli.ts        # CLI entry: bootstrap|reason|pipeline|visualize|rules
dist/cli.js       # Built binary (shebang added post-build)
```

## Test

```bash
pnpm test                              # vitest run — all unit tests
pnpm test:watch                        # vitest watch mode during development
node dist/cli.js bootstrap --dry-run   # smoke test: Dry-run: N records
node dist/cli.js pipeline              # integration: Bootstrap + Derived facts
```