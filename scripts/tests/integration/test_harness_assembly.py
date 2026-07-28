#!/usr/bin/env python3
import json,subprocess,tarfile,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class AssembleTest(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();r=Path(self.t.name);self.i=r/'i';self.e=r/'e';self.i.mkdir();self.e.mkdir();(self.i/'build-manifest.json').write_text('{}');(self.i/'agent').mkdir();(self.i/'agent/a').write_text('a');(self.e/'resolved.json').write_text('{}');(self.e/'skill').mkdir();(self.e/'skill/s').write_text('s');self.r=r
 def tearDown(self):self.t.cleanup()
 def make(self,n):
  o=self.r/n;r=subprocess.run(['python3','scripts/assemble-harness-release.py','--internal',str(self.i),'--external',str(self.e),'--output',str(o),'--version','1.0.0'],cwd=ROOT,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);return o
 def test_reproducible_archive_and_no_eval_hub(self):
  a=self.make('a');b=self.make('b');aa=next(a.glob('*.tar'));bb=next(b.glob('*.tar'));self.assertEqual(aa.read_bytes(),bb.read_bytes())
  with tarfile.open(aa) as t:self.assertFalse(any('eval-hub' in n or n.startswith('apps/') or n.startswith('evals/') for n in t.getnames()))
 def test_manifest_and_licenses(self):
  o=self.make('o');self.assertTrue(json.loads((o/'release.json').read_text())['files']);self.assertIn('domain-modeling',json.loads((o/'THIRD_PARTY_LICENSES.json').read_text()));self.assertTrue((o/'sbom.cdx.json').exists())
 def test_mutable_db_rejected(self):
  (self.i/'bad.db').write_text('x');r=subprocess.run(['python3','scripts/assemble-harness-release.py','--internal',str(self.i),'--external',str(self.e),'--output',str(self.r/'bad'),'--version','1'],cwd=ROOT,capture_output=True);self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main()
