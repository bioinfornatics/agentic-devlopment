#!/usr/bin/env python3
import hashlib,json,os,shutil,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def run(cmd,env=None):return subprocess.run(cmd,cwd=ROOT,env=env,capture_output=True,text=True)
def pipeline(base,label):
 ext=base/(label+'-ext');internal=base/(label+'-int');bundle=base/(label+'-bundle');prefix=base/(label+'-prefix')
 for cmd in [['python3','scripts/resolve-external-skills.py','--staging',str(ext)],['python3','scripts/build-harness.py','--output',str(internal),'--plugin-build-root','/tmp'],['python3','scripts/assemble-harness-release.py','--internal',str(internal),'--external',str(ext),'--output',str(bundle),'--version','e2e'],['python3','scripts/install-harness-release.py','install','--bundle',str(bundle),'--prefix',str(prefix)],['python3','scripts/install-harness-release.py','verify','--prefix',str(prefix)]]:
  r=run(cmd);assert r.returncode==0,r.stderr
 return ext,internal,bundle,prefix
class HarnessE2E(unittest.TestCase):
 def test_two_clean_environments_same_digest_and_inventory(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);a=pipeline(root,'a');b=pipeline(root,'b');aa=next(a[2].glob('*.tar'));bb=next(b[2].glob('*.tar'));self.assertEqual(hashlib.sha256(aa.read_bytes()).hexdigest(),hashlib.sha256(bb.read_bytes()).hexdigest());self.assertEqual(json.loads((a[0]/'resolved.json').read_text()),json.loads((b[0]/'resolved.json').read_text()));self.assertEqual(len(json.loads((a[0]/'resolved.json').read_text())['skills']),6);self.assertFalse((a[3]/'current/apps/eval-hub').exists())
 def test_tampered_archive_and_release_drift_fail_closed(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);ext,internal,bundle,prefix=pipeline(root,'a');current=prefix.joinpath('current').resolve();archive=next(bundle.glob('*.tar'));archive.write_bytes(archive.read_bytes()+b'x');r=run(['python3','scripts/install-harness-release.py','install','--bundle',str(bundle),'--prefix',str(prefix)]);self.assertNotEqual(r.returncode,0);self.assertEqual(current,prefix.joinpath('current').resolve());prefix.joinpath('current/.agents/skills/domain-modeling/SKILL.md').write_text('tamper');r=run(['python3','scripts/install-harness-release.py','verify','--prefix',str(prefix)]);self.assertNotEqual(r.returncode,0)
 def test_no_files_written_outside_prefix_by_installer(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);ext= root/'e';internal=root/'i';bundle=root/'b';prefix=root/'p';self.assertEqual(run(['python3','scripts/resolve-external-skills.py','--staging',str(ext)]).returncode,0);self.assertEqual(run(['python3','scripts/build-harness.py','--output',str(internal)]).returncode,0);self.assertEqual(run(['python3','scripts/assemble-harness-release.py','--internal',str(internal),'--external',str(ext),'--output',str(bundle),'--version','e2e']).returncode,0);before={p.relative_to(root).as_posix() for p in root.rglob('*')};self.assertEqual(run(['python3','scripts/install-harness-release.py','install','--bundle',str(bundle),'--prefix',str(prefix)]).returncode,0);after={p.relative_to(root).as_posix() for p in root.rglob('*')};self.assertTrue(all(x=='p' or x.startswith('p/') or x in before for x in after-before),after-before)
if __name__=='__main__':unittest.main()