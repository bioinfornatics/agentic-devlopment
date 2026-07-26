import json, subprocess, sys, unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from loop_transition_guard import evaluate
NOW = "2026-07-26T12:00:00Z"
def state(**changes):
    value = {"transition":"CONTINUE", "loop_iteration":1, "loop_max_iterations":4, "loop_no_progress_count":0, "loop_max_no_progress":2, "next_task":"run.2", "expected_proof":"unittest"}
    value.update(changes); return value
class GuardTests(unittest.TestCase):
    def stop(self, value, reason, transition="ABORT"):
        got=evaluate(value,NOW); self.assertEqual((False,transition,reason,None),(got["allowed"],got["transition"],got["reason"],got["tier"]))
    def test_iteration_and_no_progress(self):
        self.stop(state(loop_iteration=4),"MAX_ITERATIONS_REACHED")
        self.stop(state(loop_no_progress_count=2),"MAX_NO_PROGRESS_REACHED")
    def test_repeated_unchanged_failure(self):
        self.stop(state(failure_signatures=["x","x"]),"REPEATED_UNCHANGED_FAILURE")
        self.stop(state(repeated_failure_count=2),"REPEATED_UNCHANGED_FAILURE")
        self.assertTrue(evaluate(state(failure_signatures=["x","x"],changed_evidence=True),NOW)["allowed"])
    def test_rework_tiers(self):
        for count,tier in ((0,"standard"),(1,"standard"),(2,"premium"),(3,"premium")):
            self.assertEqual(tier,evaluate(state(transition="REWORK",rework_count=count),NOW)["tier"])
        self.stop(state(transition="REWORK",rework_count=4),"REWORK_BUDGET_EXHAUSTED")
    def test_external_wait_requires_resume_and_never_polls(self):
        self.stop(state(external_dependency={"resume_condition":"CI completes"}),"EXTERNAL_DEPENDENCY","WAIT")
        self.stop(state(loop_iteration=4, external_dependency={"resume_condition":"CI completes"}),"EXTERNAL_DEPENDENCY","WAIT")
        self.stop(state(loop_no_progress_count=2, external_dependency={"resume_condition":"CI completes"}),"EXTERNAL_DEPENDENCY","WAIT")
        self.stop(state(external_dependency={}),"WAIT_REQUIRES_RESUME_CONDITION")
        self.stop(state(transition="WAIT"),"WAIT_REQUIRES_EXTERNAL_DEPENDENCY")
    def test_terminal_transitions_ignore_active_budget_ceilings(self):
        for transition in ("COMPLETE", "ESCALATE", "ABORT"):
            for exhausted in ({"loop_iteration":4}, {"loop_no_progress_count":2}):
                got = evaluate(state(transition=transition, **exhausted), NOW)
                self.assertEqual({"allowed":True, "transition":transition, "reason":"ALLOWED", "tier":None}, got)
    def test_due_exhaustion(self):
        self.stop(state(due_at=NOW),"TIME_BUDGET_EXHAUSTED")
        self.assertTrue(evaluate(state(due_at="2026-07-26T12:00:01Z"),datetime(2026,7,26,12,tzinfo=timezone.utc))["allowed"])
    def test_active_requires_task_and_proof(self):
        for transition in ("CONTINUE","REWORK","REPLAN"):
            self.stop(state(transition=transition,next_task=None),"NEXT_TASK_REQUIRED")
            self.stop(state(transition=transition,expected_proof=""),"EXPECTED_PROOF_REQUIRED")
    def test_resume_counters_honored(self):
        self.stop(state(loop_iteration=9,loop_max_iterations=9),"MAX_ITERATIONS_REACHED")
    def test_stable_shape(self):
        self.assertEqual({"allowed":True,"transition":"ESCALATE","reason":"ALLOWED","tier":None},evaluate(state(transition="ESCALATE"),NOW))
    def test_cli(self):
        done=subprocess.run([sys.executable,str(Path(__file__).with_name("loop_transition_guard.py"))],input=json.dumps({"snapshot":state(),"now":NOW}),text=True,capture_output=True)
        self.assertEqual(0,done.returncode,done.stderr); self.assertEqual(evaluate(state(),NOW),json.loads(done.stdout))
    def test_invalid(self):
        for value,now in ((state(loop_iteration=-1),NOW),(state(transition="BAD"),NOW),(state(),"bad")):
            with self.assertRaises(ValueError): evaluate(value,now)
if __name__ == "__main__": unittest.main()
