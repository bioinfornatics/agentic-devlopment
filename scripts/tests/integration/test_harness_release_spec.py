#!/usr/bin/env python3
import json, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class HarnessReleaseSpecTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.inv=json.loads((ROOT/'harness/runtime-inventory.json').read_text())
 def test_all_disk_components_are_in_inventory(self):
  got={(x['kind'],x['name']) for x in self.inv['components']}; expected=set()
  expected|={('skill',p.name) for p in (ROOT/'.agents/skills').iterdir() if p.is_dir()}
  expected|={('agent',p.stem) for p in (ROOT/'.agents/agents').glob('*.md')}
  expected|={('recipe',p.stem) for p in (ROOT/'.goose/recipes').glob('*.yaml')}
  expected|={('plugin',p.name) for p in (ROOT/'.agents/plugins').iterdir() if (p/'plugin.json').is_file()}
  self.assertTrue(expected<=got, expected-got)
 def test_scripts_have_build_contract(self):
  required={'path','ownership','language','build','runtime','package'}
  for c in self.inv['components']:
   if c['kind']=='script': self.assertFalse(required-set(c),c)
 def test_external_classification(self):
  ext={c['name'] for c in self.inv['components'] if c['kind']=='skill' and c['ownership']=='external'}
  self.assertTrue({'domain-modeling','grill-me','grill-with-docs','grilling'}<=ext)
 def test_release_excludes_eval_hub_and_evaluates_externals(self):
  s=self.inv['releaseScope']; self.assertIn('eval-hub',s['excludeComponents']); self.assertTrue(s['externalSkillsEvaluated'])
 def test_spec_traces_o1_o8(self):
  text=(ROOT/'docs/specs/harness-release-v1.md').read_text()
  for i in range(1,9): self.assertIn(f'O{i}',text)
 def test_required_target(self): self.assertIn({'os':'linux','arch':'x86_64','tier':'required'},self.inv['targets'])
if __name__=='__main__': unittest.main()
