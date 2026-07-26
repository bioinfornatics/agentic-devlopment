#!/usr/bin/env python3
"""Regression probes for meaningful active recipe metadata validation."""
from __future__ import annotations
import json, shutil, subprocess, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
class RecipeMetadataValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        for relative in ("scripts/check-recipe-metadata.py", ".specs/harness/recipe-workflow-metadata.json", ".specs/schemas/recipe-workflow-metadata.schema.json"):
            target=self.root/relative; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(ROOT/relative,target)
        shutil.copytree(ROOT/".goose/recipes",self.root/".goose/recipes")
    def tearDown(self) -> None: self.temp.cleanup()
    def run_validator(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(["python3","scripts/check-recipe-metadata.py"],cwd=self.root,text=True,capture_output=True,check=False)
    def test_active_contract_passes(self) -> None:
        result=self.run_validator(); self.assertEqual(result.returncode,0,result.stdout+result.stderr)
    def test_extra_metadata_property_fails_schema(self) -> None:
        path=self.root/".specs/harness/recipe-workflow-metadata.json"; data=json.loads(path.read_text()); data["recipes"]["implement"]["unexpected"]=True; path.write_text(json.dumps(data))
        result=self.run_validator(); self.assertNotEqual(result.returncode,0); self.assertIn("Additional properties are not allowed",result.stdout)
    def test_recipe_max_retries_drift_fails(self) -> None:
        path=self.root/".goose/recipes/implement.yaml"; text=path.read_text(); self.assertIn("max_retries: 3",text); path.write_text(text.replace("max_retries: 3","max_retries: 99",1))
        result=self.run_validator(); self.assertNotEqual(result.returncode,0); self.assertIn("implement retry",result.stdout)
if __name__ == "__main__": unittest.main()
