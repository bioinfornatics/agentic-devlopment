#!/usr/bin/env python3
import argparse,hashlib,json,os,shutil,subprocess,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def file_hash(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify_release(root):
 m=json.loads((root/'release.json').read_text())
 for f in m['files']:
  p=root/f['path']
  if not p.is_file() or file_hash(p)!=f['sha256']:raise RuntimeError('release drift: '+f['path'])
 return m
def tree_digest(root):
 h=hashlib.sha256()
 for p in sorted(x for x in root.rglob('*') if x.is_file()):h.update(p.relative_to(root).as_posix().encode()+bytes([0]));h.update(p.read_bytes())
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--release',required=True);ap.add_argument('--goose-cli',required=True);ap.add_argument('--eval-hub',default='apps/eval-hub/dist/index.js');ap.add_argument('--run-id');ap.add_argument('--dry-run',action='store_true');ap.add_argument('eval_args',nargs=argparse.REMAINDER);a=ap.parse_args();release=Path(a.release).resolve();manifest=verify_release(release);digest=tree_digest(release);lock=manifest['lockSha256'];goose=file_hash(Path(a.goose_cli));runid=a.run_id or time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
 active={x['name'] for x in json.loads((ROOT/'harness/external-skills.lock.json').read_text())['skills'] if x['active']};missing=sorted(n for n in active if not (ROOT/'evals/skills'/(n+'.json')).is_file())
 if missing:raise RuntimeError('external skills missing eval coverage: '+','.join(missing))
 evidence={'schema':'harness-eval-provenance-v1','runId':runid,'releaseDigest':digest,'releaseManifestSha256':file_hash(release/'release.json'),'lockSha256':lock,'gooseBinarySha256':goose,'externalSkills':sorted(active),'evalHubIncludedInRelease':False}
 if a.dry_run:print(json.dumps(evidence,sort_keys=True));return
 with tempfile.TemporaryDirectory(prefix='eval-release-') as td:
  overlay=Path(td)/'project';shutil.copytree(release,overlay,symlinks=False);os.symlink(ROOT/'evals',overlay/'evals');os.symlink(ROOT/'.beads',overlay/'.beads') if (ROOT/'.beads').exists() else None
  out=ROOT/'dist/evals/layered'/runid;out.mkdir(parents=True,exist_ok=True);(out/'harness-release-provenance.json').write_text(json.dumps(evidence,indent=2,sort_keys=True)+'\n')
  env={**os.environ,'PROJECT_ROOT':str(overlay),'HARNESS_RELEASE_DIGEST':digest};cmd=['node',str((ROOT/a.eval_hub).resolve()),'--run','--resume',runid,'--goose-cli',str(Path(a.goose_cli).resolve()),*([x for x in a.eval_args if x!='--'])];rc=subprocess.run(cmd,cwd=ROOT,env=env).returncode
  after=tree_digest(release);evidence['releaseDigestAfter']=after;evidence['stableDuringRun']=after==digest;(out/'harness-release-provenance.json').write_text(json.dumps(evidence,indent=2,sort_keys=True)+'\n')
  if after!=digest:raise RuntimeError('release mutated during evaluation; discard run '+runid)
  raise SystemExit(rc)
if __name__=='__main__':main()
