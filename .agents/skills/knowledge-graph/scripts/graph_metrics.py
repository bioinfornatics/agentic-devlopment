#!/usr/bin/env python3
"""Calculate dependency-free structural metrics for JSONL KG exports."""
from __future__ import annotations
import argparse, json
from collections import Counter, defaultdict, deque
from pathlib import Path

p=argparse.ArgumentParser(); p.add_argument('graph',type=Path); a=p.parse_args()
entities={}; edges=[]
for raw in a.graph.read_text(encoding='utf-8').splitlines():
    if not raw.strip(): continue
    x=json.loads(raw)
    if x.get('type')=='entity' or 'entityType' in x: entities[x['name']]=x
    elif x.get('type')=='relation' or {'from','to','relationType'} <= x.keys(): edges.append((x['from'],x['to'],x['relationType']))
in_deg=Counter(); out_deg=Counter(); adj=defaultdict(set); und=defaultdict(set)
for s,t,_ in edges:
    out_deg[s]+=1; in_deg[t]+=1; adj[s].add(t); und[s].add(t); und[t].add(s)
seen=set(); comps=[]
for n in entities:
    if n in seen: continue
    q=deque([n]); seen.add(n); comp=[]
    while q:
        v=q.popleft(); comp.append(v)
        for w in und[v]:
            if w not in seen: seen.add(w); q.append(w)
    comps.append(comp)
print(json.dumps({
 'entities':len(entities),'relations':len(edges),'connected_components':len(comps),
 'orphans':sorted([n for n in entities if in_deg[n]+out_deg[n]==0]),
 'dead_ends':sorted([n for n in entities if in_deg[n]>0 and out_deg[n]==0]),
 'top_in_degree':in_deg.most_common(10),'top_out_degree':out_deg.most_common(10),
 'largest_component_size':max((len(c) for c in comps),default=0)
},indent=2))
