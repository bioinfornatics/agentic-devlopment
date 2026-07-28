#!/usr/bin/env python3
import json,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class OwnershipConsistencyTest(unittest.TestCase):
 def test_manifest_drives_external_inventory(self):
  m=json.loads((ROOT/'harness/source-manifest.json').read_text());ext={c['name'] for c in m['components'] if c['kind']=='skill' and c['ownership']=='external'};self.assertTrue({'domain-modeling','grill-me','grill-with-docs','grilling'}<=ext)
 def test_external_skills_skip_internal_size_rules(self):
  r=subprocess.run(['python3','scripts/check-consistency.py'],cwd=ROOT,capture_output=True,text=True);self.assertNotIn('HJ052: grill-me',r.stdout);self.assertNotIn('HJ052: grill-with-docs',r.stdout);self.assertNotIn('Active skills drift',r.stdout)
if __name__=='__main__':unittest.main()
