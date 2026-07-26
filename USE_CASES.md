# Use Cases — Beads-Native Loop Engineering

Use the generic sequence and stage diagrams in [docs/loop-engineering](docs/loop-engineering/README.md). Beads stores durable run state; Goose recipes and isolated agents execute the stages.

## Workflow map

| Use case | Recipe | Durable outcome |
|---|---|---|
| Repository and failure research | /research | Evidence-backed task framing input |
| One bounded claimed change | /implement | Builder handoff and candidate evidence on a Beads child task |
| Independent acceptance check | /verify | Criterion evidence, verdict, and recommended transition |
| Governed end-to-end objective | /loop-engineering | Run epic, task/dependency graph, state events, evidence references, terminal transition |

## Default command

~~~bash
goose run --recipe loop-engineering --params objective="<outcome>" --params max_iterations=8
~~~

To resume, pass the existing Beads run ID. The controller loads ready/blocked work, prior failures, and evidence added after those failures before choosing another action.
