# Beads Evidence Snapshot

Generated: 2026-07-19T13:38:46+00:00

## bd prime
# Beads Workflow Context

> **Context Recovery**: Run `bd prime` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when a beads workspace is resolved

# 🚨 SESSION CLOSE PROTOCOL 🚨

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

```
[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. git commit -m "..."     (commit code)
[ ] 4. git push                (push to remote)
```

**NEVER skip this.** Work is not done until pushed.

## Core Rules
- **Default**: Use beads for ALL task tracking (`bd create`, `bd ready`, `bd close`)
- **Prohibited**: Do NOT use TodoWrite, TaskCreate, or markdown files for task tracking
- **Workflow**: Create beads issue BEFORE writing code, mark in_progress when starting
- **Memory**: Use `bd remember "insight"` for persistent knowledge across sessions. Do NOT use MEMORY.md files — they fragment across accounts. Search with `bd memories <keyword>`.
- Persistence you don't need beats lost context
- Git workflow: beads auto-commit to Dolt, run `git push` at session end
- Session management: check `bd ready` for available work

## Essential Commands

### Finding Work
- `bd ready` - Show issues ready to work (no blockers)
- `bd list --status=open` - All open issues
- `bd list --status=in_progress` - Your active work
- `bd show <id>` - Detailed issue view with dependencies

### Creating & Updating
- `bd create --title="Summary of this issue" --description="Why this issue exists and what needs to be done" --type=task|bug|feature --priority=2` - New issue
  - Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low"
- `bd update <id> --claim` - Claim work
- `bd update <id> --assignee=username` - Assign to someone
- `bd update <id> --title/--description/--notes/--design` - Update fields inline
- `bd close <id>` - Mark complete
- `bd close <id1> <id2> ...` - Close multiple issues at once (more efficient)
- `bd close <id> --reason="explanation"` - Close with reason
- **Tip**: When creating multiple issues/tasks/epics, use parallel subagents for efficiency
- **WARNING**: Do NOT use `bd edit` - it opens $EDITOR (vim/nano) which blocks agents

### Dependencies & Blocking
- `bd dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `bd blocked` - Show all blocked issues
- `bd show <id>` - See what's blocking/blocked by this issue

### Sync & Collaboration
- `bd dolt push` - Push beads to Dolt remote
- `bd dolt pull` - Pull beads from Dolt remote
- `bd search <query>` - Search issues by keyword

### Project Health
- `bd stats` - Project statistics (open/closed/blocked counts)
- `bd doctor` - Check for issues (sync problems, missing hooks)
- `bd doctor --check=conventions` - Check for convention drift (lint, stale, orphans)

### Quality Tools
- `bd create --validate` - Check description has required sections
- `bd create --acceptance="criteria"` - Set acceptance criteria (checked by --validate)
- `bd create --design="decisions"` - Record design decisions
- `bd create --notes="context"` - Add supplementary notes
- `bd config set validation.on-create warn` - Auto-validate on every create
- `bd lint` - Check existing issues for missing sections

### Lifecycle & Hygiene
- `bd defer <id> --until="date"` - Defer work to a future date
- `bd supersede <id> --with=<new-id>` - Mark issue as superseded
- `bd close <id> --suggest-next` - Show newly unblocked issues after closing
- `bd stale` - Find issues with no recent activity
- `bd orphans` - Find issues with broken dependencies
- `bd preflight` - Pre-PR checks (lint, stale, orphans)
- `bd human <id>` - Flag for human decision (list/respond/dismiss)

### Structured Workflows
- `bd formula list` - See available workflow templates
- `bd mol pour <name>` - Start structured workflow from formula

## Common Workflows

**Starting work:**
```bash
bd ready           # Find available work
bd show <id>       # Review issue details
bd update <id> --claim  # Claim it
```

**Completing work:**
```bash
bd close <id1> <id2> ...    # Close all completed issues at once
git add . && git commit -m "..."  # Commit code changes
git push                    # Push to remote
```

**Creating dependent work:**
```bash
# Run bd create commands in parallel (use subagents for many items)
bd create --title="Implement feature X" --description="Why this issue exists and what needs to be done" --type=feature
bd create --title="Write tests for X" --description="Why this issue exists and what needs to be done" --type=task
bd dep add beads-yyy beads-xxx  # Tests depend on Feature (Feature blocks tests)
```

## Persistent Memories (18)

Stored via `bd remember`. Update in place with `bd remember --key <key> "new content"`. Search with `bd memories <keyword>`. Remove with `bd forget <key>`.

### claude-agent-skills-platform
Claude Agent Skills platform: canonical source is https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview; read when building or debugging skills; invariant: skills = SKILL.md + optional references/ scripts/ assets/; allowed-tools field is experimental.

### dora-env-labels
DORA env labels: env:dev (implemented locally), env:staging (deployed to staging), env:prod (deployed to production). Apply via bd update <id> --add-label env:prod. Required to measure lead-time and change-failure-rate.

### dora-issue-types
DORA issue types: task (feature), bug (fix), incident (prod outage). Label with severity:low/medium/high/critical and env:dev/staging/prod.

### dora-measurement
DORA lead-time: measured from bead created_at (intent) to env:prod label added (deployed). Change-failure-rate: bugs/incidents opened after env:prod label / total env:prod deployments.

### goose-adversary-inspector
Goose adversary inspector: create ~/.config/goose/adversary.md to enable argument-level shell blocking (LLM-based); blocks sudo/privilege-escalation while allowing all normal dev commands; activated by file presence; disabled if file absent.

### goose-agents-spec
Goose custom agents spec: canonical source is https://goose-docs.ai/docs/guides/context-engineering/custom-agents/; frontmatter supports name(required), description, model; @mention, natural-language, and delegate() invocation patterns all work.

### harness-agents-pointer
Harness agents: 11 named agents in .agents/agents/ (architect, product-owner, beads-planner, codebase-researcher, tdd-guide, implementation-worker, review-critic, principal-engineer, qa-automation, ui-ux-auditor, harness-orchestrator); entry point for multi-agent work is harness-orchestrator; descriptions are the routing signals.

### harness-audit-2026-07-19
Harness gaps closed 2026-07-19: C4=SPEC_DEVIATION loop; constitution.yaml; spec.yaml AD-001 fix; plan.yaml constitution check; dev.yaml routing table; sdd.yaml AD-001 block; verify.yaml AC coverage gate; discover.yaml KG step

### harness-entry-pointer
Harness entry: /harness slash command = harness-master recipe; auto-discovers agents via load(); use for any task you cannot route immediately; load goose-orchestration skill for routing table before first delegate() call of a session.

### harness-routing-pointer
Harness routing: canonical source is .agents/skills/goose-orchestration/SKILL.md#Agent and Subrecipe Routing Table; load goose-orchestration skill when delegating to any agent or subrecipe; invariant: always call load() before delegate() to confirm live availability.

### kg-visualization-framework
KG viz framework: Cytoscape.js v3.34+fcose recommandé (sémantique native, 13 issues, fcose layout); Sigma.js v3+Graphology si >500 nœuds (WebGL). Voir docs/kg-visualization-framework-research.md

### release-checklist-pointer
Release checklist: canonical source is docs/10-release-readiness.md#release-checklist; read when preparing a release; invariant: never copy checklist content into memory.

### sota-knowledge-base
SOTA knowledge base (July 2026): canonical source is docs/sota-knowledge-base.md; read when designing skills/agents/loops or debugging eval failures; invariant: check gaps table before writing new skill instructions.

### spdev-loop-implementation
SPEC_DEVIATION loop: HIGH score. script=scripts/find-spec-deviations.sh; skill=sdd Section 8; agent=review-critic Amendment Protocol; recipe=review.yaml Step 1; subrecipe=subrecipes/amend-spec.yaml

### spec-clarify-phase-pointer
Spec for clarify-phase: canonical source is .specs/features/clarify-phase/spec.md; read when implementing clarify phase; invariant: ACs define done, not task descriptions

### spec-deviation-loop-pointer
SPEC_DEVIATION loop: canonical source .specs/features/spec-deviation-loop/spec.md; detection script scripts/find-spec-deviations.sh; amendment workflow subrecipes/amend-spec.yaml; sdd skill Section 8; review-critic Amendment Protocol

### spec-verify-review-gate-pointer
Spec for verify-review-gate: canonical source is .specs/features/verify-review-gate/spec.md; read when implementing ordering gates; invariant: env:reviewed required before verify, env:verified required before release

### spec-wcag-skill-refactor-pointer
Spec for wcag-skill-refactor: .specs/features/wcag-skill-refactor/spec.md; SKILL.md trimmed to 188 body lines; criteria/procedure/quickref moved to references/



## bd ready --json
[
  {
    "id": "agentic-devlopment-15s.3",
    "title": "F-HIGH-001: Classify SPEC_DEVIATION examples versus active drift",
    "description": "Finding: F-HIGH-001 — SPEC_DEVIATION scanner reports markers requiring triage.\nOwner role: tdd-guide / review-critic.\nRequires separate SDD cycle: yes.\n\nDescription:\nRefine SPEC_DEVIATION marker scanning so instructional examples and fixtures are classified separately from active implementation drift while preserving real drift detection.\n\nAcceptance criteria:\n- Current instructional examples no longer block normal scan unless intentionally marked active.\n- Active SPEC_DEVIATION markers remain detected and fail/flag verification.\n- The marker convention is documented for examples, fixtures, accepted deviations, and active deviations.\n- Existing 7 scanner hits are triaged to active/false-positive/accepted/deferred.\n\nVerification:\n- `./scripts/find-spec-deviations.sh` exits clean or reports only classified examples in normal mode.\n- A fixture with an active marker is still detected.\n",
    "acceptance_criteria": "Scanner separates examples/fixtures from active drift; all existing markers are triaged; active drift remains detectable.",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "review-critic",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:49:49Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:49:49Z",
    "labels": [
      "F-HIGH-001",
      "audit",
      "harness",
      "remediation",
      "sdd",
      "sdd-required",
      "spec-deviation",
      "verification"
    ],
    "dependencies": [
      {
        "issue_id": "agentic-devlopment-15s.3",
        "depends_on_id": "agentic-devlopment-15s",
        "type": "parent-child",
        "created_at": "2026-07-19T13:49:49Z",
        "created_by": "Jonathan MERCIER",
        "metadata": "{}"
      }
    ],
    "dependency_count": 0,
    "dependent_count": 1,
    "comment_count": 0,
    "parent": "agentic-devlopment-15s"
  },
  {
    "id": "agentic-devlopment-15s.2",
    "title": "F-HIGH-002: Add subagent provider/model preflight and fallback policy",
    "description": "Finding: F-HIGH-002 — Independent adversarial challenge agents unavailable during audit.\nOwner role: principal-engineer.\nRequires separate SDD cycle: yes.\n\nDescription:\nAdd a provider/model preflight for recipe-required delegated agents and current-session agents. The preflight must detect unavailable deployments and incompatible model options before orchestration attempts delegation.\n\nAcceptance criteria:\n- Preflight validates review-critic and principal-engineer delegation configuration before audit/review recipes run.\n- Missing deployment and incompatible temperature/thinking errors become explicit preflight blockers with actionable remediation text.\n- A safe fallback or operator override path is documented.\n- Successful review-critic and principal-engineer challenge outputs can be captured in `.audit/harness/adversarial-review.md`.\n\nVerification:\n- Preflight fails fast in a controlled test with a bogus model.\n- Preflight passes with the approved available model.\n- Rerun challenge produces substantive evidence, not provider errors.\n",
    "acceptance_criteria": "Provider/model issues are caught before delegation; fallback/override is documented; adversarial challenge agents return substantive evidence.",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "principal-engineer",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:49:43Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:49:43Z",
    "labels": [
      "F-HIGH-002",
      "audit",
      "harness",
      "orchestration",
      "provider",
      "remediation",
      "sdd",
      "sdd-required"
    ],
    "dependencies": [
      {
        "issue_id": "agentic-devlopment-15s.2",
        "depends_on_id": "agentic-devlopment-15s",
        "type": "parent-child",
        "created_at": "2026-07-19T13:49:43Z",
        "created_by": "Jonathan MERCIER",
        "metadata": "{}"
      }
    ],
    "dependency_count": 0,
    "dependent_count": 1,
    "comment_count": 0,
    "parent": "agentic-devlopment-15s"
  },
  {
    "id": "agentic-devlopment-hmd",
    "title": "SDD cycle: Beads remediation dependency and gate model",
    "description": "Findings: F-002\nOwner: planner\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nDefine canonical Beads Epic/task/dependency/gate structure for remediation and future SDD cycles, including active Epic filtering, readiness, assignment, blocking, ACs, verification, and completion evidence.\n\nAcceptance criteria:\nRemediation tasks have dependencies, owner, ACs, verification, gate tasks, and human approval where needed; unrestricted bd list is not an execution queue.\n\nVerification:\nbd list/json or .beads/issues.jsonl inspection; dependency graph has no cycles and all tasks link to findings.\n\nDependencies:\nnone\n",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "planner",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:56Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:56Z",
    "dependency_count": 0,
    "dependent_count": 0,
    "comment_count": 0
  },
  {
    "id": "agentic-devlopment-kku",
    "title": "SDD cycle: independent adversarial review rerun and judge closure",
    "description": "Findings: F-010\nOwner: review-critic\nRequires separate SDD cycle: no\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nRerun blocked review-critic adversarial challenge using available model or approved alternate route; update findings with disagreements and resolutions.\n\nAcceptance criteria:\nreview-critic challenge output is captured; high findings have challenge/resolution notes; harness-judge independence is preserved.\n\nVerification:\ndelegate/session output saved or summarized in audit artifact; plan updated with resolved disagreements.\n\nDependencies:\nnone\n",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "review-critic",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:50Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:50Z",
    "dependency_count": 0,
    "dependent_count": 0,
    "comment_count": 0
  },
  {
    "id": "agentic-devlopment-quy",
    "title": "SDD cycle: typed recipe workflow schema and gate metadata",
    "description": "Findings: F-003, F-004\nOwner: architect\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nDefine and implement typed recipe metadata for lifecycle phase, AD-001 pattern, entry gates, exit gates, agents, skills, artifacts, and Beads labels. Extend consistency checks to validate schema and gate ordering.\n\nAcceptance criteria:\nAll active recipes expose machine-readable phase/pattern/gates/artifacts; contradictory prose fails check-consistency; all recipes validate.\n\nVerification:\ngoose recipe validate .goose/recipes/*.yaml; python3 scripts/check-consistency.py; no missing AD-001 pattern warnings.\n\nDependencies:\nnone\n",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "architect",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:09Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:09Z",
    "dependency_count": 0,
    "dependent_count": 3,
    "comment_count": 0
  },
  {
    "id": "agentic-devlopment-15s.5",
    "title": "F-MED-002: Decide agentic-devlopment alias or migration path",
    "description": "Finding: F-MED-002 — Agentic-development skill name appears intentionally misspelled but remains a cognitive/search hazard.\nOwner role: architect.\nRequires separate SDD cycle: yes.\n\nDescription:\nDecide and implement a compatibility-safe path for the `agentic-devlopment` skill naming issue: document the historical name with an alias, or migrate to correctly spelled `agentic-development` with a compatibility shim.\n\nAcceptance criteria:\n- Architecture decision or migration plan states preferred spelling and compatibility policy.\n- Recipes/agents/docs/evals/specs are updated consistently if renamed.\n- `goose skills list` and consistency checks demonstrate compatibility and preferred spelling.\n- User-facing docs include migration/alias guidance.\n\nVerification:\n- `python3 scripts/check-consistency.py` passes.\n- `goose skills list` shows expected preferred/compatibility behavior.\n",
    "acceptance_criteria": "Preferred spelling and compatibility policy are documented and validated; affected references are consistent.",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "assignee": "architect",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:50:00Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:50:00Z",
    "labels": [
      "F-MED-002",
      "audit",
      "harness",
      "naming",
      "remediation",
      "sdd",
      "sdd-required",
      "skills"
    ],
    "dependencies": [
      {
        "issue_id": "agentic-devlopment-15s.5",
        "depends_on_id": "agentic-devlopment-15s",
        "type": "parent-child",
        "created_at": "2026-07-19T13:50:00Z",
        "created_by": "Jonathan MERCIER",
        "metadata": "{}"
      }
    ],
    "dependency_count": 0,
    "dependent_count": 1,
    "comment_count": 0,
    "parent": "agentic-devlopment-15s"
  },
  {
    "id": "agentic-devlopment-15s.4",
    "title": "F-MED-001: Add reproducible audit baseline manifest and diff hash",
    "description": "Finding: F-MED-001 — Working tree is dirty before audit, including tracked harness, Beads, and KG files.\nOwner role: orchestrator.\n\nDescription:\nAdd an audit baseline manifest step that captures either a clean HEAD or a dirty-state patch/diff hash before audit evidence is frozen.\n\nAcceptance criteria:\n- Audit manifest records repository revision plus clean/dirty state.\n- If dirty, manifest includes patch bundle hash or equivalent reproducibility reference.\n- Final report and evidence manifest include the dirty-state caveat and hash.\n- The step runs before target graph, findings register, and judge invocation.\n\nVerification:\n- A dirty working tree audit produces a manifest with diff hash.\n- A clean working tree audit records clean status.\n",
    "acceptance_criteria": "Audit manifest captures clean HEAD or dirty diff hash before evidence freeze and final report references it.",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "assignee": "orchestrator",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:49:55Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:49:55Z",
    "labels": [
      "F-MED-001",
      "audit",
      "harness",
      "manifest",
      "remediation",
      "reproducibility",
      "sdd"
    ],
    "dependencies": [
      {
        "issue_id": "agentic-devlopment-15s.4",
        "depends_on_id": "agentic-devlopment-15s",
        "type": "parent-child",
        "created_at": "2026-07-19T13:49:54Z",
        "created_by": "Jonathan MERCIER",
        "metadata": "{}"
      }
    ],
    "dependency_count": 0,
    "dependent_count": 2,
    "comment_count": 0,
    "parent": "agentic-devlopment-15s"
  },
  {
    "id": "agentic-devlopment-6oe",
    "title": "SDD cycle: context and token budget policy",
    "description": "Findings: F-007\nOwner: principal-engineer\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nMeasure and reduce context overhead from large skills and broad default skill loading. Define context budgets, core/reference split policy, and optional deep-load triggers.\n\nAcceptance criteria:\nRecipes and agents distinguish required versus optional skill loads; large skills are split or justified; token/context budget report exists.\n\nVerification:\npython3 scripts/check-consistency.py; line-count thresholds; token/context report or estimator output.\n\nDependencies:\nnone\n",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "assignee": "principal-engineer",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:30Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:30Z",
    "dependency_count": 0,
    "dependent_count": 1,
    "comment_count": 0
  }
]


## bd blocked --json
[
  {
    "id": "agentic-devlopment-15s.1",
    "title": "F-CRIT-001: Provide read-only Beads audit evidence snapshot",
    "description": "Finding: F-CRIT-001 — Audit precondition blocker: Beads runtime evidence unavailable.\nOwner role: orchestrator.\n\nDescription:\nProvide a read-only Beads evidence path for harness audits. Either approve and record `bd prime`, `bd ready --json`, and `bd blocked --json` outputs, or supply an immutable exported Beads snapshot.\n\nAcceptance criteria:\n- `bd prime`, `bd ready --json`, and `bd blocked --json` evidence are recorded, or an immutable snapshot hash is recorded.\n- Evidence collection is read-only and does not mutate work state.\n- Work-control graph can be inspected for active remediation tasks, blockers, owners, gates, and readiness.\n- Audit artifacts explicitly reference the evidence source and hash/timestamp.\n\nVerification:\n- Stored command output or supplied snapshot hash exists in `.audit/harness/`.\n- `git diff -- .beads/issues.jsonl` shows no unintended mutation from evidence collection.\n",
    "acceptance_criteria": "Beads evidence is recorded read-only with immutable hash; work-control graph is inspectable; no unintended Beads mutation occurs.",
    "status": "open",
    "priority": 0,
    "issue_type": "task",
    "assignee": "orchestrator",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:49:36Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:49:36Z",
    "labels": [
      "F-CRIT-001",
      "audit",
      "beads",
      "blocker",
      "harness",
      "remediation",
      "sdd"
    ],
    "blocked_by_count": 1,
    "blocked_by": [
      "agentic-devlopment-15s.4"
    ]
  },
  {
    "id": "agentic-devlopment-15s.6",
    "title": "Audit closure gate: rerun adversarial review and harness judge",
    "description": "Purpose: close the audit loop after child remediation tasks are complete.\nOwner role: harness-judge / review-critic.\n\nDescription:\nRerun independent adversarial review and harness judge once evidence/preflight/drift/baseline/naming tasks are complete. Update final audit artifacts or create a follow-up audit record with PASS/FAIL and residual risk.\n\nAcceptance criteria:\n- review-critic and principal-engineer challenge evidence exists or blocked status is explicitly justified after preflight.\n- harness_judge is invoked once after evidence freeze.\n- Judge verdict, score, summary, and residual findings are stored under `.audit/harness/`.\n- Remediation epic has closure notes linking verification outputs.\n\nVerification:\n- `.audit/harness/harness-judge-report.json` contains non-null verdict/score when available.\n- Final report or follow-up report records closure status for all findings.\n",
    "acceptance_criteria": "Independent challenge and harness judge run after evidence freeze; residual risks are documented; epic closure evidence is linked.",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "review-critic",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T11:50:07Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T11:50:07Z",
    "labels": [
      "audit",
      "closure",
      "gate",
      "harness",
      "judge",
      "remediation",
      "sdd"
    ],
    "blocked_by_count": 5,
    "blocked_by": [
      "agentic-devlopment-15s.1",
      "agentic-devlopment-15s.2",
      "agentic-devlopment-15s.3",
      "agentic-devlopment-15s.4",
      "agentic-devlopment-15s.5"
    ]
  },
  {
    "id": "agentic-devlopment-b8f",
    "title": "SDD cycle: full harness ontology TBox ABox and query suite",
    "description": "Findings: F-006\nOwner: architect\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nEvolve export-harness-graph.py into full harness ontology export with TBox, ABox, provenance, confidence, constraints, and required query catalogue.\n\nAcceptance criteria:\nGraph export covers skills, topics, agents, responsibilities, recipes, delegated tasks, artifacts, gates, Beads tasks, findings, decisions.\n\nVerification:\npython3 scripts/export-harness-graph.py --summary; full JSON export spot-check; graph integrity query suite passes.\n\nDependencies:\nSDD cycle: typed recipe workflow schema and gate metadata\n",
    "status": "open",
    "priority": 1,
    "issue_type": "task",
    "assignee": "architect",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:24Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:24Z",
    "blocked_by_count": 1,
    "blocked_by": [
      "agentic-devlopment-quy"
    ]
  },
  {
    "id": "agentic-devlopment-ev8",
    "title": "SDD cycle: review recipe consolidation and routing clarity",
    "description": "Findings: F-008\nOwner: orchestrator\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nResolve overlap among review.yaml, doc-review.yaml, harness-review.yaml, and harness-doc-review.yaml through merge, deprecation, or explicit routing modes.\n\nAcceptance criteria:\nNo ambiguous review entrypoint; README/recipe docs/evals/AC-RECIPE wiring agree; deprecated recipes have migration path or are removed consistently.\n\nVerification:\ngoose recipe validate affected recipes; python3 scripts/check-consistency.py; eval JSON and generated docs updated.\n\nDependencies:\nSDD cycle: typed recipe workflow schema and gate metadata\n",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "assignee": "orchestrator",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:36Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:36Z",
    "blocked_by_count": 1,
    "blocked_by": [
      "agentic-devlopment-quy"
    ]
  },
  {
    "id": "agentic-devlopment-ect",
    "title": "SDD cycle: collegial contribution and decision-resolution artifact schema",
    "description": "Findings: F-005\nOwner: orchestrator\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nSpecify and wire ExpertContribution and DecisionResolution artifacts for multi-agent phases so expert input, disagreements, overrides, and final decisions are traceable.\n\nAcceptance criteria:\nMulti-agent recipes define contribution tables with producer, consumer, artifact, conflict status, decision impact, resolver, and provenance.\n\nVerification:\nRun/sample planning path or static artifact check; validate schema fields in plan/sdd outputs.\n\nDependencies:\nSDD cycle: typed recipe workflow schema and gate metadata\n",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "assignee": "orchestrator",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:18Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:18Z",
    "blocked_by_count": 1,
    "blocked_by": [
      "agentic-devlopment-quy"
    ]
  },
  {
    "id": "agentic-devlopment-84j",
    "title": "SDD cycle: UI UX skill consolidation and optional deep-dive loading",
    "description": "Findings: F-009, F-007\nOwner: ui-designer\nRequires separate SDD cycle: yes\nActive remediation Epic: agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic\n\nDescription:\nClarify UI/UX skill boundaries and reduce default loading across cognitive-ux, design-critique-case-studies, ux-quality, ui-quality, atomic-design, design-systems-arch, and frontend-blueprint.\n\nAcceptance criteria:\nDesign and UI/UX agents specify minimal required skill set plus explicit triggers for optional references/deep dives; overlap is documented or removed.\n\nVerification:\nstatic skill-load review; check-consistency; sample design workflow confirms correct optional loading.\n\nDependencies:\nSDD cycle: context and token budget policy\n",
    "status": "open",
    "priority": 3,
    "issue_type": "task",
    "assignee": "ui-designer",
    "owner": "jonathan@mercier.paris",
    "created_at": "2026-07-19T08:32:44Z",
    "created_by": "Jonathan MERCIER",
    "updated_at": "2026-07-19T08:32:44Z",
    "blocked_by_count": 1,
    "blocked_by": [
      "agentic-devlopment-6oe"
    ]
  }
]

