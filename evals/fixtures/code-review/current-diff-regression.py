#!/usr/bin/env python3
"""
Durable fixture for code-review eval-2 (very_difficult).

Uses transformation-based approach (no line numbers) so it remains valid
regardless of SKILL.md length. Applies three intentional regressions:
  1. harness-review.yaml   max_turns 4→1   (handoff completeness breaks)
  2. code-review/SKILL.md  appends shortcut  (bypasses finding-generation loop)
  3. docs/15-skill-evaluations.md  injects TODO.md guidance (Beads hygiene violation)
"""
import pathlib, sys, re

worktree = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")

# ── Regression 1: recipe max_turns 4 → 1 ──────────────────────────────────
recipe = worktree / ".goose" / "recipes" / "harness-review.yaml"
if recipe.exists():
    text = recipe.read_text()
    modified = re.sub(r"(  max_turns: )\d+", r"\g<1>1", text, count=1)
    recipe.write_text(modified)
    print(f"[fixture] {recipe.name}: max_turns → 1")
else:
    print(f"[fixture] WARNING: {recipe} not found", file=sys.stderr)

# ── Regression 2: SKILL.md — append shortcut bypassing finding-gen loop ────
skill = worktree / ".agents" / "skills" / "code-review" / "SKILL.md"
if skill.exists():
    content = skill.read_text().rstrip()
    shortcut = (
        "\n\n\n## Temporary review shortcut\n\n"
        "For small diffs, skip the finding generation loop and validation details"
        " — just summarize the intent.\n"
    )
    skill.write_text(content + shortcut)
    print(f"[fixture] {skill.name}: appended Temporary review shortcut")
else:
    print(f"[fixture] WARNING: {skill} not found", file=sys.stderr)

# ── Regression 3: docs — inject TODO.md tracking guidance ──────────────────
docs = worktree / "docs" / "15-skill-evaluations.md"
if docs.exists():
    text = docs.read_text()
    # Match the Iterate step regardless of exact numbering/formatting
    pattern = r"(\*\*Iterate\*\* — execute evals, compare against baseline, and refine\.)"
    injection = (
        r"\1"
        "\n\n\n### Temporary follow-up tracking\n\n"
        "During eval review, write remaining work to `TODO.md` so future agents can pick it up later."
    )
    modified = re.sub(pattern, injection, text, count=1)
    if modified != text:
        docs.write_text(modified)
        print(f"[fixture] {docs.name}: injected TODO.md tracking")
    else:
        print(f"[fixture] WARNING: docs Iterate anchor not found", file=sys.stderr)
else:
    print(f"[fixture] WARNING: {docs} not found", file=sys.stderr)

print("[fixture] all regressions applied")
