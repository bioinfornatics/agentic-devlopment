#!/usr/bin/env python3
import os, pathlib, sys, subprocess
required = ["review-critic", "principal-engineer"]
model = os.environ.get("GOOSE_MODEL") or os.environ.get("MODEL") or ""
provider = os.environ.get("GOOSE_PROVIDER") or os.environ.get("PROVIDER") or ""
if len(sys.argv) > 1 and sys.argv[1] == "--bogus":
    model = "__bogus_model_for_preflight__"
if model == "__bogus_model_for_preflight__":
    print("FAIL: configured model is a known-invalid preflight sentinel", file=sys.stderr); sys.exit(20)
for agent in required:
    if not pathlib.Path(".agents/agents", agent + ".md").exists():
        print("FAIL: required delegated agent missing: " + agent, file=sys.stderr); sys.exit(21)
try:
    subprocess.run(["goose", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
except FileNotFoundError:
    pass
except subprocess.CalledProcessError:
    print("FAIL: goose CLI is present but not executable", file=sys.stderr); sys.exit(22)
if not model: print("WARN: GOOSE_MODEL not set; runtime default will be used", file=sys.stderr)
if not provider: print("WARN: GOOSE_PROVIDER not set; runtime default will be used", file=sys.stderr)
print("PASS: subagent provider preflight complete")
print("provider=" + (provider or "runtime-default"))
print("model=" + (model or "runtime-default"))
print("required_agents=" + ",".join(required))
print("fallback_policy=halt orchestration on provider/model failure; select an available model or use a documented manual review path before delegated challenges")
