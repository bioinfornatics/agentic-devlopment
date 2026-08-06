# Local harness prepublication L0-L3 gate contract

Version 1.0. This contract governs candidate evidence; it does not define the sandbox, runner, or distribution installer.

## Profiles and causal treatments

A deterministic smoke profile proves build/install/discovery/schema integrity without a provider and is never behavioral benchmark evidence. A provider-backed release profile benchmarks the exact same release digest and corpus under these treatments:

| Layer | Control | Treatment | Sole causal difference |
|---|---|---|---|
| L0 | provider model with no harness components | identical model/input | none; absolute model baseline |
| L1 | exact declared dependency closure D | D plus one skill | that skill |
| L2 | exact skills and dependency closure | identical closure plus one agent | that agent |
| L3 | exact agents, skills, and dependency closure | identical closure orchestrated by one recipe | recipe orchestration |

Order, prompt, provider, model, corpus case, grader, runtime, seed policy, and all non-treatment configuration MUST match within each pair. Contamination, an unmatched pair, or a changed non-treatment input invalidates the pair.

## Population and integrity

The release population is every active skill, agent, and recipe discovered from the candidate release. Each component MUST have scenarios at its layer or one typed exemption: unsupported-provider, non-behavioral, or premium-variant, with component identity, owner, reason, and expiry. Unknown, expired, or unowned exemptions fail.

Release runs execute L0, L1, L2, and L3 and every population entry despite earlier failures (earlyStop=false); only infrastructure failure may abort, and an aborted run cannot pass. Every scenario has at least 5 paired repetitions. A layer passes only when valid-pair rate is at least 0.90, exclusion rate is at most 0.10, observed treatment delta is at least 0.05, and the paired 95% confidence-interval lower bound is above 0. Thresholds are read from an immutable, versioned profile; missing or substituted values fail.

## Evidence and publication

Evidence is strict machine-readable data and binds profile version plus SHA-256 digests for source, locks, runtime, release, Goose, EvalHub, provider configuration, model, corpus, and profile. It records component population/exemptions, repetitions, exclusions with typed reasons, pair integrity, per-layer estimates and confidence intervals, all-layer execution, timestamps, and overall status.

Publication fails closed unless both smoke and release evidence pass, share the candidate release digest, and their bound digests equal the current candidate and environment. Missing, malformed, expired, aborted, partial, stale, or digest-mismatched evidence is rejected. Secrets and provider credentials MUST NOT be evidence fields.
