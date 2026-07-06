# Security Audit

**When to use:** auth/authz changes, input handling, payments, secrets, CVE context, API endpoints, file uploads.
**Exploration budget:** targeted by risk surface. Read in order: auth → input → data access → deps. **At most 10 files.**

## Risk surface scan order
1. Authentication and session code
2. Input validation (forms, API params, file uploads)
3. Database queries and data access layer
4. Secret/credential handling
5. Dependency manifest (package.json, requirements.txt, go.mod)

## OWASP Top 10 checklist (apply only to relevant changed code)

| # | Category | Check |
|---|---|---|
| A01 | Broken Access Control | Auth check on every route? CORS configured? |
| A02 | Cryptographic Failures | Passwords hashed (bcrypt/argon2)? TLS enforced? PII encrypted? |
| A03 | Injection | Queries parameterized? User input sanitized? ORMs used safely? |
| A05 | Security Misconfiguration | Debug off in prod? Default creds changed? Security headers set? |
| A06 | Vulnerable Components | npm audit clean? Known CVEs in changed deps? |
| A07 | Auth/Session Failures | JWT validated server-side? Sessions expire? |
| A10 | SSRF | User-provided URLs whitelisted? Internal services protected? |

## Immediate CRITICAL patterns (always flag, no confidence gate needed)
- Hardcoded credentials, API keys, or tokens in source
- Parameterized queries NOT used: raw string concatenation in SQL
- innerHTML set to user-controlled content without sanitization
- HTTP requests to user-provided URLs without domain allowlist
- Plaintext password storage or comparison
- No authentication check on a route that mutates state
- Financial operations without row-level locking

## Common false positives in security audits
- Math.random() in non-cryptographic context (animation, jitter, sampling)
- SHA256/MD5 for checksums (not passwords)
- Hardcoded values in test fixtures or example code
- eval() in an explicit plugin/code-loading surface

## Emergency protocol for CRITICAL findings
1. Document: exact file + line + exploit scenario
2. Rate: CRITICAL in the findings table
3. Propose: exact fix with code snippet
4. Verify: state which existing guard (if any) partially mitigates
