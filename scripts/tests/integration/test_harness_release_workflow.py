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
  text=(ROOT/'.github/workflows/harness-release.yml').read_text();self.assertIn('make -f companions/eval-hub/Makefile',text);self.assertIn('eval-hub-companion-linux-x86_64',text);self.assertIn('dist/eval-hub-companion/**',text);self.assertGreaterEqual(text.count("if: startsWith(github.ref, 'refs/tags/harness-v')"),3);self.assertIn('companions/**',text);self.assertIn('apps/eval-hub/**',text);self.assertNotIn('dist/harness-ci/release/eval-hub',text)
 def test_native_install_is_ci_portable(self):
  release=(ROOT/'.github/workflows/harness-release.yml').read_text();hub=(ROOT/'.github/workflows/eval-hub.yml').read_text();scripts=(ROOT/'.github/workflows/eval-scripts.yml').read_text();requirements=(ROOT/'requirements-ci.txt').read_text();self.assertIn('--ignore-scripts',release);self.assertIn('rebuild better-sqlite3',release);self.assertIn('--ignore-scripts',hub);self.assertIn('rebuild better-sqlite3',hub);self.assertIn('oven-sh/setup-bun@v2',scripts);self.assertIn('PyYAML==6.0.2',requirements);self.assertIn('Install Python test dependencies',release);self.assertIn('--skip-tests',release);self.assertIn('Resolve release version',release);self.assertIn('0.0.0-pr',release)
if __name__=='__main__':unittest.main()
