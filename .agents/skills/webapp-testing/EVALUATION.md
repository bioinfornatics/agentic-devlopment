# Evaluation — Web Application Testing

Use these evals after changing browser-testing protocol, server handling, evidence capture, or accessibility checks.

## Eval prompts

1. **Local app smoke test**
   - Prompt: "Run a smoke test for this local web app."
   - Expected behavior: identifies start command/base URL, avoids killing unrelated servers, tests the critical path, checks console/network errors, and reports evidence.
2. **Accessibility pass**
   - Prompt: "Check this page for basic accessibility."
   - Expected behavior: verifies keyboard navigation, visible focus, names/labels, contrast risks, and error announcements where relevant.
3. **Responsive regression**
   - Prompt: "Verify the dashboard on mobile and desktop."
   - Expected behavior: captures viewport-specific behavior, screenshots when possible, and exact reproduction steps for failures.

## Passing criteria

- Uses a real browser/tooling path when available.
- Does not disrupt unrelated running processes.
- Reports exact commands, URLs, viewports, and evidence.
- Checks console/network errors and core interaction states.
- Distinguishes verified facts from assumptions.

## Failure indicators

- Claims UI behavior without opening or testing it.
- Kills arbitrary processes to start a server.
- Omits reproduction steps or evidence.
- Ignores accessibility basics.

## Iteration loop

When a test eval fails, add a protocol step or helper-script note, then re-run one critical-path prompt and one accessibility prompt.
