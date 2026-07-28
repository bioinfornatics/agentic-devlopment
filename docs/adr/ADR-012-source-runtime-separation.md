# ADR-012: Separate harness source from project runtime projection

- Status: Accepted for migration
- Decision: 2026-07-28

## Context

The repository currently develops agents, skills, recipes and plugins directly inside project-root `.agents` and `.goose`. Those paths are also the runtime discovery surface used by Goose. This conflates editable source, resolved third-party inputs, compiled app outputs, installed runtime state and release bytes.

## Decision

Canonical development source moves to `src/agents`, `src/skills`, `src/recipes`, `src/plugins` and `src/app`. Internal skills only live under `src/skills`; external skills are declared in the external lock and resolved into build staging. Applications live in `src/app/<name>` and declare package outputs through `app-package.json`; an app can emit a companion skill binary, plugin binary or standalone artifact without placing app source inside runtime packages.

The functional project runtime is generated under `build/harness/runtime/releases/<digest>`. `build/harness/runtime/current` is switched atomically. Project-root `.agents` and `.goose` are runtime projections pointing to the active generated release; they contain no canonical editable source. A clean clone must run the documented bootstrap target before harness skills are available.

Source tooling reads the machine-readable layout contract and canonical `src` roots. Runtime and evaluation tooling receives an explicit runtime root/digest. Editing generated runtime files is an error; changes must be made under `src` and rebuilt.

## Consequences

Source ownership is unambiguous and release assembly no longer treats the development runtime as source. External content cannot be silently committed as internal. App compilation is reusable across skill and plugin packaging. The migration must preserve history with Git moves and maintain a rollback path until fresh-clone discovery is proven.
