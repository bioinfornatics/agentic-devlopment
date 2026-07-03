# 03 — Security Review

Run a security-focused review of code, design, configuration, dependencies, or release flow.

## User scenario

> "Threat model this feature and review the diff for security issues."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-review \
  --params task="security review current diff and design" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Prioritize authn/authz, injection, secrets, unsafe IO, dependency risk, data loss, and supply chain."
```

### Method B — slash command in an interactive Goose session

```text
/review security review current diff and design; prioritize authn/authz, injection, secrets, unsafe IO, dependency risk, data loss, and supply chain
```

Slash commands accept one free-text argument, so security scope should be written directly in the prompt text.

## Recommended command

```bash
goose run --recipe harness-review   --params task="security review current diff and design"   --params repo_path="$PWD"   --params constraints="Read-only. Prioritize authn/authz, injection, secrets, unsafe IO, dependency risk, data loss, and supply chain."
```

## When to use

- Authentication/authorization changes.
- File, shell, network, or deserialization code.
- CI/CD, release, or secrets handling.
- Database migrations or multi-tenant data paths.
- New MCP/extension/tool integration.

## Threat model checklist

| Area | Questions |
|---|---|
| Assets | What data/secrets/capabilities are exposed? |
| Entry points | Which inputs cross trust boundaries? |
| Authn/authz | Who can do what? Are checks centralized and tested? |
| Injection | SQL, shell, path traversal, template, command, prompt injection? |
| Secrets | Are tokens logged, committed, echoed, or passed to subagents? |
| Dependencies | New packages? Install scripts? MCP server trust? |
| Data integrity | Can data be corrupted, lost, replayed, or raced? |
| Observability | Are failures detectable without leaking secrets? |

## Beads outputs

For every real issue found, create or propose a Bead:

```bash
bd create "Security: validate path traversal in upload handler"   -t bug -p 1   --deps discovered-from:<parent-id>   --json
```

If a human decision is required:

```bash
bd gate create --blocks <issue> --type human --reason "Security tradeoff requires owner approval"
```

## Output format

```text
Security verdict: pass | needs-hardening | block
Threat model summary:
Findings by severity:
Required tests:
Follow-up beads:
Residual risk accepted by whom:
```

## Done criteria

- No high/critical issue lacks a Beads follow-up.
- Tests or validation steps exist for security-sensitive behavior.
- Secrets and MCP extension risks are explicitly addressed.
