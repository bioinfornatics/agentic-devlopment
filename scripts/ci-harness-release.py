#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def run(cmd,**kw):subprocess.run(cmd,cwd=ROOT,check=True,**kw)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--version',required=True);ap.add_argument('--output',required=True);ap.add_argument('--goose-cli');ap.add_argument('--dry-run-publish',action='store_true');a=ap.parse_args();out=Path(a.output).resolve();shutil.rmtree(out,ignore_errors=True);out.mkdir(parents=True)
 if subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip() and os.environ.get('CI')!='true':raise RuntimeError('release build requires clean git tree')
 run(['python3','scripts/validate-harness-manifests.py']);run(['python3','-m','unittest','discover','-s','scripts/tests/integration','-p','test_harness*.py'])
 with tempfile.TemporaryDirectory(prefix='harness-ci-') as td:
  t=Path(td);ext=t/'external';internal=t/'internal';run(['python3','scripts/resolve-external-skills.py','--staging',str(ext)]);run(['python3','scripts/build-harness.py','--output',str(internal)]);release=out/'release';run(['python3','scripts/assemble-harness-release.py','--internal',str(internal),'--external',str(ext),'--output',str(release),'--version',a.version]);r2=t/'release2';run(['python3','scripts/assemble-harness-release.py','--internal',str(internal),'--external',str(ext),'--output',str(r2),'--version',a.version]);archive=next(release.glob('*.tar'));other=next(r2.glob('*.tar'))
  if archive.read_bytes()!=other.read_bytes():raise RuntimeError('reproducibility failure')
  prefix=t/'prefix';run(['python3','scripts/install-harness-release.py','install','--bundle',str(release),'--prefix',str(prefix)]);run(['python3','scripts/install-harness-release.py','verify','--prefix',str(prefix)])
  result={'schema':'harness-ci-release-v1','version':a.version,'archive':archive.name,'digest':sha(archive),'releaseManifestSha256':sha(release/'release.json'),'lockSha256':sha(ROOT/'harness/external-skills.lock.json'),'dryRunPublish':a.dry_run_publish};(out/'ci-result.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n');print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
