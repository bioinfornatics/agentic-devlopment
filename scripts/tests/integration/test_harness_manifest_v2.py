#!/usr/bin/env python3
import json,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class ManifestV2Test(unittest.TestCase):
 def setUp(self):
  self.m=json.loads((ROOT/'harness/source-manifest.json').read_text());self.l=json.loads((ROOT/'harness/external-skills.lock.json').read_text())
 def test_validator_accepts_repository(self):
  r=subprocess.run(['python3','scripts/validate-harness-manifests.py'],cwd=ROOT);self.assertEqual(r.returncode,0)
 def test_every_runtime_component_classified(self):
  inv=json.loads((ROOT/'harness/runtime-inventory.json').read_text());expected={(x['kind'],x['name']) for x in inv['components'] if x['kind']!='script'};got={(x['kind'],x['name']) for x in self.m['components']};self.assertEqual(expected,got)
 def test_all_active_external_are_pinned_licensed_and_hashed(self):
  for x in self.l['skills']:
   if not x['active']:continue
   self.assertRegex(x['source']['revision'],r'^[0-9a-f]{40}$');self.assertRegex(x['integrity']['digest'],r'^[0-9a-f]{64}$');self.assertNotEqual(x['license']['spdx'],'NOASSERTION');self.assertTrue(x['license']['releaseAllowed'])
 def test_inactive_legacy_entries_never_release(self):
  inactive={x['name'] for x in self.l['skills'] if not x['active']};self.assertEqual(inactive,{'atomic-design-fundamentals','design-critique-case-studies'});self.assertTrue(all(not x['license']['releaseAllowed'] for x in self.l['skills'] if not x['active']))
 def test_names_and_dependencies_are_unique(self):
  names=[x['name'] for x in self.l['skills']];self.assertEqual(len(names),len(set(names)));known=set(names)
  for x in self.l['skills']:
   for d in x['dependencies']:self.assertIn(d.removeprefix('skill:'),known)
 def test_tamper_is_rejected(self):
  p=ROOT/'.agents/skills/grilling/SKILL.md';old=p.read_bytes()
  try:
   p.write_bytes(old+b'\n# tamper\n');r=subprocess.run(['python3','scripts/validate-harness-manifests.py'],cwd=ROOT,capture_output=True,text=True);self.assertNotEqual(r.returncode,0);self.assertIn('integrity drift',r.stderr)
  finally:p.write_bytes(old)
if __name__=='__main__':unittest.main()