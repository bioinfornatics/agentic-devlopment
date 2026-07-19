#!/usr/bin/env python3
import pathlib,re,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
rows=[]
for p in sorted((ROOT/".agents/skills").glob("*/SKILL.md")):
    n=len(p.read_text(errors="ignore").splitlines()); rows.append({"type":"skill","name":p.parent.name,"path":str(p.relative_to(ROOT)),"lines":n,"status":"warn" if n>500 else "ok"})
for p in sorted((ROOT/".agents/agents").glob("*.md")):
    body=p.read_text(errors="ignore"); n=len(body.splitlines()); rows.append({"type":"agent","name":p.stem,"path":str(p.relative_to(ROOT)),"lines":n,"skill_loads":len(re.findall("load skill",body,re.I)),"status":"warn" if n>400 else "ok"})
print(json.dumps({"schema":"harness-context-budget-v1","budgets":{"skill_warn_lines":500,"agent_warn_lines":400},"rows":rows},indent=2,sort_keys=True))
