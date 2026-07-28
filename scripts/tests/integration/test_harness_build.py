#!/usr/bin/env python3
import json,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class BuildTest(unittest.TestCase):
 def runbuild(self,out):return subprocess.run(['python3','scripts/build-harness.py','--output',str(out),'--skip-compile'],cwd=ROOT,capture_output=True,text=True)
 def test_allowlist_build_excludes_eval_hub_and_mutable_data(self):
  with tempfile.TemporaryDirectory() as t:
   out=Path(t)/'build';r=self.runbuild(out);self.assertEqual(r.returncode,0,r.stderr);self.assertTrue((out/'.agents/skills').exists());self.assertTrue((out/'.agents/agents').exists());self.assertTrue((out/'.goose/recipes').exists());self.assertFalse((out/'apps').exists());self.assertFalse((out/'evals').exists());self.assertFalse(any(p.name.endswith(('.db','-wal','-shm')) for p in out.rglob('*')));self.assertFalse(any('node_modules' in p.parts for p in out.rglob('*')))
 def test_build_manifest_is_deterministic(self):
  with tempfile.TemporaryDirectory() as t:
   a=Path(t)/'a';b=Path(t)/'b';self.assertEqual(self.runbuild(a).returncode,0);self.assertEqual(self.runbuild(b).returncode,0);ma=json.loads((a/'build-manifest.json').read_text());mb=json.loads((b/'build-manifest.json').read_text());self.assertEqual(ma,mb)
 def test_internal_components_are_all_packaged(self):
  with tempfile.TemporaryDirectory() as t:
   out=Path(t)/'b';self.assertEqual(self.runbuild(out).returncode,0);m=json.loads((out/'build-manifest.json').read_text());src=json.loads((ROOT/'harness/source-manifest.json').read_text());self.assertEqual({x['id'] for x in m['components']},{x['id'] for x in src['components'] if x['ownership']=='internal'})
 def test_build_does_not_modify_plugin_source(self):
  import hashlib
  src=ROOT/'.agents/plugins/loop-breaker'
  def digest():
   h=hashlib.sha256()
   for p in sorted(x for x in src.rglob('*') if x.is_file() and 'node_modules' not in x.parts and 'bin' not in x.parts and 'data' not in x.parts):h.update(p.relative_to(src).as_posix().encode());h.update(p.read_bytes())
   return h.hexdigest()
  before=digest()
  with tempfile.TemporaryDirectory() as td:self.assertEqual(self.runbuild(Path(td)/'b').returncode,0)
  self.assertEqual(before,digest())
if __name__=='__main__':unittest.main()