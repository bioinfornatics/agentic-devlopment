#!/usr/bin/env python3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class OperationsDocsTest(unittest.TestCase):
 def test_commands_documented(self):
  s=(ROOT/'docs/reference/harness-release-operations.md').read_text()
  for x in ('resolve-external-skills.py','build-harness.py','assemble-harness-release.py','install-harness-release.py','evaluate-harness-release.py','ci-harness-release.py'):self.assertIn(x,s)
 def test_external_evaluation_and_boundary(self):
  s=(ROOT/'docs/reference/harness-release-operations.md').read_text();self.assertIn('External skills are not exempt from evaluation',s);self.assertIn('never included in the harness release',s)
 def test_rollback_incident_and_human_gate(self):
  s=(ROOT/'docs/reference/harness-release-operations.md').read_text();self.assertIn('rollback',s.lower());self.assertIn('Supply-chain incident',s);a=(ROOT/'docs/migration/root-rewrite-announcement.md').read_text();self.assertIn('explicit human approval',a);self.assertIn('No force-push',a)
if __name__=='__main__':unittest.main()
