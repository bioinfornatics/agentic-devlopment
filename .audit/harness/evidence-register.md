# Evidence register

- Repository: `.`
- Revision: `2ab4bc987eb24fd153e50e0b5b39c1a4274d9e5e`
- Execution mode: AUDIT_ONLY
- Output directory authorization: user requested `.audit/harness`; audit artifacts only were written under this path.
- Git status at precondition time: tracked source had pre-existing modifications; this audit did not remediate tracked source.

## Command evidence

| Artifact | Purpose |
|---|---|
| `.audit/harness/command-outputs/check-consistency.txt` | check consistency.txt |
| `.audit/harness/command-outputs/external-sources.txt` | external sources.txt |
| `.audit/harness/command-outputs/inventory-files.txt` | inventory files.txt |
| `.audit/harness/command-outputs/kg-smoke.txt` | kg smoke.txt |
| `.audit/harness/command-outputs/preconditions-paths.txt` | preconditions paths.txt |
| `.audit/harness/command-outputs/recipe-validate.txt` | recipe validate.txt |
| `.audit/harness/command-outputs/spec-deviations.txt` | spec deviations.txt |
| `.audit/harness/command-outputs/spec-kit-local.txt` | spec kit local.txt |
| `.audit/harness/command-outputs/static-extract.json` | static extract.json |

## Key deterministic results

- `goose recipe validate` passed for all 29 top-level/subrecipe YAML files (see `command-outputs/recipe-validate.txt`).
- `python3 scripts/check-consistency.py` exited 0 (see `command-outputs/check-consistency.txt`).
- KG smoke: bootstrap dry-run reported 96 records and reason rules listed R1-R6 (see `command-outputs/kg-smoke.txt`).
- SPEC_DEVIATION scan clean: 0 active markers, 7 classified examples (see `command-outputs/spec-deviations.txt`).
- Required Microsoft SDD URLs returned HTTP 200 headers (see `command-outputs/external-sources.txt`).
