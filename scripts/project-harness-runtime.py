#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,tempfile
from pathlib import Path
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(root):
 return [{'path':p.relative_to(root).as_posix(),'sha256':sha(p),'size':p.stat().st_size} for p in sorted(x for x in root.rglob('*') if x.is_file())]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--internal',required=True);ap.add_argument('--external',required=True);ap.add_argument('--runtime-root',required=True);a=ap.parse_args();internal=Path(a.internal).resolve();external=Path(a.external).resolve();runtime=Path(a.runtime_root).resolve();runtime.mkdir(parents=True,exist_ok=True);partial=Path(tempfile.mkdtemp(prefix='runtime-partial-',dir=runtime));root=partial/'root';root.mkdir()
 try:
  for name in ('.agents','.goose'):
   source=internal/name
   if source.exists():shutil.copytree(source,root/name)
  skills=root/'.agents/skills';skills.mkdir(parents=True,exist_ok=True)
  for item in external.iterdir():
   if item.name=='resolved.json':continue
   shutil.copytree(item,skills/item.name)
  files=tree(root);payload=json.dumps(files,sort_keys=True,separators=(',',':')).encode();digest=hashlib.sha256(payload).hexdigest();manifest={'schema':'harness-runtime-projection-v1','digest':digest,'target':'linux-x86_64','internalManifestSha256':sha(internal/'build-manifest.json'),'externalManifestSha256':sha(external/'resolved.json'),'files':files};(root/'.harness-runtime.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n');target=runtime/'releases'/digest;target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():shutil.rmtree(partial)
  else:root.rename(target);shutil.rmtree(partial,ignore_errors=True)
  (runtime/'candidate').write_text(digest+'\n');print(digest)
 except Exception:shutil.rmtree(partial,ignore_errors=True);raise
if __name__=='__main__':main()