/**
 * Focused unit tests for release-gate CLI parsing helpers in run.ts.
 * These are pure parser tests — no provider, no file I/O, no goose binary.
 */
import { describe, it, expect } from "vitest";
import { parseReleaseCliArgs, buildReleaseContext } from "./run.js";

const FULL_ARGS = [
  "--release-gate",
  "--run-id",            "20260729T000000Z",
  "--run-provenance-id", "prov-abc-123",
  "--binding-profile",   "digest-profile",
  "--binding-runtime",   "digest-runtime",
  "--binding-release",   "digest-release",
  "--binding-corpus",    "digest-corpus",
  "--binding-goose",     "digest-goose",
  "--binding-provider",  "digest-provider",
  "--binding-model",     "digest-model",
];

describe("parseReleaseCliArgs", () => {
  it("parses all fields from a full arg list", () => {
    const parsed = parseReleaseCliArgs(FULL_ARGS);
    expect(parsed.runId).toBe("20260729T000000Z");
    expect(parsed.runProvenanceId).toBe("prov-abc-123");
    expect(parsed.bindings.profile).toBe("digest-profile");
    expect(parsed.bindings.runtime).toBe("digest-runtime");
    expect(parsed.bindings.release).toBe("digest-release");
    expect(parsed.bindings.corpus).toBe("digest-corpus");
    expect(parsed.bindings.goose).toBe("digest-goose");
    expect(parsed.bindings.provider).toBe("digest-provider");
    expect(parsed.bindings.model).toBe("digest-model");
  });

  it("returns undefined for absent optional fields", () => {
    const parsed = parseReleaseCliArgs(["--release-gate"]);
    expect(parsed.runId).toBeUndefined();
    expect(parsed.runProvenanceId).toBeUndefined();
    expect(parsed.bindings.profile).toBeUndefined();
    expect(parsed.bindings.model).toBeUndefined();
  });

  it("ignores unrelated flags", () => {
    const parsed = parseReleaseCliArgs(["--workers", "4", "--run-id", "abc"]);
    expect(parsed.runId).toBe("abc");
    expect(parsed.bindings.profile).toBeUndefined();
  });
});

describe("buildReleaseContext", () => {
  it("constructs ReleaseContext from a fully-populated parsed object", () => {
    const parsed = parseReleaseCliArgs(FULL_ARGS);
    const ctx = buildReleaseContext(parsed);
    expect(ctx.runProvenanceId).toBe("prov-abc-123");
    expect(ctx.bindings.profile).toBe("digest-profile");
    expect(ctx.bindings.runtime).toBe("digest-runtime");
    expect(ctx.bindings.release).toBe("digest-release");
    expect(ctx.bindings.corpus).toBe("digest-corpus");
    expect(ctx.bindings.goose).toBe("digest-goose");
    expect(ctx.bindings.provider).toBe("digest-provider");
    expect(ctx.bindings.model).toBe("digest-model");
  });

  it("throws with a message about missing fields when all bindings are absent", () => {
    const parsed = parseReleaseCliArgs(["--release-gate"]);
    expect(() => buildReleaseContext(parsed)).toThrow(
      "--release-gate / --full requires all binding arguments",
    );
    expect(() => buildReleaseContext(parsed)).toThrow("--run-provenance-id");
    expect(() => buildReleaseContext(parsed)).toThrow("--binding-profile");
    expect(() => buildReleaseContext(parsed)).toThrow("--binding-model");
  });

  it("throws naming exactly the missing fields (partial args)", () => {
    // Supply 6 of 8 required; omit --run-provenance-id and --binding-model
    const partial = FULL_ARGS.filter(
      (a, i) =>
        a !== "--run-provenance-id" && FULL_ARGS[i - 1] !== "--run-provenance-id" &&
        a !== "--binding-model"     && FULL_ARGS[i - 1] !== "--binding-model",
    );
    const parsed = parseReleaseCliArgs(partial);
    let errMsg = "";
    try { buildReleaseContext(parsed); } catch (e) { errMsg = String(e); }
    expect(errMsg).toContain("--run-provenance-id");
    expect(errMsg).toContain("--binding-model");
    expect(errMsg).not.toContain("--binding-profile");
  });

  it("round-trips: all fields present => no throw => correct values", () => {
    const parsed = parseReleaseCliArgs(FULL_ARGS);
    expect(() => buildReleaseContext(parsed)).not.toThrow();
    const ctx = buildReleaseContext(parsed);
    const expectedBindings: Record<string, string> = {
      profile: "digest-profile", runtime: "digest-runtime",
      release: "digest-release", corpus: "digest-corpus",
      goose: "digest-goose", provider: "digest-provider", model: "digest-model",
    };
    for (const [k, v] of Object.entries(expectedBindings)) {
      expect((ctx.bindings as Record<string, string>)[k]).toBe(v);
    }
  });
});
