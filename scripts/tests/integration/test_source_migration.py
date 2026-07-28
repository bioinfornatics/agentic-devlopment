#!/usr/bin/env python3
import json,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class SourceMigrationTest(unittest.TestCase):
 def test_internal_sources_exist_only_under_src(self):
  m=json.loads((ROOT/'harness/source-manifest.json').read_text())
  for c in m['components']:
   if c['ownership']=='internal':self.assertTrue((ROOT/c['targetSourcePath']).exists(),c['id']);self.assertNotIn('currentRuntimePath',c)
   else:self.assertIsNone(c['targetSourcePath']);self.assertEqual(c['migrationState'],'external-lock-only')
 def test_external_skills_are_not_committed_as_internal_source(self):
  lock=json.loads((ROOT/'harness/external-skills.lock.json').read_text())
  for item in lock['skills']:
   if item['active']:self.assertFalse((ROOT/'src/skills'/item['name']).exists(),item['name'])
 def test_apps_have_valid_package_descriptors(self):
  required={'name','kind','entrypoint','targets','outputs'}
  for app in ('eval-hub','loop-breaker','kg','kg-visualizer'):
   p=ROOT/'src/app'/app/'app-package.json';self.assertTrue(p.is_file());d=json.loads(p.read_text());self.assertFalse(required-set(d));self.assertTrue(all('runtimePath' in o and 'packageProfile' in o for o in d['outputs']))
 def test_runtime_roots_are_generated_links_after_bootstrap(self):
  for name in ('.agents','.goose'):
   p=ROOT/name;self.assertTrue(p.is_symlink(),name);self.assertIn('build/harness/runtime/current',str(p.readlink()))
 def test_no_tracked_runtime_or_legacy_app_sources(self):
  tracked=subprocess.check_output(['git','ls-files','.agents','.goose','apps','companions'],cwd=ROOT,text=True).splitlines();self.assertEqual(tracked,[])
 def test_source_tools_do_not_read_runtime_as_source(self):
  files=['scripts/check-consistency.py','scripts/check-recipe-metadata.py','scripts/generate-tables.py','scripts/build-harness.py','scripts/export-harness-graph.py','scripts/context-budget.py']
  for name in files:
   text=(ROOT/name).read_text();self.assertNotIn('ROOT / '+chr(34)+'.agents',text);self.assertNotIn('ROOT/'+chr(39)+'.agents',text);self.assertNotIn('ROOT / '+chr(34)+'.goose',text);self.assertNotIn('ROOT/'+chr(39)+'.goose',text)
if __name__=='__main__':unittest.main()