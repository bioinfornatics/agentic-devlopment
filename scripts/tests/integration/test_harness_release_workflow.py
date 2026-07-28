#!/usr/bin/env python3
import unittest,yaml
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class ReleaseWorkflowTest(unittest.TestCase):
 def test_workflow_has_pr_tag_and_least_permissions(self):
  w=yaml.safe_load((ROOT/'.github/workflows/harness-release.yml').read_text());self.assertIn('pull_request',w[True]);self.assertEqual(w[True]['push']['tags'],['harness-v*']);self.assertEqual(w['permissions'],{'contents':'read'});self.assertEqual(w['jobs']['publish']['permissions'],{'contents':'write'})
 def test_eval_hub_is_built_but_not_release_input(self):
  text=(ROOT/'.github/workflows/harness-release.yml').read_text();self.assertIn('@harness/eval-hub build',text);self.assertIn('scripts/ci-harness-release.py',text);self.assertNotIn('--internal apps/eval-hub',text)
 def test_optional_companion_is_separate_artifact(self):
  text=(ROOT/'.github/workflows/harness-release.yml').read_text();self.assertIn('package-eval-hub-companion.py',text);self.assertIn('eval-hub-companion-linux-x86_64',text);self.assertIn('dist/eval-hub-companion/**',text);self.assertNotIn('dist/harness-ci/release/eval-hub',text)
if __name__=='__main__':unittest.main()
