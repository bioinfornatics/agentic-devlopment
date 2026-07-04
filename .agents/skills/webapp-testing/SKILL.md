---
name: webapp-testing
description: >
  Toolkit for testing local web applications with browser automation, screenshots, console inspection, accessibility checks, and reproducible evidence.
metadata:
  version: 2.0.0
  evals: references/evals.json
---

# Web Application Testing

Use when validating a local web UI.

## Protocol

1. Identify start command and base URL.
2. Prefer an existing running server; avoid killing unrelated processes.
3. Use Playwright/browser tools to inspect real behavior.
4. Check console/network errors.
5. Test keyboard navigation and accessible names.
6. Capture screenshots for visual regressions or UI claims.
7. Return exact reproduction steps and evidence.

## Common checks

- Critical path works.
- Loading/empty/error/success states exist.
- Mobile/responsive layout does not break.
- Forms validate and announce errors.
- Focus is visible and ordered.
- No obvious contrast failures.
