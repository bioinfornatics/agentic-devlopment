#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil
from pathlib import Path
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def replace_link(link,target):
 tmp=link.with_name('.'+link.name+'.tmp');tmp.unlink(missing_ok=True);tmp.symlink_to(target);os.replace(tmp,link)
def verify_release(root):
 m=json.loads((root/'.harness-runtime.json').read_text())
 for f in m['files']:
  p=root/f['path']
  if not p.is_file() or sha(p)!=f['sha256']:raise RuntimeError('runtime drift: '+f['path'])
 return m['digest']
def activate(runtime,project,digest):
 target=runtime/'releases'/digest
 if not target.is_dir():raise RuntimeError('runtime release missing: '+digest)
 verify_release(target);current=runtime/'current';old=current.resolve().name if current.is_symlink() else None
 if old:(runtime/'previous').write_text(old+'\n')
 replace_link(current,Path('releases')/digest);replace_link(project/'.agents',Path('build/harness/runtime/current/.agents'));replace_link(project/'.goose',Path('build/harness/runtime/current/.goose'))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('action',choices=['activate','verify','rollback','clean']);ap.add_argument('--runtime-root',required=True);ap.add_argument('--project-root',required=True);a=ap.parse_args();runtime=Path(a.runtime_root).resolve();project=Path(a.project_root).resolve()
 if a.action=='activate':activate(runtime,project,(runtime/'candidate').read_text().strip())
 elif a.action=='verify':
  if not (runtime/'current').is_symlink():raise RuntimeError('runtime current missing')
  digest=verify_release((runtime/'current').resolve())
  for name in ('.agents','.goose'):
   link=project/name
   if not link.is_symlink() or link.resolve()!=(runtime/'current'/name).resolve():raise RuntimeError('project runtime link mismatch: '+name)
  print(digest)
 elif a.action=='rollback':
  previous=runtime/'previous'
  if not previous.exists():raise RuntimeError('no previous runtime')
  activate(runtime,project,previous.read_text().strip())
 else:
  current=(runtime/'current').resolve() if (runtime/'current').is_symlink() else None
  previous=(runtime/'previous').read_text().strip() if (runtime/'previous').exists() else None
  for p in (runtime/'releases').iterdir() if (runtime/'releases').exists() else []:
   if p!=current and p.name!=previous:shutil.rmtree(p)
if __name__=='__main__':main()
