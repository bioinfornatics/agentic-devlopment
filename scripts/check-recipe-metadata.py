#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/".specs/harness/recipe-workflow-metadata.json").read_text())
errs=[]
recipes=sorted(p.stem for p in (ROOT/".goose/recipes").glob("*.yaml"))
for r in recipes:
    m=meta.get("recipes",{}).get(r)
    if not m: errs.append("missing metadata for "+r); continue
    for k in ["source_path","phase","ad001_pattern","entry_criteria","exit_criteria"]:
        if not m.get(k): errs.append(r+" missing "+k)
    if r!="remember" and "AD-001 pattern:" not in (ROOT/".goose/recipes"/(r+".yaml")).read_text(errors="ignore"):
        errs.append(r+" missing AD-001 pattern marker")
if errs:
    print("FAIL recipe metadata"); [print("-",e) for e in errs]; sys.exit(1)
print("PASS recipe metadata complete for %d recipes"%len(recipes))
