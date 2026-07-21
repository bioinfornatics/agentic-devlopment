#!/usr/bin/env python3
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "beads-readonly-evidence.py"

class BeadsReadonlyEvidenceTest(unittest.TestCase):
    def test_current_beads_schema_reports_types_and_dependencies(self):
        records = [
            {"id":"epic-1","status":"open","issue_type":"epic","priority":1},
            {"id":"task-1","status":"open","issue_type":"task","priority":2,
             "parent":"epic-1","dependency_count":1,
             "dependencies":[{"issue_id":"task-1","depends_on_id":"gate-1","type":"blocks"}]},
        ]
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "issues.jsonl"
            path.write_text("".join(json.dumps(x)+"\n" for x in records))
            result = subprocess.run(["python3", str(SCRIPT), "--issues", str(path), "--format", "json"], check=True, text=True, capture_output=True)
        data = json.loads(result.stdout)
        self.assertEqual(data["by_type"], {"epic": 1, "task": 1})
        self.assertEqual(data["dependency_link_counts"]["dependencies"], 1)
        self.assertEqual(data["dependency_type_counts"], {"blocks": 1})
        self.assertEqual(data["blocked_or_dependent_count"], 1)
        self.assertEqual(data["epic_or_parent_link_count"], 1)

if __name__ == "__main__": unittest.main()
