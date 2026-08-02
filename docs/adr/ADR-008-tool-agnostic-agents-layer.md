# ADR-008: Tool-agnostic agents layer

- Status: Superseded by ADR-012
- Decision: 2026-07-27

## Historical context

This decision introduced a shared `.agents/` discovery layer so agents, skills,
and plugins could be named independently of a single client. It treated that
project-root layer as canonical authoring content and retained Goose-specific
recipes separately.

ADR-012 replaced the source-location part of this decision. Names remain
tool-agnostic, but editable assets now live under `src/`; project-root discovery
paths are generated runtime projections. ADR-012 is authoritative for ownership,
layout, packaging, and runtime activation.
