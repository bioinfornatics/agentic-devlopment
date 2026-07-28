# Harness source and runtime separation

## Required source tree

~~~text
src/
├── agents/
├── skills/                 # internal only
├── recipes/
├── plugins/                # descriptors, hooks, wrappers; no app source
└── app/
    ├── eval-hub/
    ├── loop-breaker/
    ├── kg/
    └── kg-visualizer/
~~~

External skills are never canonical source under `src/skills`. They are pinned by `harness/external-skills.lock.json` and resolved into build staging.

## Functional runtime tree

~~~text
build/harness/runtime/releases/<digest>/
├── .agents/
│   ├── agents/
│   ├── skills/             # internal + resolved external + packaged app skills
│   └── plugins/            # plugin descriptors + packaged app binaries
└── .goose/
    └── recipes/

build/harness/runtime/current -> releases/<digest>
<project>/.agents -> build/harness/runtime/current/.agents
<project>/.goose  -> build/harness/runtime/current/.goose
~~~

The root paths are operational outputs only. They must be reproducible, atomically activated, ignored as mutable build state except for stable link metadata, and never used as canonical source inputs.

## App packaging

Every `src/app/<name>/app-package.json` declares name, package kind, entrypoint, targets and outputs. Output runtime paths are allowlisted. Eval Hub packages as an optional companion skill; loop-breaker compiles into its plugin; KG applications may remain standalone until a profile declares otherwise.

## Tool boundaries

- source validation, docs and editors read `src/**`;
- external resolution reads lockfiles and writes `build/harness/external/**`;
- projection reads canonical source, resolved external trees and compiled app outputs;
- Goose reads only root/runtime `.agents` and `.goose`;
- Eval Hub receives separate source, runtime and evidence roots;
- release assembly consumes a projected immutable tree, not source directories.

## Planned executable projection interface

The migration must implement these exact root Make targets:

~~~bash
make bootstrap-runtime   # fresh clone: resolve, build, project and activate
make activate-runtime    # atomically switch project .agents/.goose to a built digest
make verify-runtime      # compare projection files and digest to its manifest
make rollback-runtime    # atomically restore the previous active projection
make clean-runtime       # remove inactive generated build state only
~~~

Until task D implements them, these names are the falsifiable public interface: invoking a missing target fails the contract; once implemented, fresh-clone and rollback tests execute these exact commands.

## Manifest path semantics during migration

Every component declares `currentRuntimePath` for the existing operational location and `targetSourcePath` for the canonical future location. `currentRuntimePath` is explicitly transitional and must not survive as a source input after task E. Generated runtime destinations are derived from `runtimePaths` and package descriptors, never inferred from either source field.

## Migration sequence

1. Establish this contract and tests.
2. Git-move internal assets and applications.
3. Build the runtime projector and activate root links.
4. Refactor manifests and tooling to source/runtime paths.
5. Run clean-clone discovery, release and evaluation gates.
6. Remove duplicate tracked runtime copies.

## Acceptance

A source edit followed by projection changes the runtime digest. A direct generated-runtime edit is detected. Two projections from the same source/lock/toolchains are identical. A clean clone can bootstrap, activate and list all expected Goose assets. External skills appear only through locked resolution. Apps can be packaged into a skill or plugin without copying their source into runtime packages.