#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def tree_hash(p):
 h=hashlib.sha256()
 for f in sorted(x for x in p.rglob('*') if x.is_file() and '__pycache__' not in x.parts):
  h.update(f.relative_to(p).as_posix().encode()+bytes([0]));h.update(f.read_bytes())
 return h.hexdigest()
def copy_skill(src,dst):
 if dst.exists():shutil.rmtree(dst)
 shutil.copytree(src,dst,symlinks=False)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--lock',default='harness/external-skills.lock.json');ap.add_argument('--staging',required=True);ap.add_argument('--source-root');ap.add_argument('--cache');ap.add_argument('--offline',action='store_true');ap.add_argument('--skills-cli',default='1.5.20');a=ap.parse_args()
 lock=json.loads((ROOT/a.lock).read_text()); staging=Path(a.staging).resolve(); tmp=staging.with_name(staging.name+'.partial')
 if tmp.exists():shutil.rmtree(tmp)
 tmp.mkdir(parents=True); installed=[]
 try:
  for x in lock['skills']:
   if not x['active']:continue
   name=x['name']; src=None
   if a.source_root: src=Path(a.source_root)/name
   elif a.cache: src=Path(a.cache)/x['source']['revision']/name
   if src is None or not src.is_dir():
    if a.offline:raise RuntimeError('offline cache miss: '+name)
    with tempfile.TemporaryDirectory(prefix='harness-skill-') as td:
     checkout=Path(td)/'repo';subprocess.run(['git','clone','--quiet','https://github.com/'+x['source']['repository']+'.git',str(checkout)],check=True)
     subprocess.run(['git','-C',str(checkout),'checkout','--quiet',x['source']['revision']],check=True)
     env={**os.environ,'HOME':str(Path(td)/'home'),'XDG_CONFIG_HOME':str(Path(td)/'xdg-config'),'XDG_DATA_HOME':str(Path(td)/'xdg-data')}
     project=Path(td)/'project';project.mkdir();subprocess.run(['npx','--yes','skills@'+a.skills_cli,'add',str(checkout),'--skill',name,'--copy','--agent','goose','-y'],cwd=project,env=env,check=True,stdout=subprocess.DEVNULL)
     candidates=[project/'.agents/skills'/name,project/'.goose/skills'/name,checkout/x['source']['path']]
     found=next((p for p in candidates if p.is_dir()),None)
     if found is None:raise RuntimeError('resolver produced no skill: '+name)
     copy_skill(found,tmp/name)
   else: copy_skill(src,tmp/name)
   digest=tree_hash(tmp/name)
   if digest!=x['integrity']['digest']:raise RuntimeError('integrity mismatch: '+name)
   installed.append({'name':name,'revision':x['source']['revision'],'digest':digest})
  (tmp/'resolved.json').write_text(json.dumps({'schema':'resolved-external-skills-v1','resolver':{'name':'skills','version':a.skills_cli},'skills':installed},sort_keys=True,indent=2)+'\n')
  if staging.exists():shutil.rmtree(staging)
  tmp.rename(staging)
 except Exception:
  shutil.rmtree(tmp,ignore_errors=True);raise
if __name__=='__main__':main()