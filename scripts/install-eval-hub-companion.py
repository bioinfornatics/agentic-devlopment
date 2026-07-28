#!/usr/bin/env python3
import argparse,hashlib,os,shutil,tarfile
from pathlib import Path
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--bundle',required=True);ap.add_argument('--prefix',required=True);a=ap.parse_args();bundle=Path(a.bundle);prefix=Path(a.prefix);parts=(bundle/'SHA256SUMS').read_text().split();archive=bundle/parts[1]
 if sha(archive)!=parts[0]:raise RuntimeError('companion archive checksum mismatch')
 target=prefix/'releases'/parts[0];partial=target.with_name(target.name+'.partial');shutil.rmtree(partial,ignore_errors=True);partial.mkdir(parents=True)
 try:
  with tarfile.open(archive) as tar:
   for m in tar.getmembers():
    dest=(partial/m.name).resolve()
    base=partial.resolve()
    if dest != base and not str(dest).startswith(str(base)+os.sep):raise RuntimeError('archive path escape')
   tar.extractall(partial,filter='data')
  binary=partial/'bin/eval-hub';expected=(partial/'bin/eval-hub.sha256').read_text().split()[0]
  if sha(binary)!=expected:raise RuntimeError('companion binary digest mismatch')
  binary.chmod(0o755);(partial/'.agents/skills/eval-hub/scripts/eval-hub').chmod(0o755);target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():shutil.rmtree(partial)
  else:partial.rename(target)
  current=prefix/'current';tmp=prefix/'.current.tmp';tmp.unlink(missing_ok=True);tmp.symlink_to(Path('releases')/parts[0]);os.replace(tmp,current);print(parts[0])
 except Exception:shutil.rmtree(partial,ignore_errors=True);raise
if __name__=='__main__':main()
