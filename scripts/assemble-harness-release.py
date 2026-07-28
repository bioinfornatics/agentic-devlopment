#!/usr/bin/env python3
import argparse,hashlib,json,shutil,subprocess,tarfile,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--internal',required=True);ap.add_argument('--external',required=True);ap.add_argument('--output',required=True);ap.add_argument('--version',required=True);ap.add_argument('--target',default='linux-x86_64');ap.add_argument('--sign-key');a=ap.parse_args();
 if '/' in a.version or '\\' in a.version or a.version in ('','.','..'):raise RuntimeError('invalid release version')
 internal=Path(a.internal);external=Path(a.external);out=Path(a.output);tmp=Path(tempfile.mkdtemp(prefix='harness-release-'))
 try:
  root=tmp/'root';root.mkdir()
  for child in internal.iterdir():
   dest=root/child.name
   if child.is_dir():shutil.copytree(child,dest)
   else:shutil.copy2(child,dest)
  ext_dst=root/'.agents/skills';ext_dst.mkdir(parents=True,exist_ok=True)
  for child in external.iterdir():
   if child.name=='resolved.json':continue
   shutil.copytree(child,ext_dst/child.name)
  meta=root/'.harness';meta.mkdir();shutil.copy2(internal/'build-manifest.json',meta/'build-manifest.json');shutil.copy2(external/'resolved.json',meta/'resolved.json')
  if any(p.name in ('apps','evals','node_modules') for p in root.rglob('*')):raise RuntimeError('forbidden content')
  if any(p.name.endswith(('.db','-wal','-shm')) for p in root.rglob('*') if p.is_file()):raise RuntimeError('mutable database in release')
  files=[{'path':p.relative_to(root).as_posix(),'sha256':sha(p),'size':p.stat().st_size} for p in sorted(x for x in root.rglob('*') if x.is_file())]
  lock=sha(ROOT/'harness/external-skills.lock.json');build=sha(internal/'build-manifest.json');resolved=sha(external/'resolved.json');manifest={'schema':'harness-release-v1','version':a.version,'target':a.target,'lockSha256':lock,'buildManifestSha256':build,'resolvedManifestSha256':resolved,'files':files,'excludes':['eval-hub','apps','evals','session-db','caches']};(root/'release.json').write_text(json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n')
  active=json.loads((ROOT/'harness/external-skills.lock.json').read_text())['skills'];sbom={'bomFormat':'CycloneDX','specVersion':'1.5','components':[{'type':'library','name':x['name'],'version':x['source']['revision'],'licenses':[{'license':{'id':x['license']['spdx']}}]} for x in active if x['active']]};(root/'sbom.cdx.json').write_text(json.dumps(sbom,sort_keys=True,separators=(',',':'))+'\n');(root/'THIRD_PARTY_LICENSES.json').write_text(json.dumps({x['name']:x['license']['spdx'] for x in active if x['active']},sort_keys=True,indent=2)+'\n');provenance={'schema':'harness-build-provenance-v1','sourceRevision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'lockSha256':lock,'target':a.target,'tools':{'python':subprocess.check_output(['python3','--version'],text=True).strip()}};(root/'provenance.json').write_text(json.dumps(provenance,sort_keys=True,separators=(',',':'))+'\n')
  out.mkdir(parents=True,exist_ok=True);archive=out/f'harness-{a.version}-{a.target}.tar'
  with tarfile.open(archive,'w',format=tarfile.PAX_FORMAT) as tar:
   for p in sorted(root.rglob('*')):
    info=tar.gettarinfo(str(p),arcname=p.relative_to(root).as_posix());info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
    if p.is_file():
     with p.open('rb') as f:tar.addfile(info,f)
    else:tar.addfile(info)
  digest=sha(archive);(out/'SHA256SUMS').write_text(digest+'  '+archive.name+'\n')
  for n in ('release.json','sbom.cdx.json','THIRD_PARTY_LICENSES.json','provenance.json'):shutil.copy2(root/n,out/n)
  if a.sign_key:subprocess.run(['openssl','pkeyutl','-sign','-rawin','-inkey',a.sign_key,'-in',str(out/'SHA256SUMS'),'-out',str(out/'SHA256SUMS.sig')],check=True)
  print(digest)
 finally:shutil.rmtree(tmp,ignore_errors=True)
if __name__=='__main__':main()