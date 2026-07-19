# Product ontology

## Entity types

- `product:epic`: scope, status, description
- `product:feature`: scope, layer, status
- `product:user_story`: "as a … I want … so that …"
- `product:acceptance_criterion`: stable ID, WHEN/THEN criterion, status
- `product:component`: layer, atomic level when applicable, file
- `product:api_endpoint`: method, path, contract file
- `product:data_model`: layer, schema or file
- `product:test`: file, covered criterion or story
- `product:code_file`: repository-relative path
- `product:spec_file`: repository-relative path
- `product:decision`: status, rationale

## Core relations

```text
product:epic DECOMPOSES_INTO product:feature
product:feature REFINED_INTO product:user_story
product:user_story HAS_CRITERION product:acceptance_criterion
product:acceptance_criterion ANCHORS product:test
product:test VALIDATES product:acceptance_criterion
product:component IMPLEMENTS product:user_story
product:api_endpoint IMPLEMENTS product:user_story
product:api_endpoint RETURNS product:data_model
product:component EXTENDS product:component
product:component IMPLEMENTED_IN product:code_file
product:api_endpoint IMPLEMENTED_IN product:code_file
product:test LOCATED_IN product:code_file
product:user_story TRACED_IN product:spec_file
product:decision GOVERNS product:component
work:beads_task TRACKS product:user_story
```

## SDD phase behavior

- Discover: create epics and features.
- Specify: create stories and criteria; link criteria to specifications.
- Plan: connect work tasks to stories and criteria.
- Implement: connect components, APIs, models, tests, and files.
- Review: query criteria without tests, features without stories, and artifacts without consumers.
- Verify: attach execution evidence or passing observations to test and verification nodes.

## File closure rule

Every file-backed buildtime entity must connect through `IMPLEMENTED_IN`, `LOCATED_IN`, `DEFINED_IN`, or `TRACED_IN` to a file node.
