# Source/runtime separation migration

## Canonical development tree

- `src/agents`: authored agent definitions.
- `src/skills`: authored internal skills only.
- `src/recipes`: authored Goose recipe YAML.
- `src/plugins`: runtime plugin descriptors, hooks, wrappers and tests.
- `src/app`: application sources with package descriptors.

External skills are never copied into `src/skills`; they are pinned in `harness/external-skills.lock.json` and resolved during projection.

## Functional runtime

```bash
make bootstrap-runtime
make verify-runtime
```

This creates content-addressed releases below `build/harness/runtime/releases`, atomically activates `current`, and creates root `.agents` and `.goose` symlinks. Do not edit those paths. Edit `src`, then rebuild.

Rollback and cleanup:

```bash
make rollback-runtime
make clean-runtime
```

Rollback atomically selects the previous verified projection. Cleanup retains current and previous releases.

## Fresh clone

```bash
git clone git@github.com:bioinfornatics/agentic-devlopment.git
cd agentic-devlopment
pnpm --dir src/app install --frozen-lockfile
make bootstrap-runtime
goose skills list
python3 scripts/check-consistency.py
```

Bootstrap needs network access for locked external repositories unless a verified external cache is supplied. Published release installation remains offline.

## Application packaging

`src/app/eval-hub/companion.Makefile` emits the optional Eval Hub companion skill and Bun binary. `src/app/loop-breaker` emits the binary projected into `src/plugins/loop-breaker`. Application source is never copied into runtime skill or plugin packages.

## Troubleshooting

- `runtime drift`: rollback or discard the mutated projection, then rebuild from `src`.
- `integrity mismatch`: verify the external commit, path and license; never update a digest blindly.
- missing `.agents` or `.goose`: run `make bootstrap-runtime`.
- unavailable Bun: install pinned Bun; no source fallback is published.

## Repository rollback

The pre-migration tag is `pre-harness-rewrite-2026-07`. Restore it only through a reviewed branch and pull request. Runtime rollback changes only the active generated projection and does not rewrite Git.
