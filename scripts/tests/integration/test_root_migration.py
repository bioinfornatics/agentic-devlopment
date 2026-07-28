#!/usr/bin/env python3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class MigrationPlanTest(unittest.TestCase):
 def test_plan_has_remote_backup_gate_and_rollback(self):
  s=(ROOT/'docs/migration/root-rewrite-plan.md').read_text();self.assertIn('git@github.com:bioinfornatics/agentic-devlopment.git',s);self.assertIn('pre-harness-rewrite-2026-07',s);self.assertIn('Force push is prohibited',s);self.assertIn('Rollback',s);self.assertIn('No tag, push',s)
 def test_ignore_covers_generated_classes(self):
  s=(ROOT/'.gitignore').read_text();
  for x in ('node_modules/','dist/','__pycache__/','*.db','*.db-wal','*.db-shm','.vite/'):self.assertIn(x,s)
if __name__=='__main__':unittest.main()
