# Evidence Register

## E1
- Command: `git rev-parse HEAD; git status --short`
- Exit code: `0`
- Evidence: revision c030a42849f32e83e4d7bcb0a034016696aecc87; working tree had many pre-existing modifications including .beads and .knowledge

## E2
- Command: `git check-ignore -v .audit/harness .audit/harness/test`
- Exit code: `0`
- Evidence: no ignore match printed; output path explicitly authorized by user/contract

## E3
- Command: `find component counts`
- Exit code: `0`
- Evidence: 20 skill dirs, 13 agents, 19 top-level recipes, 10 subrecipes

## E4
- Command: `python3 YAML parse .goose/recipes/**/*.yaml`
- Exit code: `0`
- Evidence: all recipe YAML files parsed OK

## E5
- Command: `python3 scripts/check-consistency.py`
- Exit code: `0`
- Evidence: All consistency checks passed

## E6
- Command: `python3 scripts/check-recipe-metadata.py`
- Exit code: `0`
- Evidence: PASS recipe metadata complete for 19 recipes

## E7
- Command: `node apps/kg/dist/cli.js bootstrap --dry-run`
- Exit code: `0`
- Evidence: Dry-run: 91 records

## E8
- Command: `find .goose/recipes -name *.yaml | goose recipe validate`
- Exit code: `0`
- Evidence: all 29 recipe/subrecipe YAML files valid

## E9
- Command: `./scripts/find-spec-deviations.sh`
- Exit code: `7`
- Evidence: 7 SPEC_DEVIATION markers found; script reports triage required

## E10
- Command: `bd prime / ready / blocked`
- Exit code: `None`
- Evidence: blocked by user declining shell tool execution; no Beads runtime state inspected

## E11
- Command: `delegate codebase-researcher/review-critic/principal-engineer`
- Exit code: `None`
- Evidence: blocked by provider/model errors; no independent adversarial specialist output obtained before judge
