#!/usr/bin/env python3
import hashlib,json,subprocess,tarfile,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def bundle(root,name,content):
 src=root/(name+'src');src.mkdir();(src/'payload').write_text(content);m={'files':[{'path':'payload','sha256':hashlib.sha256(content.encode()).hexdigest()}]};(src/'release.json').write_text(json.dumps(m));b=root/name;b.mkdir();a=b/(name+'.tar')
 with tarfile.open(a,'w') as t:
  for p in src.iterdir():t.add(p,arcname=p.name)
 (b/'SHA256SUMS').write_text(hashlib.sha256(a.read_bytes()).hexdigest()+'  '+a.name+'\n');return b
class InstallerTest(unittest.TestCase):
 def setUp(self):self.t=tempfile.TemporaryDirectory();self.r=Path(self.t.name);self.p=self.r/'prefix';self.a=bundle(self.r,'a','one');self.b=bundle(self.r,'b','two')
 def tearDown(self):self.t.cleanup()
 def invoke(self,*x):return subprocess.run(['python3','scripts/install-harness-release.py',*x,'--prefix',str(self.p)],cwd=ROOT,capture_output=True,text=True)
 def test_install_upgrade_verify_rollback(self):
  self.assertEqual(self.invoke('install','--bundle',str(self.a)).returncode,0);self.assertEqual(self.invoke('verify').returncode,0);first=self.p.joinpath('current').resolve();self.assertEqual(self.invoke('install','--bundle',str(self.b)).returncode,0);self.assertNotEqual(first,self.p.joinpath('current').resolve());self.assertEqual(self.invoke('rollback').returncode,0);self.assertEqual(first,self.p.joinpath('current').resolve())
 def test_bad_checksum_does_not_change_current(self):
  self.assertEqual(self.invoke('install','--bundle',str(self.a)).returncode,0);before=self.p.joinpath('current').resolve();(self.b/'SHA256SUMS').write_text('0'*64+'  b.tar\n');self.assertNotEqual(self.invoke('install','--bundle',str(self.b)).returncode,0);self.assertEqual(before,self.p.joinpath('current').resolve())
 def test_verify_detects_installed_drift(self):
  self.assertEqual(self.invoke('install','--bundle',str(self.a)).returncode,0);self.p.joinpath('current/payload').write_text('tamper');self.assertNotEqual(self.invoke('verify').returncode,0)
if __name__=='__main__':unittest.main()