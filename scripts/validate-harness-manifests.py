#!/usr/bin/env python3
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def tree_hash(path):
 h=hashlib.sha256()
 for f in sorted(x for x in path.rglob('*') if x.is_file() and '__pycache__' not in x.parts):
  h.update(f.relative_to(path).as_posix().encode()+bytes([0]));h.update(f.read_bytes())
 return h.hexdigest()
def fail(msg): print('ERROR:',msg,file=sys.stderr); raise SystemExit(1)
m=json.loads((ROOT/'harness/source-manifest.json').read_text()); l=json.loads((ROOT/'harness/external-skills.lock.json').read_text())
if m.get('schema')!='harness-source-manifest-v1' or l.get('schema')!='harness-external-lock-v2': fail('schema mismatch')
ids=[c['id'] for c in m['components']]; names=[c['name'] for c in m['components']]
for c in m['components']:
 if 'sourcePath' in c: fail('ambiguous sourcePath remains: '+c['id'])
 if not c.get('currentRuntimePath','').startswith(('.agents/','.goose/')): fail('invalid currentRuntimePath: '+c['id'])
 if not c.get('targetSourcePath','').startswith('src/'): fail('invalid targetSourcePath: '+c['id'])
if len(ids)!=len(set(ids)): fail('duplicate component id')
locked={x['name']:x for x in l['skills']}; external={c['name'] for c in m['components'] if c['kind']=='skill' and c['ownership']=='external'}
active={n for n,x in locked.items() if x['active']}
if external!=active: fail(f'external manifest/lock mismatch: {external^active}')
for n in active:
 x=locked[n]; p=ROOT/'.agents/skills'/n
 if not p.is_dir(): fail(f'missing active external: {n}')
 if len(x['source']['revision'])!=40: fail(f'unpinned revision: {n}')
 if x['license']['spdx']=='NOASSERTION' or not x['license']['releaseAllowed']: fail(f'unapproved license: {n}')
 expected=x['integrity'].get('localDigest',x['integrity']['digest'])
 if tree_hash(p)!=expected: fail(f'integrity drift: {n}')
for x in l['skills']:
 for dep in x['dependencies']:
  if dep.startswith('skill:') and dep[6:] not in locked: fail(f'missing dependency {dep}')
graph={x['name']:[d[6:] for d in x['dependencies'] if d.startswith('skill:')] for x in l['skills']}; seen=set(); stack=set()
def visit(n):
 if n in stack: fail('dependency cycle at '+n)
 if n in seen:return
 stack.add(n)
 for d in graph[n]:visit(d)
 stack.remove(n);seen.add(n)
for n in graph:visit(n)
print(f'OK components={len(ids)} external_active={len(active)} external_inactive={len(locked)-len(active)}')