# Harness root rewrite announcement

The root changes from a mixed source/install tree to a source-only repository with reproducible content-addressed harness releases. Generated node_modules, dist, Vite caches, runtime DBs, and eval run artifacts are removed from Git tracking. Eval Hub remains source tooling but is outside release archives.

Before publication maintainers must create and verify `pre-harness-rewrite-2026-07`, protect main, run a fresh-clone build/release/install/evaluate, and obtain explicit human approval. Consumers install a release rather than copy source directories. Rollback uses the backup tag and a reviewed normal commit. No force-push is authorized by this announcement.
