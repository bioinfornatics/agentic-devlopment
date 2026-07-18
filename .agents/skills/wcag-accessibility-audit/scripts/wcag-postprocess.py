#!/usr/bin/env python3
"""WCAG post-processor for pandoc HTML output.
Usage: wcag-postprocess.py <html-file>
"""
import pathlib, re, sys

p = pathlib.Path(sys.argv[1])
t = p.read_text(errors='replace')

# Fix lang="" -> lang="fr" (WCAG 3.1.1)
t = re.sub(r'<html([^>]*)lang=""([^>]*)>', r'<html\1lang="fr"\2>', t)

# Add <main> landmark if missing (WCAG 1.3.1)
if '<main' not in t:
    t = t.replace('<body>', '<body>\n<main id="main-content" role="main">', 1)
    t = t.replace('</body>', '</main>\n</body>', 1)

p.write_text(t)
print(f"WCAG post-process done: {p}")
