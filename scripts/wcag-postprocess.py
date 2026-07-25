#!/usr/bin/env python3
"""Add language and main-landmark fixes to Pandoc HTML output."""
import pathlib, re, sys

if len(sys.argv) != 2:
    raise SystemExit("usage: wcag-postprocess.py <html-file>")
p = pathlib.Path(sys.argv[1])
t = p.read_text(errors="replace")
t = re.sub(r'<html([^>]*)lang=""([^>]*)>', r'<html\1lang="en"\2>', t)
if "<main" not in t:
    t = t.replace("<body>", '<body>\n<main id="main-content" role="main">', 1)
    t = t.replace("</body>", "</main>\n</body>", 1)
p.write_text(t)
print(f"WCAG post-process done: {p}")
