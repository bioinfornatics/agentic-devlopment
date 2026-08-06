# ADR-007: Script language and command interface

- Status: Accepted
- Decision: 2026-07-26

## Context

Automation needs one maintainable implementation language while Goose hooks and
host startup still require process-level entrypoints. Contributors also need a
stable command interface independent of implementation files.

## Decision

TypeScript is the language for repository automation logic, validation,
transformation, packaging, and runtime management.

Short POSIX shell scripts are permitted only for Goose hooks and system
launchers. They validate or forward process input and immediately invoke the
owned implementation; business logic does not live in shell.

The root `justfile` is the public command interface. Documentation and CI invoke
`just <recipe>` rather than implementation files, so internal tooling can change
without changing operator commands.

## Consequences

- Logic is typed, tested with Vitest, and packaged from `src/app/**`.
- Hook and launcher wrappers remain small and portable.
- Public operations are discoverable with `just --list`.
- Additional scripting runtimes are not part of the supported toolchain.
