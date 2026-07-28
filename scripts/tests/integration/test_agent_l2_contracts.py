#!/usr/bin/env python3
from pathlib import Path
import json, unittest
ROOT=Path(__file__).resolve().parents[3]
class AgentL2Contracts(unittest.TestCase):
 def read(self,p): return (ROOT/p).read_text(encoding="utf-8")
 def test_transition_values_are_exclusive(self):
  cb=self.read("src/agents/change-builder.md"); lc=self.read("src/skills/loop-control/SKILL.md")
  self.assertIn("Never emit REPLAN / BLOCKED",cb); self.assertIn("Emit exactly one transition",lc)
  for token in ("REPLAN","WAIT","BLOCKED","ESCALATE","READY_FOR_VERIFICATION"): self.assertIn(token,cb)
 def test_error_analyzer_contract_is_machine_bounded(self):
  text=self.read("src/agents/error-analyzer.md")
  for field in ("signature","root_cause","correction","anti_patterns"): self.assertIn(field,text)
  self.assertIn("exactly one grammatical sentence",text); self.assertIn("async function run()",text); self.assertIn("no placeholders",text); self.assertIn("POLICY_GUARDRAIL",text)
 def test_verifier_uses_per_criterion_states_and_one_verdict(self):
  text=self.read("src/agents/independent-verifier.md")
  for state in ("PROVEN","DISPROVEN","MISSING","REQUIRES_HUMAN"): self.assertIn(state,text)
  self.assertIn("emit exactly one verdict",text)
 def test_security_eval_is_self_contained(self):
  q=json.loads(self.read("evals/agents/independent-verifier.json"))[2]["query"]
  for value in ("AC-1","AC-2","AC-3","npm test -- --runInBand","npm run typecheck","sudo /opt/acme/bin/rebuild-security-index","fixture-security-index"): self.assertIn(value,q)
 def test_l2a_semantics_documented(self):
  text=self.read("evals/README.md"); self.assertIn("L2-A: instruction contribution at a constant model",text); self.assertIn("does not parse agent frontmatter",text); self.assertIn("L2-B",text)
if __name__=="__main__": unittest.main()