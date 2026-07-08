---
name: webapp-testing
description: >
  Toolkit for testing local web applications with browser automation, screenshots, console inspection, accessibility checks, and reproducible evidence.
metadata:
  version: 3.0.0
---

# Web Application Testing

Use when validating a local web UI.

## Knowledge generation (before any browser test)

Before navigating:
1. Identify the start command and the exact base URL (protocol + host + port).
2. Check if a server is already running — avoid killing unrelated processes.
3. Read one existing test or script for patterns (do not reinvent fixtures).
4. Open browser tooling (Playwright) and confirm the page loads before testing anything.
Only after these four steps: begin the test protocol.

## Tool constraints

- **Never use `sudo`** — if a command requires elevated privileges, stop, explain why it is needed, and ask the user to run it.
- **Never use `sleep` or `waitForTimeout`** — use condition-based waiting: `waitForResponse`, `waitForSelector`, `waitForLoadState`, `waitForURL`.
- **Never kill unrelated running processes** — only stop the server you started.

## Protocol

1. Identify start command and exact base URL (protocol + host + port, e.g. `http://localhost:8080`).
2. Prefer an existing running server; avoid killing unrelated processes.
3. Use Playwright/browser tools for real browser behavior — static HTML inspection alone is not browser testing.
4. Check console/network errors with browser tools, not grep.
5. Test keyboard navigation by simulating Tab/Shift-Tab in the browser (not by inspecting HTML structure).
6. Capture screenshots as evidence — one per viewport or finding.
7. Return exact reproduction steps and evidence.

## Keyboard navigation testing (use browser, not code inspection)

For keyboard accessibility, perform these steps in the browser session:
1. Open the page with Playwright.
2. Press Tab repeatedly and record which element receives focus after each keypress.
3. Verify each focusable element has a visible focus indicator (outline or equivalent).
4. Press Shift-Tab to verify reverse navigation works.
5. Report the actual tab order as a numbered list — do not infer it from HTML source order.

Do NOT substitute HTML/CSS inspection for keyboard testing. Reading `<a>` tags in HTML source tells you nothing about whether Tab actually reaches them.

## Accessibility evidence labeling (mandatory)

Every finding in an accessibility report must be labeled as one of:
- **[VERIFIED — browser-tested]**: tested interactively in a real browser or via a browser automation tool (Playwright, axe-core)
- **[ASSUMPTION — code-inspection]**: inferred from reading HTML/CSS source without browser verification

Never present a code-inspection inference as if it were a browser-tested result.
A finding labeled [ASSUMPTION] must be followed by: *"Needs browser verification to confirm."*

## Accessible names checklist

- **Links**: all visible link text is meaningful (not "click here" or naked URLs)
- **Images**: every `<img>` has a non-empty `alt` (or `alt=""` if decorative)
- **Form inputs**: every `<input>`, `<select>`, `<textarea>` has an associated `<label>` or `aria-label`
- **Landmarks**: `<nav>`, `<main>`, `<aside>` have `aria-label` when >1 of the same type exists

## Self-validation loop

### Before reporting any browser test result:
- [ ] Page was navigated with Playwright (not just HTML file opened)
- [ ] Base URL includes protocol + host + port (not a relative path)
- [ ] Condition-based wait was used — NOT sleep() or waitForTimeout()
- [ ] Every a11y finding is labeled [VERIFIED — browser-tested] or [ASSUMPTION — code-inspection]
- [ ] Server lifecycle report includes: start command, tests run, stop command

## Common checks

- Critical path works.
- Loading/empty/error/success states exist.
- Mobile/responsive layout does not break (test both viewports with exact pixel dimensions).
- Forms validate and announce errors.
- Focus is visible, ordered, and tested with actual Tab keypresses.
- No obvious contrast failures.

## Server lifecycle (report all three steps)

1. **Start**: command run, exact URL confirmed.
2. **Test**: tests executed, evidence captured.
3. **Stop**: server stopped with exact stop command (e.g., `kill $PID` or `Ctrl-C`).

## Maker/Checker for browser tests

Browser tests follow the same maker/checker split as code:
- **Test author (maker):** writes the scenario and runs it once.
- **Evidence reviewer (checker):** a second pass confirms evidence is [VERIFIED — browser-tested], not inferred from code inspection.

Do not self-approve accessibility or layout findings — cross-check with at least one browser-based tool output (screenshot, axe snapshot, console log).

## Beads loop

For Beads workflow commands (prime, ready, claim, close, remember), load skill: `beads-harness`.

Skill-specific commands:
    bd create "WebTest: <finding>" --assignee qa-automation   → file test/a11y findings
    bd remember "Base URL: canonical source is scripts/build-docs.sh; read when starting the docs server; invariant: always use localhost:PORT not 0.0.0.0" --key docs-server-url
