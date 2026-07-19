#!/usr/bin/env python3
import argparse, json, pathlib, re, datetime, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
SKILL_RE = re.compile(r"[Ll]oad\s+skills?\s*:?\s*([a-z][a-z0-9-]+)", re.IGNORECASE)
AGENT_RE = re.compile(r"[Ll]oad\s+agent\s+([a-z][a-z0-9-]+)", re.IGNORECASE)
PHASES={'constitution':'Constitution','discover':'Discover','clarify':'Clarify','spec':'Specify','plan':'Plan','implement':'Implement','review':'Review','verify':'Verify','release':'Release','remember':'Memory','explore':'Explore','design':'Design','sdd':'LifecycleOrchestration'}
def read(path):
    try: return path.read_text(errors='ignore').splitlines()
    except Exception: return []
def node(id,type,name,path=None,**extra):
    d={'id':id,'type':type,'name':name,'description':'','source_path':str(path.relative_to(ROOT)) if path else None,'source_lines':None,'source_kind':extra.pop('source_kind','explicit'),'confidence':extra.pop('confidence',1.0),'status':'active','version':None,'created_at':None,'updated_at':None,'tags':[]}; d.update(extra); return d
def rel(type,source,target,path=None,line=None,confidence=1.0,kind='explicit',evidence=None):
    return {'id':f"rel:{type}:{source}:{target}:{line or 'na'}",'type':type,'source':source,'target':target,'direction':'directed','evidence':evidence,'source_path':str(path.relative_to(ROOT)) if path else None,'source_lines':[line] if line else None,'source_kind':kind,'confidence':confidence,'status':'active','condition':None,'cardinality':None}
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--summary',action='store_true'); args=ap.parse_args(); nodes=[]; edges=[]; seen=set()
    def add(n):
        if n['id'] not in seen: nodes.append(n); seen.add(n['id'])
    for p in sorted((ROOT/'.agents/skills').iterdir() if (ROOT/'.agents/skills').exists() else []):
        if p.is_dir() and (p/'SKILL.md').exists(): add(node(f'skill:{p.name}','Skill',p.name,p/'SKILL.md',layer='L1'))
    for p in sorted((ROOT/'.agents/agents').glob('*.md')):
        aid=f'agent:{p.stem}'; add(node(aid,'Agent',p.stem,p,layer='L2'))
        for i,line in enumerate(read(p),1):
            for sk in SKILL_RE.findall(line): edges.append(rel('Agent_LOADS_SKILL',aid,f'skill:{sk}',p,i,evidence=line.strip()))
    for p in sorted((ROOT/'.goose/recipes').glob('*.yaml')):
        rid=f'recipe:{p.stem}'; add(node(rid,'Recipe',p.stem,p,layer='L3'))
        if p.stem in PHASES:
            pid=f'phase:{PHASES[p.stem]}'; add(node(pid,'LifecyclePhase',PHASES[p.stem],None,source_kind='inferred',confidence=0.85)); edges.append(rel('Recipe_IMPLEMENTS_PHASE',rid,pid,p,None,0.85,'inferred'))
        for i,line in enumerate(read(p),1):
            for sk in SKILL_RE.findall(line): edges.append(rel('Recipe_LOADS_SKILL',rid,f'skill:{sk}',p,i,evidence=line.strip()))
            for ag in AGENT_RE.findall(line): edges.append(rel('Recipe_INVOLVES_AGENT',rid,f'agent:{ag}',p,i,evidence=line.strip()))

    audit_dir=ROOT/'.audit/harness'
    for art in sorted(audit_dir.glob('*')) if audit_dir.exists() else []:
        if art.is_file(): add(node(f'artifact:{art.name}','Artifact',art.name,art,layer='Audit'))
    findings=ROOT/'.audit/harness/findings-register.md'
    if findings.exists():
        cur=None
        for i,line in enumerate(read(findings),1):
            m=re.search(r'id:\s*(F-[A-Z]+-[0-9]+)', line)
            if m:
                cur=f'finding:{m.group(1)}'; add(node(cur,'Finding',m.group(1),findings,layer='Audit'))
            if cur and 'affected_files:' in line: edges.append(rel('Finding_HAS_EVIDENCE',cur,'artifact:findings-register.md',findings,i,evidence=line.strip()))
    state=ROOT/'.specs/STATE.md'
    if state.exists():
        for i,line in enumerate(read(state),1):
            m=re.match(r'##\s+(AD-[0-9]+)\s+—\s+(.+)', line)
            if m: add(node(f'decision:{m.group(1)}','Decision',m.group(1),state,title=m.group(2)))
    try:
        cp=subprocess.run(['bd','list','--json'],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10)
        if cp.returncode==0:
            for b in json.loads(cp.stdout):
                bid=b.get('id')
                if not bid: continue
                add(node(f'bead:{bid}','BeadTask',bid,ROOT/'.beads/issues.jsonl',status=b.get('status','active'),priority=b.get('priority'),issue_type=b.get('issue_type')))
                for d in b.get('dependencies') or []:
                    dep=d.get('depends_on_id')
                    if dep: edges.append(rel('Bead_DEPENDS_ON',f'bead:{bid}',f'bead:{dep}',ROOT/'.beads/issues.jsonl',None,0.9,'explicit'))
    except Exception: pass
    meta=ROOT/'.specs/harness/recipe-workflow-metadata.json'
    if meta.exists():
        try:
            md=json.loads(meta.read_text()).get('recipes',{})
            for r,m in md.items():
                rid=f'recipe:{r}'
                for idx,g in enumerate(m.get('entry_criteria',[])+m.get('exit_criteria',[]),1):
                    gid=f'gate:{r}:{idx}'; add(node(gid,'Gate',g,meta,layer='L3')); edges.append(rel('Recipe_HAS_GATE',rid,gid,meta,None,0.9,'explicit'))
                for a in m.get('artifacts',[]):
                    aid=f'artifact-type:{a}'; add(node(aid,'ArtifactType',a,meta,layer='L3')); edges.append(rel('Recipe_PRODUCES_ARTIFACT',rid,aid,meta,None,0.9,'explicit'))
        except Exception: pass

    graph={'schema':'harness-property-graph-v0','generated_at':datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat(),'root':str(ROOT),'nodes':nodes,'relationships':edges,'constraints':['Every active Agent should have at least one responsibility.','Every active Skill should be loaded by an Agent or Recipe unless justified.','Every active Recipe should implement a LifecyclePhase or cross-cutting function.','Every explicit relationship should include source_path and source_lines.']}
    if args.summary:
        nc={}; rc={}
        for n in nodes: nc[n['type']]=nc.get(n['type'],0)+1
        for e in edges: rc[e['type']]=rc.get(e['type'],0)+1
        print(json.dumps({'nodes':nc,'relationships':rc},indent=2,sort_keys=True))
    else: print(json.dumps(graph,indent=2,sort_keys=True))
if __name__=='__main__': main()
