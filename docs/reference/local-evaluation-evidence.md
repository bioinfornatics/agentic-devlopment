# Local evaluation evidence

A local release candidate is represented by one canonical JSON attestation and a self-contained escaped HTML rendering. The attestation binds source, locks, projected runtime, release, Goose, Eval Hub, provider, model, corpus, and profile digests. It is valid for 24 hours and only when deterministic smoke and the provider-backed release gate both pass for the same release and bindings.

The report exposes the causal evidence explicitly: **L0** deterministic smoke, then **L1–L3** valid pairs, pair-micro deltas, subject-macro confidence intervals, CI evidence, and exclusions. Population entries and typed exemptions remain visible. Commands are retained, but raw logs, prompts, credentials, tokens, and secret-like fields are forbidden.

Use `createLocalEvaluationAttestation` to produce canonical evidence and `verifyLocalEvaluationAttestation` immediately before publication. Verification is offline and fail-closed: stale timestamps, partial layers, exclusions forbidden by the release profile, changed bindings/profile/corpus/Goose/model/release/status, extra properties, digest mutation, and modified HTML are rejected.
