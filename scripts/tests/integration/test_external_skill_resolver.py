#!/usr/bin/env python3
import json,shutil,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class ResolverTest(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.root=Path(self.t.name);self.src=self.root/'src';self.src.mkdir()
  lock=json.loads((ROOT/'harness/external-skills.lock.json').read_text());self.lock=self.root/'lock.json'
  active=[]
  import hashlib
  for x in lock['skills']:
   if not x['active']:continue
   p=self.src/x['name'];p.mkdir();(p/'SKILL.md').write_text('name: '+x['name']+'\n');h=hashlib.sha256();h.update(b'SKILL.md'+bytes([0]));h.update((p/'SKILL.md').read_bytes());y=dict(x);y['integrity']={'algorithm':'sha256-tree-v1','digest':h.hexdigest()};active.append(y)
  lock['skills']=active;self.lock.write_text(json.dumps(lock))
 def tearDown(self):self.t.cleanup()
 def invoke(self,*extra):return subprocess.run(['python3',str(ROOT/'scripts/resolve-external-skills.py'),'--lock',str(self.lock),'--staging',str(self.root/'out'),'--source-root',str(self.src),*extra],cwd=ROOT,capture_output=True,text=True)
 def test_resolves_deterministically_without_home_install(self):
  a=self.invoke();self.assertEqual(a.returncode,0,a.stderr);first=(self.root/'out/resolved.json').read_bytes();b=self.invoke();self.assertEqual(b.returncode,0,b.stderr);self.assertEqual(first,(self.root/'out/resolved.json').read_bytes());self.assertFalse((self.root/'home').exists())
 def test_tamper_fails_and_keeps_previous(self):
  self.assertEqual(self.invoke().returncode,0);sentinel=(self.root/'out/resolved.json').read_bytes();skill=next(self.src.iterdir());(skill/'SKILL.md').write_text('tamper');r=self.invoke();self.assertNotEqual(r.returncode,0);self.assertEqual(sentinel,(self.root/'out/resolved.json').read_bytes())
 def test_offline_cache_miss_is_fail_closed(self):
  r=subprocess.run(['python3',str(ROOT/'scripts/resolve-external-skills.py'),'--lock',str(self.lock),'--staging',str(self.root/'missing'),'--offline','--cache',str(self.root/'cache')],cwd=ROOT,capture_output=True,text=True);self.assertNotEqual(r.returncode,0);self.assertFalse((self.root/'missing').exists())
if __name__=='__main__':unittest.main()