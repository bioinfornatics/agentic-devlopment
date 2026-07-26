#!/usr/bin/env python3
"""Convert compatible KG JSONL records to a compact property-graph JSON export."""
from __future__ import annotations
import argparse, json
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('input',type=Path); p.add_argument('output',type=Path); a=p.parse_args()
nodes=[]; edges=[]
for idx,raw in enumerate(a.input.read_text(encoding='utf-8').splitlines(),1):
    if not raw.strip(): continue
    x=json.loads(raw)
    if x.get('type')=='entity' or 'entityType' in x:
        nodes.append({'id':x['name'],'type':x.get('entityType'),'observations':x.get('observations',[])})
    elif x.get('type')=='relation' or {'from','to','relationType'} <= x.keys():
        edges.append({'id':f"r{idx}",'source':x['from'],'target':x['to'],'type':x['relationType']})
a.output.write_text(json.dumps({'nodes':nodes,'edges':edges},indent=2),encoding='utf-8')
print(f"wrote {a.output}: nodes={len(nodes)} edges={len(edges)}")
