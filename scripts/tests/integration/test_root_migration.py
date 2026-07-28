#!/usr/bin/env python3
import subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class MigrationPlanTest(unittest.TestCase):
 def test_plan_has_remote_backup_gate_and_rollback(self):
  s=(ROOT/'docs/migration/root-rewrite-plan.md').read_text();self.assertIn('git@github.com:bioinfornatics/agentic-devlopment.git',s);self.assertIn('pre-harness-rewrite-2026-07',s);self.assertIn('Force push is prohibited',s);self.assertIn('Rollback',s);self.assertIn('No tag, push',s)
 def test_ignore_covers_generated_classes(self):
  s=(ROOT/'.gitignore').read_text()
  for x in ('node_modules/','dist/','__pycache__/','*.db','*.db-wal','*.db-shm','.vite/','/.agents','/.goose','/build/'):self.assertIn(x,s)
 def test_canonical_src_layout_and_no_tracked_runtime_roots(self):
  for p in ('src/agents','src/skills','src/recipes','src/plugins','src/app'):self.assertTrue((ROOT/p).is_dir(),p)
  self.assertEqual(subprocess.check_output(['git','ls-files','.agents','.goose','apps','companions'],cwd=ROOT,text=True).strip(),'')
if __name__=='__main__':unittest.main()
