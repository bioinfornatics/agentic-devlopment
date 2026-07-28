#!/usr/bin/env python3
import json,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class ReleaseEvalTest(unittest.TestCase):
 def test_all_active_external_have_three_scenarios(self):
  lock=json.loads((ROOT/'harness/external-skills.lock.json').read_text())
  for x in lock['skills']:
   if x['active']:
    p=ROOT/'evals/skills'/(x['name']+'.json');self.assertTrue(p.is_file(),x['name']);self.assertGreaterEqual(len(json.loads(p.read_text())),3)
 def test_dry_run_records_three_digests_and_no_eval_hub(self):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);(r/'release.json').write_text(json.dumps({'lockSha256':'abc','files':[]}));g=r/'goose';g.write_text('binary');x=subprocess.run(['python3','scripts/evaluate-harness-release.py','--release',str(r),'--goose-cli',str(g),'--dry-run'],cwd=ROOT,capture_output=True,text=True);self.assertEqual(x.returncode,0,x.stderr);e=json.loads(x.stdout);self.assertIn('releaseDigest',e);self.assertIn('lockSha256',e);self.assertIn('gooseBinarySha256',e);self.assertFalse(e['evalHubIncludedInRelease']);self.assertEqual(len(e['externalSkills']),6)
 def test_release_drift_is_rejected_before_run(self):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);(r/'payload').write_text('bad');(r/'release.json').write_text(json.dumps({'lockSha256':'x','files':[{'path':'payload','sha256':'0'*64}]}));g=r/'g';g.write_text('x');x=subprocess.run(['python3','scripts/evaluate-harness-release.py','--release',str(r),'--goose-cli',str(g),'--dry-run'],cwd=ROOT,capture_output=True);self.assertNotEqual(x.returncode,0)
if __name__=='__main__':unittest.main()
