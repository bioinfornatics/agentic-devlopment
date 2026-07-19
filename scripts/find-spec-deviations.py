#!/usr/bin/env python3
import datetime, pathlib, re, sys
include_examples = False
args = sys.argv[1:]
if args and args[0] == "--include-examples":
    include_examples = True; args = args[1:]
root = pathlib.Path(args[0] if args else ".")
exts = {".ts",".tsx",".js",".jsx",".py",".sh",".rb",".go",".java",".rs",".yaml",".yml",".md"}
marker = re.compile(r"(//|#|/\*|--)[ \t]*SPEC_DEVIATION:")
active = 0; examples = 0
print("# SPEC_DEVIATION Scan — " + datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
print("# Root: " + str(root.resolve()))
print()
for path in sorted(p for p in root.rglob("*") if p.is_file() and p.suffix in exts):
    s = str(path)
    if any(part in path.parts for part in [".git","dist","node_modules",".audit"]):
        continue
    try:
        lines = path.read_text(errors="ignore").splitlines()
    except Exception:
        continue
    for i,line in enumerate(lines,1):
        if not marker.search(line):
            continue
        is_example = path.suffix == ".md" or chr(96) in line or "SPEC_DEVIATION detection" in line or "SPEC_DEVIATION marker" in line
        text = line.split("SPEC_DEVIATION:",1)[1].strip()
        if " — Reason:" in text:
            dev, reason = text.split(" — Reason:",1)
        else:
            dev, reason = text, "(not specified)"
        near = "\n".join(lines[max(0,i-6):min(len(lines),i+5)])
        m = re.search(r"\[[A-Z][A-Z0-9_-]+-[0-9]+\]", near)
        ac = m.group(0) if m else "(no AC ID found nearby)"
        if is_example:
            examples += 1
            if include_examples:
                print(f"{s:<60} | L{i:<5} | EXAMPLE: DEVIATION: {dev} | REASON: {reason.strip()} | AC-REF: {ac}")
        else:
            active += 1
            print(f"{s:<60} | L{i:<5} | DEVIATION: {dev} | REASON: {reason.strip()} | AC-REF: {ac}")
print()
if active == 0:
    print(f"SPEC_DEVIATION scan: clean (0 active markers found; {examples} classified example/instruction marker(s))")
else:
    print(f"SPEC_DEVIATION scan: {active} active marker(s) found — triage required (classified examples: {examples})")
    print(active, file=sys.stderr)
