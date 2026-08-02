/**
 * Tests for local-evaluation-full.ts — proves assembly, gate failure/no export,
 * path safety, and cleanup via dependency injection seams.
 * Beads: builder_session=20260729_131; task=olqo.9
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateEvalTimeoutMs,
  resolveEnv,
  runLocalEvaluationFull,
  validateEnv,
  type FullChildRunner,
  type FullGateEvaluator,
  type FullOperations,
  type FullStoreLayer,
  type FullStoreLoader,
} from "./local-evaluation-full.js";
import { digestLocalEvaluationProfile } from "./local-evaluation-evidence.js";
import type { SmokeEvidence } from "./local-evaluation-smoke.js";
import type { LocalEvaluationBindings } from "./local-evaluation-attestation.js";

const sha256Str = (s: string): string =>
  createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

const GOOSE_RAW = "goose 9.0.0-test";

// ── Temp root management ──────────────────────────────────────────────────────

const roots: string[] = [];
function temp(): string {
  const r = mkdtempSync(join(tmpdir(), "full-test-"));
  roots.push(r);
  return r;
}
afterEach(() => roots.splice(0).forEach(r => rmSync(r, { recursive: true, force: true })));

// ── Minimal repo fixture ──────────────────────────────────────────────────────

const PROFILE = {
  $schema: "../../.specs/schemas/local-harness-evaluation-profile.schema.json",
  schemaVersion: 1,
  profileVersion: "2.0.0",
  profiles: {
    smoke: { providerBacked: false, behavioralEvidence: false },
    release: {
      providerBacked: true,
      earlyStop: false,
      noEarlyStop: true,
      layers: ["skills", "agents", "recipes"],
      conceptualBaseline: "L0",
      repetitions: 5,
      provider: "PIN_PROVIDER_FOR_RELEASE",
      model: "PIN_MODEL_FOR_RELEASE",
      maxTurns: 20,
      timeoutMs: 120000,
      decoding: { temperature: null, seedPolicy: "provider-deterministic-when-supported-otherwise-null", seed: null },
      gooseBinary: "dist/runtime/bin/goose",
      sandboxRootsRequired: true,
    },
  },
  layers: { L0: {}, L1: {}, L2: {}, L3: {} },
  coverage: {
    population: ["active-skill", "active-agent", "active-recipe"],
    exemptionTypes: ["unsupported-provider", "non-behavioral", "premium-variant"],
    exemptionRequiredFields: ["component", "owner", "reason", "expiresAt"],
  },
  integrity: { minimumPairedRepetitions: 5, matchedPairFields: [] },
  thresholds: {
    minimumValidPairRate: 0.9,
    maximumExclusionRate: 0.1,
    minimumTreatmentDelta: 0.05,
    confidenceLevel: 0.95,
    minimumConfidenceIntervalLowerBoundExclusive: 0,
  },
  evidenceBindings: ["source", "locks", "runtime", "release", "goose", "evalHub", "provider", "model", "corpus", "profile"],
  publication: { requiredPassingProfiles: ["smoke", "release"], sameReleaseDigest: true, rejectStaleProof: true, maxEvidenceAgeMs: 86400000 },
};

const SOURCE_MANIFEST = {
  schema: "harness-source-manifest-v1",
  project: {},
  resolver: {},
  components: [
    { id: "skill:task-framing", kind: "skill", name: "task-framing", ownership: "internal",
      evaluation: { required: true, reason: "behavioral" }, targetSourcePath: "src/skills/task-framing" },
    { id: "agent:change-builder-premium", kind: "agent", name: "change-builder-premium",
      ownership: "internal", evaluation: { required: false, reason: "premium variant" },
      targetSourcePath: "src/agents/change-builder-premium.md" },
  ],
};

function makeRepo(): string {
  const r = temp();
  mkdirSync(join(r, "src/harness"), { recursive: true });
  mkdirSync(join(r, "src/app/eval-hub/evals"), { recursive: true });
  mkdirSync(join(r, "src/app"), { recursive: true });
  mkdirSync(join(r, "src/app/eval-hub/dist"), { recursive: true });
  writeFileSync(join(r, "src/harness/local-evaluation-profile.json"), JSON.stringify(PROFILE));
  writeFileSync(join(r, "src/harness/source-manifest.json"), JSON.stringify(SOURCE_MANIFEST));
  writeFileSync(join(r, "src/harness/external-skills.lock.json"), JSON.stringify({ schema: "harness-external-lock-v2", resolver: {}, skills: [] }));
  writeFileSync(join(r, "src/app/pnpm-lock.yaml"), "lock-content\n");
  // Placeholder eval-hub dist index (never actually run in tests)
  writeFileSync(join(r, "src/app/eval-hub/dist/index.js"), "#!/usr/bin/env node\nprocess.exit(0);\n");
  return r;
}

// ── Smoke evidence factory ────────────────────────────────────────────────────

function makeBindings(
  overrides: Partial<LocalEvaluationBindings> = {},
  profile: unknown = PROFILE
): LocalEvaluationBindings {
  const d = (s: string) => s.repeat(64).slice(0, 64);
  return {
    source: d("1"),
    locks: d("2"),
    runtime: d("3"),
    release: d("3"),          // runtime === release for local builds
    goose: d("5"),
    evalHub: d("6"),
    provider: d("7"),
    model: d("8"),
    corpus: d("9"),
    profile: digestLocalEvaluationProfile(profile),
    ...overrides,
  };
}

function makeSmokeEvidence(bindings: LocalEvaluationBindings): SmokeEvidence {
  return {
    schemaVersion: 1,
    profileVersion: (PROFILE as any).profileVersion,
    profile: "smoke",
    status: "pass",
    releaseDigest: bindings.release,
    bindings: {
      source: bindings.source,
      locks: bindings.locks,
      runtime: bindings.runtime,
      release: bindings.release,
      goose: bindings.goose,
      evalHub: bindings.evalHub,
      profile: bindings.profile,
    },
    checks: [{ name: "reproducibility", status: "pass", command: "build twice" }],
    startedAt: "2026-07-29T10:00:00Z",
    completedAt: "2026-07-29T10:30:00Z",
  };
}

// ── Mock operations ───────────────────────────────────────────────────────────

function makeOperations(releaseDigest: string, overrides: Partial<FullOperations> = {}): FullOperations {
  return {
    async build(output) { mkdirSync(output, { recursive: true }); },
    async resolve(staging) { mkdirSync(staging, { recursive: true }); writeFileSync(join(staging, "resolved.json"), "{}"); },
    project(_i, _e, runtime) {
      mkdirSync(join(runtime, "releases", releaseDigest, ".agents"), { recursive: true });
      mkdirSync(join(runtime, "releases", releaseDigest, ".goose"), { recursive: true });
      return releaseDigest;
    },
    activate() { /* no-op in test */ },
    async gooseVersion() { return "goose 9.0.0-test"; },
    async evalHubTree() { return "6".repeat(64); },
    async corpusTree() { return "9".repeat(64); },
    async sourceTree() { return "1".repeat(64); },
    async locksFile() { return "2".repeat(64); },
    ...overrides,
  };
}

/** Mock child runner that simulates a successful eval-hub run. */
const passingRunner: FullChildRunner = {
  async run() { return { exitCode: 0, stdout: "ok", stderr: "" }; },
};

const failingRunner: FullChildRunner = {
  async run() { return { exitCode: 1, stdout: "", stderr: "eval-hub failed" }; },
};

/** Mock store loader returning minimal valid layer state. */
function makeStoreLoader(manifestHash?: string): FullStoreLoader {
  const mh = manifestHash ?? "0".repeat(64);
  const layer: FullStoreLayer = {
    manifest: {
      schema: "eval-integrity-v2",
      runProvenanceId: "test-prov",
      cliArguments: [],
      subjects: [{ kind: "skills", subject: "task-framing", sourceHash: "s".repeat(64), evalIds: [1] }],
      repetitions: 5,
      treatments: [],
      taskPayloadHashes: {},
      maxTurnsByTask: {},
      fixtureHashes: {},
      executionEnvelope: {
        provider: "anthropic",
        model: "claude-opus-4-5",
        decoding: { temperature: null, seed: null },
        timeBudgetMs: null,
        tokenBudget: null,
        gooseRuntimeVersion: "9.0.0-test",
        evalHubRuntimeVersion: "0.1.0",
      },
      grader: { id: "g", version: "1" },
      rubric: { id: "r", version: "1" },
    },
    manifestHash: mh,
    report: {
      schema: "eval-integrity-v2",
      manifestHash: mh,
      pairMicro: {
        meanDeltaPp: 10, candidateMean: 0.8, baselineMean: 0.7, n: 5,
        interval: { method: "paired_t_95pct_pp_v1", lower: 1.0, upper: 19.0, reason: null },
      },
      subjectMacro: {
        meanDeltaPp: 10, candidateMean: 0.8, baselineMean: 0.7, n: 1,
        interval: { method: "paired_t_95pct_pp_v1", lower: 1.0, upper: 19.0, reason: null },
      },
      validPairCount: 5,
      includedSubjectCount: 1,
      excludedPairCounts: {},
      subjectFailureCounts: {},
    },
    terminals: [],
  };
  return { async loadLayer() { return layer; } };
}

/** Gate evaluator that passes (uses injected bindings so validation succeeds). */
function makePassingGate(): FullGateEvaluator {
  const layerEvidence = (kind: string, level: string) => ({
    level, kind, executed: true, passed: true,
    validPairRate: 1.0, exclusionRate: 0.0,
    pairMicro: {
      meanDeltaPp: 10, candidateMean: 0.8, baselineMean: 0.7, n: 5,
      interval: { lower: 1.0, upper: 19.0 },
    },
    subjectMacro: {
      meanDeltaPp: 10, candidateMean: 0.8, baselineMean: 0.7, n: 1,
      interval: { lower: 1.0, upper: 19.0 },
    },
    reasons: [],
  });
  return {
    evaluateReleaseGate() {
      return {
        passed: true,
        l0: { level: "L0", kind: "skills", executedAs: "skill_l0", executedSeparately: false, baselineMean: 0.7 },
        layers: [
          layerEvidence("skills", "L1"),
          layerEvidence("agents", "L2"),
          layerEvidence("recipes", "L3"),
        ],
        reasons: [],
      };
    },
  };
}

const failingGate: FullGateEvaluator = {
  evaluateReleaseGate() {
    return {
      passed: false,
      l0: { level: "L0", kind: "skills", executedAs: "skill_l0", executedSeparately: false, baselineMean: null },
      layers: [
        { level: "L1", kind: "skills", executed: false, passed: false, validPairRate: null,
          exclusionRate: null, pairMicro: null, subjectMacro: null, reasons: ["layer_state_missing"] },
      ],
      reasons: ["layer_state_missing"],
    };
  },
};

// ── validateEnv tests ─────────────────────────────────────────────────────────

describe("validateEnv", () => {
  it("accepts valid absolute env", () => {
    const result = validateEnv({
      GOOSE_PROVIDER: "anthropic",
      GOOSE_MODEL: "claude-opus-4-5",
      GOOSE_CLI: "/usr/local/bin/goose",
    });
    expect(result).toMatchObject({ provider: "anthropic", model: "claude-opus-4-5", gooSeCli: "/usr/local/bin/goose" });
  });

  it("rejects missing GOOSE_PROVIDER", () => {
    expect(() => validateEnv({ GOOSE_MODEL: "m", GOOSE_CLI: "/bin/goose" }))
      .toThrow("GOOSE_PROVIDER");
  });

  it("rejects empty GOOSE_PROVIDER", () => {
    expect(() => validateEnv({ GOOSE_PROVIDER: "  ", GOOSE_MODEL: "m", GOOSE_CLI: "/bin/goose" }))
      .toThrow("GOOSE_PROVIDER");
  });

  it("rejects missing GOOSE_MODEL", () => {
    expect(() => validateEnv({ GOOSE_PROVIDER: "p", GOOSE_CLI: "/bin/goose" }))
      .toThrow("GOOSE_MODEL");
  });

  it("rejects missing GOOSE_CLI", () => {
    expect(() => validateEnv({ GOOSE_PROVIDER: "p", GOOSE_MODEL: "m" }))
      .toThrow("GOOSE_CLI");
  });

  it("rejects relative GOOSE_CLI", () => {
    expect(() => validateEnv({ GOOSE_PROVIDER: "p", GOOSE_MODEL: "m", GOOSE_CLI: "relative/goose" }))
      .toThrow("absolute");
  });
});

describe("resolveEnv", () => {
  it("uses the active Goose provider, its model, and goose from PATH", async () => {
    const root = temp();
    const configDir = join(root, "config", "goose");
    const binDir = join(root, "bin");
    mkdirSync(configDir, { recursive: true });
    mkdirSync(binDir);
    writeFileSync(join(configDir, "config.yaml"), [
      "providers:",
      "  chatgpt_codex:",
      "    model: gpt-test",
      "active_provider: chatgpt_codex",
      "",
    ].join("\n"));
    writeFileSync(join(binDir, "goose"), "#!/bin/sh\n");
    chmodSync(join(binDir, "goose"), 0o755);

    await expect(resolveEnv({ XDG_CONFIG_HOME: join(root, "config"), PATH: binDir }))
      .resolves.toEqual({ provider: "chatgpt_codex", model: "gpt-test", gooSeCli: join(binDir, "goose") });
  });

  it("keeps explicit environment overrides", async () => {
    await expect(resolveEnv({
      GOOSE_PROVIDER: "anthropic",
      GOOSE_MODEL: "claude-test",
      GOOSE_CLI: "/custom/goose",
    })).resolves.toEqual({ provider: "anthropic", model: "claude-test", gooSeCli: "/custom/goose" });
  });
});

describe("calculateEvalTimeoutMs", () => {
  it("budgets paired repetitions across the Eval Hub worker pool", () => {
    expect(calculateEvalTimeoutMs(21, 5, 120_000)).toBe(8_700_000);
  });
});

// ── runLocalEvaluationFull integration tests ──────────────────────────────────

describe("runLocalEvaluationFull", () => {
  it("assembles successfully and exports four files on gate pass", async () => {
    const repo = makeRepo();
    const releaseDigest = "3".repeat(64);
    const bindings = makeBindings({
      release: releaseDigest,
      runtime: releaseDigest,
      goose: sha256Str(GOOSE_RAW),   // computed from mocked gooseVersion output
      evalHub: "6".repeat(64),
      corpus: "9".repeat(64),
    }, PROFILE);
    const smoke = makeSmokeEvidence(bindings);
    const evidenceDir = join(temp(), "evidence");

    const result = await runLocalEvaluationFull({
      repositoryRoot: repo,
      evidenceDir,
      smokeEvidence: smoke,
      processEnv: { GOOSE_PROVIDER: "anthropic", GOOSE_MODEL: "claude-opus-4-5", GOOSE_CLI: "/usr/local/bin/goose" },
      operations: makeOperations(releaseDigest, {
        async gooseVersion() { return GOOSE_RAW; },
        async evalHubTree() { return bindings.evalHub; },
        async corpusTree() { return bindings.corpus; },
      }),
      runner: passingRunner,
      storeLoader: makeStoreLoader(),
      gateEvaluator: makePassingGate(),
      now: () => new Date("2026-07-29T11:00:00Z"),
      sandboxOptions: { tempParent: temp(), userHome: temp() },
    });

    expect(result.status).toBe("pass");
    expect(existsSync(result.attestationPath)).toBe(true);
    expect(existsSync(result.bindingsPath)).toBe(true);
    expect(existsSync(join(evidenceDir, "attestation.html"))).toBe(true);
    expect(existsSync(join(evidenceDir, "run-meta.json"))).toBe(true);

    // No secrets in meta output
    const meta = JSON.parse(readFileSync(join(evidenceDir, "run-meta.json"), "utf8"));
    expect(meta.provider).toBe("anthropic");
    expect(meta.model).toBe("claude-opus-4-5");
    expect(meta).not.toHaveProperty("apiKey");
    expect(meta).not.toHaveProperty("token");

    // Bindings are all SHA256 digests
    const binJson = JSON.parse(readFileSync(result.bindingsPath, "utf8"));
    for (const key of ["source", "locks", "runtime", "release", "goose", "evalHub", "provider", "model", "corpus", "profile"]) {
      expect(binJson[key]).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("fails before provider execution when a mapped OAuth cache is absent", async () => {
    const repo = makeRepo();
    let built = false;
    const operations = makeOperations("3".repeat(64), { async build() { built = true; } });
    await expect(runLocalEvaluationFull({
      repositoryRoot: repo,
      processEnv: { GOOSE_PROVIDER: "chatgpt_codex", GOOSE_MODEL: "m", GOOSE_CLI: "/usr/local/bin/goose" },
      operations,
      sandboxOptions: { tempParent: temp(), userHome: temp() },
    })).rejects.toThrow("credential source is missing");
    expect(built).toBe(false);
  });

  it("fails closed on gate failure and does not export any files", async () => {
    const repo = makeRepo();
    const releaseDigest = "3".repeat(64);
    const bindings = makeBindings({ release: releaseDigest, runtime: releaseDigest }, PROFILE);
    const smoke = makeSmokeEvidence(bindings);
    const evidenceDir = join(temp(), "evidence-fail");

    await expect(
      runLocalEvaluationFull({
        repositoryRoot: repo,
        evidenceDir,
        smokeEvidence: smoke,
        processEnv: { GOOSE_PROVIDER: "anthropic", GOOSE_MODEL: "m", GOOSE_CLI: "/usr/local/bin/goose" },
        operations: makeOperations(releaseDigest),
        runner: passingRunner,
        storeLoader: makeStoreLoader(),
        gateEvaluator: failingGate,
        sandboxOptions: { tempParent: temp(), userHome: temp() },
      })
    ).rejects.toThrow("Release gate failed");

    // No evidence files exported on failure
    expect(existsSync(evidenceDir)).toBe(false);
  });

  it("fails closed when eval-hub child exits non-zero and does not export", async () => {
    const repo = makeRepo();
    const releaseDigest = "3".repeat(64);
    const bindings = makeBindings({ release: releaseDigest, runtime: releaseDigest }, PROFILE);
    const smoke = makeSmokeEvidence(bindings);
    const evidenceDir = join(temp(), "evidence-child-fail");

    const stdoutFailureRunner: FullChildRunner = {
      async run() { return { exitCode: 1, stdout: "stdout diagnostic", stderr: "" }; },
    };
    await expect(
      runLocalEvaluationFull({
        repositoryRoot: repo,
        evidenceDir,
        smokeEvidence: smoke,
        processEnv: { GOOSE_PROVIDER: "anthropic", GOOSE_MODEL: "m", GOOSE_CLI: "/usr/local/bin/goose" },
        operations: makeOperations(releaseDigest),
        runner: stdoutFailureRunner,
        storeLoader: makeStoreLoader(),
        gateEvaluator: makePassingGate(),
        sandboxOptions: { tempParent: temp(), userHome: temp() },
      })
    ).rejects.toThrow("eval-hub exited with code 1: stdout diagnostic");

    expect(existsSync(evidenceDir)).toBe(false);
  });

  it("cleans up sandbox temp root even when an operation throws", async () => {
    const repo = makeRepo();
    const releaseDigest = "3".repeat(64);
    const sbTemp = temp();
    let sandboxRoot: string | undefined;

    const failOps = makeOperations(releaseDigest, {
      async build() {
        // Capture the sandbox root from the running sandbox env for later check.
        // Build is called first — we throw here to simulate early failure.
        throw new Error("build failed");
      },
    });

    await expect(
      runLocalEvaluationFull({
        repositoryRoot: repo,
        processEnv: { GOOSE_PROVIDER: "anthropic", GOOSE_MODEL: "m", GOOSE_CLI: "/usr/local/bin/goose" },
        operations: failOps,
        sandboxOptions: { tempParent: sbTemp, userHome: temp() },
      })
    ).rejects.toThrow("build failed");

    // The sandbox temp directory under sbTemp should be removed after cleanup.
    const entries = existsSync(sbTemp)
      ? require("node:fs").readdirSync(sbTemp)
      : [];
    // Temp entries created by mkdtempSync inside createSandbox should be cleaned.
    // After cleanup() the harness-sandbox-* dir should not exist.
    const sandboxDirs = (entries as string[]).filter((e: string) => e.startsWith("harness-sandbox-"));
    expect(sandboxDirs).toHaveLength(0);
  });

  it("rejects smoke evidence with mismatched release digest", async () => {
    const repo = makeRepo();
    const releaseDigest = "3".repeat(64);
    const wrongDigest = "f".repeat(64);
    const bindings = makeBindings({ release: wrongDigest, runtime: wrongDigest }, PROFILE);
    const smoke = makeSmokeEvidence(bindings);
    const evidenceDir = join(temp(), "evidence-mismatch");
    const smokeFile = join(temp(), "smoke.json");
    writeFileSync(smokeFile, JSON.stringify(smoke));

    await expect(
      runLocalEvaluationFull({
        repositoryRoot: repo,
        evidenceDir,
        smokeEvidencePath: smokeFile,
        processEnv: { GOOSE_PROVIDER: "anthropic", GOOSE_MODEL: "m", GOOSE_CLI: "/usr/local/bin/goose" },
        operations: makeOperations(releaseDigest),
        sandboxOptions: { tempParent: temp(), userHome: temp() },
      })
    ).rejects.toThrow("release digest");
  });
});
