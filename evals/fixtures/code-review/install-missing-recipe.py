#!/usr/bin/env python3
"""
Durable fixture for code-review eval scenario 0 (normal).

Adds a slash command mapping for 'security' pointing to a non-existent recipe
'harness-security-review.yaml' in both install.sh and install.ps1.
The reviewer should catch this as a CRITICAL finding (missing recipe file).

Uses string-based transformation — no line numbers, survives file edits.
"""
import pathlib, sys, re

worktree = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")

# ── install.sh: insert security entry after the last managed entry ────────
sh = worktree / "scripts" / "install.sh"
if sh.exists():
    text = sh.read_text()
    # Find the managed list closing bracket
    # Inject after the last entry in the managed list (before the closing bracket line)
    old = '    ("uiux", "design.yaml"),\n]'
    new = '    ("uiux", "design.yaml"),\n    ("security", "harness-security-review.yaml"),\n]'
    if old in text:
        sh.write_text(text.replace(old, new, 1))
        print("[fixture] install.sh: security slash command added (recipe does not exist)")
    else:
        # Fallback: find last managed entry pattern
        m = re.search(r'(\(\s*"[a-z]+",\s*"[^"]+\.yaml"\s*\),\n)(\])', text)
        if m:
            sh.write_text(text[:m.start(2)] + '    ("security", "harness-security-review.yaml"),\n]' + text[m.end(2):])
            print("[fixture] install.sh: security entry added via fallback pattern")
        else:
            print("[fixture] WARNING: install.sh anchor not found", file=sys.stderr)
else:
    print("[fixture] WARNING: install.sh not found", file=sys.stderr)

# ── install.ps1: append security entry ───────────────────────────────────
ps1 = worktree / "scripts" / "install.ps1"
if ps1.exists():
    text = ps1.read_text()
    # Find last entry in the Managed array (ends with } without trailing comma, then ) or ])
    old = "        @{ command = 'uiux';      file = 'ui-ux-suite.yaml' }"
    new = "        @{ command = 'uiux';      file = 'ui-ux-suite.yaml' },\n        @{ command = 'security';  file = 'harness-security-review.yaml' }"
    if old in text:
        ps1.write_text(text.replace(old, new, 1))
        print("[fixture] install.ps1: security slash command added")
    else:
        print("[fixture] WARNING: install.ps1 anchor not found (non-critical)", file=sys.stderr)
else:
    print("[fixture] WARNING: install.ps1 not found (non-critical)", file=sys.stderr)

print("[fixture] all regressions applied")
