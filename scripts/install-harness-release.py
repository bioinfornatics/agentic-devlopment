#!/usr/bin/env python3
import argparse,fcntl,hashlib,json,os,shutil,tarfile,tempfile
from pathlib import Path
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(bundle):
 sums=(bundle/'SHA256SUMS').read_text().strip().split();archive=bundle/sums[1]
 if sha(archive)!=sums[0]:raise RuntimeError('checksum mismatch')
 return archive,sums[0]
def switch(current,target):
 tmp=current.with_name('.current.tmp');tmp.unlink(missing_ok=True);tmp.symlink_to(target);os.replace(tmp,current)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('action',choices=['install','rollback','uninstall','verify']);ap.add_argument('--bundle');ap.add_argument('--prefix',required=True);ap.add_argument('--digest');ap.add_argument('--keep',type=int,default=3);a=ap.parse_args();prefix=Path(a.prefix);prefix.mkdir(parents=True,exist_ok=True);lock=(prefix/'.install.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX);releases=prefix/'releases';releases.mkdir(exist_ok=True);current=prefix/'current'
 if a.action=='install':
  bundle=Path(a.bundle);archive,digest=verify(bundle);target=releases/digest
  if not target.exists():
   tmp=releases/(digest+'.partial');shutil.rmtree(tmp,ignore_errors=True);tmp.mkdir()
   try:
    with tarfile.open(archive) as t:
     for m in t.getmembers():
      dest=(tmp/m.name).resolve()
      if not str(dest).startswith(str(tmp.resolve())+os.sep):raise RuntimeError('archive path escape')
     t.extractall(tmp,filter='data')
    if not (tmp/'release.json').exists():raise RuntimeError('release manifest missing')
    tmp.rename(target)
   except Exception:shutil.rmtree(tmp,ignore_errors=True);raise
  old=os.readlink(current) if current.is_symlink() else None
  if old:(prefix/'previous').write_text(old+'\n')
  switch(current,Path('releases')/digest)
  active={p.resolve() for p in releases.iterdir() if p.is_dir() and not p.name.endswith('.partial')};keep={current.resolve()};prev=prefix/'previous'
  if prev.exists():keep.add((prefix/prev.read_text().strip()).resolve())
  for p in sorted(active,key=lambda x:x.stat().st_mtime,reverse=True)[a.keep:]:
   if p not in keep:shutil.rmtree(p)
  print(digest)
 elif a.action=='verify':
  if not current.is_symlink():raise RuntimeError('no active release')
  root=current.resolve();m=json.loads((root/'release.json').read_text())
  for f in m['files']:
   p=root/f['path']
   if not p.is_file() or sha(p)!=f['sha256']:raise RuntimeError('installed drift: '+f['path'])
  print(root.name)
 elif a.action=='rollback':
  prev=prefix/'previous'
  if not prev.exists():raise RuntimeError('no rollback release')
  target=Path(prev.read_text().strip())
  if not (prefix/target).is_dir():raise RuntimeError('rollback target missing')
  switch(current,target);print((prefix/target).resolve().name)
 else:
  if a.digest:
   target=releases/a.digest
   if current.is_symlink() and current.resolve()==target.resolve():raise RuntimeError('cannot uninstall active release')
   shutil.rmtree(target)
  else:
   current.unlink(missing_ok=True);(prefix/'previous').unlink(missing_ok=True)
if __name__=='__main__':main()