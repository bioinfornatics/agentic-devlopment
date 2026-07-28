#!/usr/bin/env python3
import hashlib,json,os,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def run(cmd,cwd=ROOT):return subprocess.run(cmd,cwd=cwd,capture_output=True,text=True)
def fixture(root,label):
 internal=root/(label+'-internal');external=root/(label+'-external');(internal/'.agents/agents').mkdir(parents=True);(internal/'.agents/skills/internal').mkdir(parents=True);(internal/'.agents/plugins/p').mkdir(parents=True);(internal/'.goose/recipes').mkdir(parents=True);(internal/'.agents/agents/a.md').write_text('a');(internal/'.agents/skills/internal/SKILL.md').write_text('i');(internal/'.agents/plugins/p/plugin.json').write_text('{}');(internal/'.goose/recipes/r.yaml').write_text('title: r');(internal/'build-manifest.json').write_text('{}');external.mkdir();(external/'external').mkdir();(external/'external/SKILL.md').write_text('e');(external/'resolved.json').write_text('{}');return internal,external
class RuntimeProjectionTest(unittest.TestCase):
 def test_project_activate_verify_and_rollback(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);project=root/'project';project.mkdir();runtime=project/'build/harness/runtime';i1,e1=fixture(root,'one');r=run(['python3',str(ROOT/'scripts/project-harness-runtime.py'),'--internal',str(i1),'--external',str(e1),'--runtime-root',str(runtime)]);self.assertEqual(r.returncode,0,r.stderr);d1=r.stdout.strip();self.assertEqual(run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'activate','--runtime-root',str(runtime),'--project-root',str(project)]).returncode,0);self.assertEqual(run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'verify','--runtime-root',str(runtime),'--project-root',str(project)]).returncode,0);self.assertTrue((project/'.agents/skills/external/SKILL.md').is_file());self.assertTrue((project/'.goose/recipes/r.yaml').is_file());i2,e2=fixture(root,'two');(i2/'.agents/agents/a.md').write_text('changed');r=run(['python3',str(ROOT/'scripts/project-harness-runtime.py'),'--internal',str(i2),'--external',str(e2),'--runtime-root',str(runtime)]);d2=r.stdout.strip();self.assertNotEqual(d1,d2);self.assertEqual(run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'activate','--runtime-root',str(runtime),'--project-root',str(project)]).returncode,0);self.assertEqual(run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'rollback','--runtime-root',str(runtime),'--project-root',str(project)]).returncode,0);self.assertEqual((runtime/'current').resolve().name,d1)
 def test_tamper_is_detected(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);project=root/'project';project.mkdir();runtime=project/'build/harness/runtime';i,e=fixture(root,'one');run(['python3',str(ROOT/'scripts/project-harness-runtime.py'),'--internal',str(i),'--external',str(e),'--runtime-root',str(runtime)]);run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'activate','--runtime-root',str(runtime),'--project-root',str(project)]);(project/'.agents/agents/a.md').write_text('tamper');self.assertNotEqual(run(['python3',str(ROOT/'scripts/manage-project-runtime.py'),'verify','--runtime-root',str(runtime),'--project-root',str(project)]).returncode,0)
 def test_root_make_declares_public_interface(self):
  text=(ROOT/'Makefile').read_text()
  for name in ('bootstrap-runtime','activate-runtime','verify-runtime','rollback-runtime','clean-runtime'):self.assertIn(name+':',text)
if __name__=='__main__':unittest.main()
