#!/usr/bin/env python3
import hashlib,json,os,subprocess,tarfile,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def run(cmd,**kw):return subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,**kw)
class EvalHubCompanionTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.root=Path(cls.tmp.name);cls.prebuilt=cls.root/'prebuilt';identity=json.dumps({'schema':'eval-hub-companion-self-check-v1','runtime':'test','operationalModeStarted':False});cls.prebuilt.write_text('#!/bin/sh\nif [ "$1" = "--companion-self-check" ]; then echo '+repr(identity)+'; exit 0; fi\necho Usage:\n');cls.prebuilt.chmod(0o755);cls.bundle=cls.root/'bundle';r=run(['make','-f','src/app/eval-hub/companion.Makefile','--no-print-directory','package','VERSION=test','OUTPUT='+str(cls.bundle),'LICENSE_SPDX=Apache-2.0','PREBUILT_BINARY='+str(cls.prebuilt)]);assert r.returncode==0,r.stderr;cls.prefix=cls.root/'prefix with spaces';r=run(['python3','scripts/install-eval-hub-companion.py','--bundle',str(cls.bundle),'--prefix',str(cls.prefix)]);assert r.returncode==0,r.stderr;cls.installed=cls.prefix/'current';cls.launch=cls.installed/'.agents/skills/eval-hub/scripts/eval-hub'
 @classmethod
 def tearDownClass(cls):cls.tmp.cleanup()
 def env(self):
  home=self.root/'clean-home';home.mkdir(exist_ok=True);return {**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'config'),'XDG_DATA_HOME':str(home/'data'),'XDG_STATE_HOME':str(home/'state'),'EVAL_HUB_COMPANION_ROOT':str(self.installed)}
 def test_clean_home_help_and_self_check_without_node_modules(self):
  self.assertFalse(any('node_modules' in p.parts for p in self.installed.rglob('*')));h=run([str(self.launch),'--help'],env=self.env());self.assertEqual(h.returncode,0,h.stderr);s=run([str(self.launch),'--companion-self-check'],env=self.env());self.assertEqual(s.returncode,0,s.stderr);self.assertFalse(json.loads(s.stdout)['operationalModeStarted'])
 def test_manifest_sbom_license_provenance_and_boundary(self):
  m=json.loads((self.bundle/'companion.json').read_text());self.assertFalse(m['coreHarnessIncluded']);self.assertRegex(m['sourceCommit'],r'^[0-9a-f]{40}$');self.assertRegex(m['binarySha256'],r'^[0-9a-f]{64}$');self.assertRegex(m['sourceTreeSha256'],r'^[0-9a-f]{64}$');self.assertIn('runtimeReleaseSha256',m);self.assertTrue((self.bundle/'sbom.cdx.json').exists());self.assertTrue(json.loads((self.bundle/'LICENSE-ASSERTION.json').read_text())['distributionAllowed'])
  with tarfile.open(next(self.bundle.glob('*.tar'))) as archive:self.assertFalse(any('node_modules' in n or '/src/' in n or 'evaluation.db' in n for n in archive.getnames()))
 def test_missing_and_corrupt_binary_fail_before_exec(self):
  binary=self.installed/'bin/eval-hub';saved=binary.read_bytes();binary.unlink();self.assertEqual(run([str(self.launch)],env=self.env()).returncode,66);binary.write_bytes(saved);binary.chmod(0o755);binary.write_bytes(saved+b'x');self.assertEqual(run([str(self.launch)],env=self.env()).returncode,65);binary.write_bytes(saved);binary.chmod(0o755)
 def test_exit_code_propagation(self):
  fake=self.root/'fake';fake.write_text('#!/bin/sh\nexit 23\n');fake.chmod(0o755);sumfile=self.root/'fake.sha';sumfile.write_text(hashlib.sha256(fake.read_bytes()).hexdigest()+'  fake\n');env=self.env();env.update({'EVAL_HUB_BIN':str(fake),'EVAL_HUB_SHA256_FILE':str(sumfile)});self.assertEqual(run([str(self.launch)],env=env).returncode,23)
 def test_fixed_path_build_reproducible(self):
  other=self.root/'other';r=run(['make','-f','src/app/eval-hub/companion.Makefile','--no-print-directory','package','VERSION=test','OUTPUT='+str(other),'LICENSE_SPDX=Apache-2.0','PREBUILT_BINARY='+str(self.prebuilt)]);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(next(self.bundle.glob('*.tar')).read_bytes(),next(other.glob('*.tar')).read_bytes())
 def test_core_source_manifest_still_excludes_eval_hub(self):
  m=json.loads((ROOT/'harness/source-manifest.json').read_text());self.assertIn('src/app/eval-hub',m['releaseExcludes']);self.assertFalse(any(c['name']=='eval-hub' for c in m['components']))
 def test_noassertion_fails_closed(self):
  out=self.root/'unlicensed';r=run(['make','-f','src/app/eval-hub/companion.Makefile','--no-print-directory','package','VERSION=x','OUTPUT='+str(out)]);self.assertNotEqual(r.returncode,0);self.assertFalse(any(out.glob('*.tar')))
 def test_makefile_rejects_invalid_target_and_version(self):
  common=['make','-f','src/app/eval-hub/companion.Makefile','--no-print-directory','package','OUTPUT='+str(self.root/'bad'),'LICENSE_SPDX=Apache-2.0','PREBUILT_BINARY='+str(self.prebuilt)];self.assertNotEqual(run(common+['VERSION=x','TARGET=darwin']).returncode,0);self.assertNotEqual(run(common+['VERSION=1/merge']).returncode,0)
 def test_custom_python_packager_removed(self):
  self.assertFalse((ROOT/'scripts/package-eval-hub-companion.py').exists());self.assertIn('make -f src/app/eval-hub/companion.Makefile',(ROOT/'.github/workflows/harness-release.yml').read_text())
if __name__=='__main__':unittest.main()
