# Companion and run provenance

The companion artifact records source repository/commit, Bun version/target, standalone binary SHA-256, skill tree SHA-256, package/archive SHA-256, CycloneDX SBOM, license assertion, and `coreHarnessIncluded: false`. Release-aware runs separately record harness release, lock, manifest, and Goose digests.

Builds use a deterministic fixed compilation/output path because Bun standalone executables embed paths. Packaging normalizes archive ownership, permissions, order, and mtime.
