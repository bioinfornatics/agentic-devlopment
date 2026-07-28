#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def hash_tree(p):
 h=hashlib.sha256()
 for f in sorted(x for x in p.rglob('*') if x.is_file()):h.update(f.relative_to(p).as_posix().encode()+bytes([0]));h.update(f.read_bytes())
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--target',default='linux-x86_64');ap.add_argument('--skip-compile',action='store_true');ap.add_argument('--plugin-build-root');a=ap.parse_args();out=Path(a.output).resolve();tmp=out.with_name(out.name+'.partial');shutil.rmtree(tmp,ignore_errors=True);tmp.mkdir(parents=True)
 m=json.loads((ROOT/'harness/source-manifest.json').read_text());records=[]
 try:
  for c in m['components']:
   if c['ownership']!='internal':continue
   source_rel=c['targetSourcePath']
   src=ROOT/source_rel
   layout={'skill':Path('.agents/skills')/c['name'],'agent':Path('.agents/agents')/(c['name']+'.md'),'recipe':Path('.goose/recipes')/(c['name']+'.yaml'),'plugin':Path('.agents/plugins')/c['name']}
   dst=tmp/layout[c['kind']]
   dst.parent.mkdir(parents=True,exist_ok=True)
   if src.is_dir():shutil.copytree(src,dst,ignore=shutil.ignore_patterns('node_modules','data','bin','*.db','*.db-wal','*.db-shm','__pycache__'))
   else:shutil.copy2(src,dst)
   app_dir=ROOT/'src/app'/c['name']
   if c['kind']=='plugin' and (app_dir/'app-package.json').exists() and not a.skip_compile:
    if shutil.which('bun') is None:raise RuntimeError('bun required to compile '+c['name'])
    root=Path(a.plugin_build_root or tempfile.gettempdir());work=root/('harness-plugin-build-'+c['name']);shutil.rmtree(work,ignore_errors=True)
    shutil.copytree(app_dir,work,ignore=shutil.ignore_patterns('node_modules','data','bin','*.db','*.db-wal','*.db-shm','__pycache__'))
    try:
     subprocess.run(['bun','install','--frozen-lockfile'],cwd=work,check=True);subprocess.run(['bun','run','build'],cwd=work,check=True);binary=work/'bin'/c['name']
     if not binary.exists():raise RuntimeError('compiled binary missing: '+c['name'])
     (dst/'bin').mkdir(exist_ok=True);shutil.copy2(binary,dst/'bin'/c['name'])
    finally:shutil.rmtree(work,ignore_errors=True)
   for f in ([dst] if dst.is_file() else dst.rglob('*')):
    if f.is_file() and (f.suffix=='.sh' or '/bin/' in f.as_posix()):f.chmod(f.stat().st_mode|0o111)
   records.append({'id':c['id'],'path':str(dst.relative_to(tmp)),'digest':hash_tree(dst) if dst.is_dir() else hashlib.sha256(dst.read_bytes()).hexdigest()})
  forbidden=['apps','evals','node_modules'];
  if any((tmp/x).exists() for x in forbidden):raise RuntimeError('forbidden release content')
  (tmp/'build-manifest.json').write_text(json.dumps({'schema':'harness-build-manifest-v1','target':a.target,'components':records},sort_keys=True,indent=2)+'\n')
  if out.exists():shutil.rmtree(out)
  tmp.rename(out)
 except Exception:shutil.rmtree(tmp,ignore_errors=True);raise
if __name__=='__main__':main()