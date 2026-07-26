# Relation catalogue

Use active-voice relation names. Preserve direction consistently.

| Relation | Domain | Range | Cardinality guidance |
|---|---|---|---|
| COVERS_TOPIC | skill, agent, recipe | matching topic | 1..n for active components |
| HAS_RESPONSIBILITY | agent | responsibility | 1..n |
| LOADS_SKILL | agent, recipe | skill | 0..n; justify zero for active agents |
| DELEGATES_TASK | recipe | delegated task | 0..n |
| ASSIGNED_TO | delegated task, work task | agent or assignee | exactly 1 unless collaborative task is explicit |
| REQUIRES_SKILL | delegated task, responsibility | skill | 0..n |
| INVOLVES_AGENT | recipe | agent | 1..n for agentic recipes |
| IMPLEMENTS_PHASE | recipe | lifecycle phase | 1..n or documented cross-cutting exception |
| PRODUCES | agent, recipe, phase | artifact | 0..n |
| CONSUMES | agent, recipe, phase | artifact | 0..n |
| HAS_ENTRY_CRITERION | recipe, phase | entry criterion | exactly 1..n for active recipes |
| HAS_EXIT_CRITERION | recipe, phase | exit criterion | exactly 1..n for active recipes |
| BLOCKED_BY | recipe, phase, work task | gate or work task | 0..n |
| VERIFIED_BY | gate, task, criterion | verification method | 1..n when mandatory |
| EVIDENCED_BY | task, verification method, finding | evidence | 1..n when completed or asserted |
| IMPLEMENTED_IN | component, API | code file | 1..n when file-backed |
| LOCATED_IN | test, criterion, artifact | file | 1..n when file-backed |
| DECOMPOSES_INTO | epic | feature | 1..n |
| REFINED_INTO | feature | user story | 1..n for specified features |
| HAS_CRITERION | user story | acceptance criterion | 1..n |
| VALIDATES | test | acceptance criterion | 1..n |
| TRACKS | work task | story, criterion, finding | 1..n |

When the graph backend cannot store relation properties, create a `harness:relation_assertion` node and record subject, predicate, object, evidence, confidence, status, and graph view.
