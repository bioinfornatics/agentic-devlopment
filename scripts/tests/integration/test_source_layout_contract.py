#!/usr/bin/env python3
import json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class SourceLayoutContractTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.layout=json.loads((ROOT/'harness/source-layout.json').read_text())
 def test_canonical_source_roots_are_under_src(self):
  self.assertEqual(self.layout['canonicalSources'],{'agents':'src/agents','skills':'src/skills','recipes':'src/recipes','plugins':'src/plugins','apps':'src/app'})
 def test_runtime_projection_is_generated_and_not_editable(self):
  r=self.layout['runtimeProjection'];self.assertTrue(r['generated']);self.assertFalse(r['editable']);self.assertEqual(r['projectAgents'],'.agents');self.assertEqual(r['projectGoose'],'.goose')
 def test_external_skills_are_lock_resolved(self):
  self.assertEqual(self.layout['externalSources']['lock'],'harness/external-skills.lock.json');self.assertIn('<lock-digest>',self.layout['externalSources']['resolved'])
 def test_apps_declare_skill_plugin_or_standalone_outputs(self):
  d=self.layout['appPackageDescriptor'];self.assertEqual(d['file'],'app-package.json');self.assertIn('companion-skill',d['kinds']);self.assertIn('plugin-binary',d['kinds']);self.assertIn('runtimePath',d['outputFields'])
 def test_bootstrap_activation_and_rollback_commands_are_named(self):
  self.assertEqual(self.layout['projectionCommands'],{'bootstrap':'make bootstrap-runtime','activate':'make activate-runtime','verify':'make verify-runtime','rollback':'make rollback-runtime','clean':'make clean-runtime'})
  spec=(ROOT/'docs/specs/source-runtime-separation.md').read_text()
  for target in ('bootstrap-runtime','activate-runtime','verify-runtime','rollback-runtime','clean-runtime'):self.assertIn(target,spec)
 def test_manifest_distinguishes_current_runtime_from_target_source(self):
  manifest=json.loads((ROOT/'harness/source-manifest.json').read_text())
  for component in manifest['components']:
   self.assertNotIn('sourcePath',component)
   if component['ownership']=='internal':self.assertNotIn('currentRuntimePath',component);self.assertTrue(component['targetSourcePath'].startswith('src/'));self.assertEqual(component['migrationState'],'canonical-source')
   else:self.assertIsNone(component['currentRuntimePath']);self.assertIsNone(component['targetSourcePath']);self.assertEqual(component['migrationState'],'external-lock-only')
 def test_spec_keeps_root_agents_and_goose_operational_only(self):
  s=(ROOT/'docs/specs/source-runtime-separation.md').read_text();self.assertIn('operational outputs only',s);self.assertIn('src/app/<name>/app-package.json',s);self.assertIn('External skills are never canonical source',s)
 def test_json_schema_accepts_source_manifest(self):
  import jsonschema
  manifest=json.loads((ROOT/'harness/source-manifest.json').read_text());schema=json.loads((ROOT/'harness/schemas/source-manifest.schema.json').read_text());jsonschema.validate(manifest,schema)
if __name__=='__main__':unittest.main()