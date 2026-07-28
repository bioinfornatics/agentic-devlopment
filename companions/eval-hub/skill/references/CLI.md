# Eval Hub companion CLI

Bounded probes: `scripts/eval-hub --help` and `scripts/eval-hub --companion-self-check`. The self-check emits schema `eval-hub-companion-self-check-v1`, embedded runtime/version, and `operationalModeStarted: false`.

Operational modes include `--run`, `--report`, `--export-history`, `--server`, and `--tui`. Prefer `scripts/evaluate-harness-release.py` for layered runs because it binds output to harness release, lock, and Goose digests. The launcher propagates exit codes and performs no download, installation, or compilation.
