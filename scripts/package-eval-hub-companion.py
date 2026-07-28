#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,subprocess,tarfile,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIXED=Path('/tmp/agentic-development-build/eval-hub-companion')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree_hash(root):
 h=hashlib.sha256()
 for p in sorted(x for x in root.rglob('*') if x.is_file()):h.update(p.relative_to(root).as_posix().encode()+bytes([0]));h.update(p.read_bytes())
 return h.hexdigest()
def copy_skill(dst):shutil.copytree(ROOT/'companions/eval-hub/skill',dst/'.agents/skills/eval-hub')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--version',required=True);ap.add_argument('--output',required=True);ap.add_argument('--target',default='linux-x86_64');ap.add_argument('--license-spdx');ap.add_argument('--allow-noassertion',action='store_true');ap.add_argument('--bun',default='bun');ap.add_argument('--source-date-epoch');a=ap.parse_args()
 if a.target!='linux-x86_64':raise RuntimeError('unsupported companion target: '+a.target)
 license_id=a.license_spdx or 'NOASSERTION'
 if license_id=='NOASSERTION' and not a.allow_noassertion:raise RuntimeError('distribution license is NOASSERTION; pass reviewed --license-spdx or explicit --allow-noassertion for non-publishing tests')
 out=Path(a.output).resolve();shutil.rmtree(out,ignore_errors=True);out.mkdir(parents=True);shutil.rmtree(FIXED,ignore_errors=True);FIXED.mkdir(parents=True)
 try:
  binary=FIXED/'eval-hub';subprocess.run([a.bun,'build','eval-hub/src/index.ts','--compile','--outfile',str(binary)],cwd=ROOT/'apps',check=True)
  first=sha(binary);binary.unlink();subprocess.run([a.bun,'build','eval-hub/src/index.ts','--compile','--outfile',str(binary)],cwd=ROOT/'apps',check=True)
  if sha(binary)!=first:raise RuntimeError('non-reproducible Bun companion binary')
  root=FIXED/'root';root.mkdir();(root/'bin').mkdir();shutil.copy2(binary,root/'bin/eval-hub');(root/'bin/eval-hub').chmod(0o755);(root/'bin/eval-hub.sha256').write_text(first+'  eval-hub\n');copy_skill(root)
  launcher=root/'.agents/skills/eval-hub/scripts/eval-hub';launcher.chmod(0o755);skill_digest=tree_hash(root/'.agents/skills/eval-hub');commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();epoch=a.source_date_epoch or subprocess.check_output(['git','show','-s','--format=%ct',commit],cwd=ROOT,text=True).strip();bun_version=subprocess.check_output([a.bun,'--version'],text=True).strip()
  files=[{'path':p.relative_to(root).as_posix(),'sha256':sha(p),'size':p.stat().st_size} for p in sorted(x for x in root.rglob('*') if x.is_file())]
  manifest={'schema':'eval-hub-companion-v1','version':a.version,'target':a.target,'sourceRepository':'https://github.com/bioinfornatics/agentic-devlopment','sourceCommit':commit,'sourceCommitEpoch':int(epoch),'bunVersion':bun_version,'binarySha256':first,'skillSha256':skill_digest,'coreHarnessIncluded':False,'files':files};(root/'companion.json').write_text(json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n')
  sbom={'bomFormat':'CycloneDX','specVersion':'1.5','components':[{'type':'application','name':'eval-hub-companion','version':a.version,'properties':[{'name':'sourceCommit','value':commit},{'name':'bunVersion','value':bun_version}]}]};(root/'sbom.cdx.json').write_text(json.dumps(sbom,sort_keys=True,separators=(',',':'))+'\n');(root/'LICENSE-ASSERTION.json').write_text(json.dumps({'spdx':license_id,'distributionAllowed':license_id!='NOASSERTION','reviewRequired':license_id=='NOASSERTION'},sort_keys=True,indent=2)+'\n');(root/'provenance.json').write_text(json.dumps({'schema':'eval-hub-companion-provenance-v1','sourceCommit':commit,'sourceCommitEpoch':int(epoch),'target':a.target,'bunVersion':bun_version,'binarySha256':first,'skillSha256':skill_digest},sort_keys=True,separators=(',',':'))+'\n')
  archive=out/f'eval-hub-companion-{a.version}-{a.target}.tar'
  with tarfile.open(archive,'w',format=tarfile.PAX_FORMAT) as tar:
   for p in sorted(root.rglob('*')):
    info=tar.gettarinfo(str(p),arcname=p.relative_to(root).as_posix());info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
    if p.is_file():
     with p.open('rb') as f:tar.addfile(info,f)
    else:tar.addfile(info)
  digest=sha(archive);(out/'SHA256SUMS').write_text(digest+'  '+archive.name+'\n')
  for n in ('companion.json','sbom.cdx.json','LICENSE-ASSERTION.json','provenance.json'):shutil.copy2(root/n,out/n)
  print(digest)
 finally:shutil.rmtree(FIXED,ignore_errors=True)
if __name__=='__main__':main()