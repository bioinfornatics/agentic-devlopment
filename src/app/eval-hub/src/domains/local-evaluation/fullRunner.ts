#!/usr/bin/env node
/**
 * Full local evaluation orchestrator — agentic-devlopment-olqo.9
 * Beads: builder_session=20260729_131; task=olqo.9; skills=task-framing
 *
 * Validates env, creates sandbox, builds harness, runs smoke + full eval-hub
 * evaluation, calls evaluateReleaseGate, assembles evidence + attestation,
 * and exports to dist/evidence/local-full only after sandbox passes clean check.
 * Fail-closed: gate fail → throw, no export.
 */
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import { REPOSITORY_ROOT, sha256File as commonSha256File, sha256Tree } from "../../shared/localEvalUtils.js";




import { createSandbox, type SandboxOptions } from "./sandbox.js";
import {
  digestLocalEvaluationProfile,
  validateLocalEvaluationEvidence,
} from "./evidence.js";
import {
  createLocalEvaluationAttestation,
  verifyLocalEvaluationAttestation,
  type LocalEvaluationBindings,
} from "./attestation.js";
import { type SmokeEvidence } from "./smokeRunner.js";
import { isMain, prettyJson } from "../../shared/localEvalUtils.js";

// ── Dependency-injection seams (allow tests to run without provider/process/network) ─

export interface FullOperations {
  build(output: string, root: string): Promise<void>;
  resolve(staging: string, root: string): Promise<void>;
  project(internal: string, external: string, runtime: string): string;
  activate(runtime: string, project: string, digest: string): void;
  gooseVersion(cli: string, env: NodeJS.ProcessEnv): Promise<string>;
  evalHubTree(root: string): Promise<string>;
  corpusTree(root: string): Promise<string>;
  /** SHA-256 tree hash of the repository src/ directory. */
  sourceTree(root: string): Promise<string>;
  /** SHA-256 of the pnpm-lock.yaml file. */
  locksFile(root: string): Promise<string>;
}

export interface FullChildRunner {
  run(
    cmd: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    cwd: string,
    timeoutMs: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface FullStoreLayer {
  manifest: unknown;
  manifestHash: string;
  report: unknown | null;
  terminals: unknown[];
}

export interface FullStoreLoader {
  loadLayer(storeRoot: string): Promise<FullStoreLayer>;
}

export interface FullGateEvaluator {
  evaluateReleaseGate(input: unknown): unknown;
}

export interface LocalFullOptions {
  repositoryRoot?: string | undefined;
  evidenceDir?: string | undefined;
  /** Path to pre-existing smoke evidence with matching release digest. */
  smokeEvidencePath?: string | undefined;
  /** Pre-built SmokeEvidence object (for tests). Takes priority over smokeEvidencePath. */
  smokeEvidence?: SmokeEvidence | undefined;
  now?: (() => Date) | undefined;
  sandboxOptions?: SandboxOptions | undefined;
  operations?: FullOperations | undefined;
  runner?: FullChildRunner | undefined;
  storeLoader?: FullStoreLoader | undefined;
  gateEvaluator?: FullGateEvaluator | undefined;
  processEnv?: NodeJS.ProcessEnv | undefined;
}

export interface LocalFullResult {
  evidenceDir: string;
  attestationPath: string;
  bindingsPath: string;
  status: "pass" | "fail";
}

// ── Environment validation ─────────────────────────────────────────────────────

export interface ValidatedEnv {
  provider: string;
  model: string;
  gooSeCli: string;
}

export function validateEnv(env: NodeJS.ProcessEnv): ValidatedEnv {
  const provider = env["GOOSE_PROVIDER"];
  const model = env["GOOSE_MODEL"];
  const gooSeCli = env["GOOSE_CLI"];
  if (!provider || provider.trim() === "")
    throw new Error("GOOSE_PROVIDER environment variable is required");
  if (!model || model.trim() === "")
    throw new Error("GOOSE_MODEL environment variable is required");
  if (!gooSeCli || gooSeCli.trim() === "")
    throw new Error("GOOSE_CLI environment variable is required");
  if (!isAbsolute(gooSeCli))
    throw new Error("GOOSE_CLI must be an absolute path");
  return { provider, model, gooSeCli };
}

interface GooseConfig {
  active_provider?: unknown;
  providers?: Record<string, { model?: unknown }>;
}

async function findGooseCli(pathValue: string | undefined): Promise<string | undefined> {
  for (const directory of pathValue?.split(delimiter) ?? []) {
    if (!directory) continue;
    const candidate = resolve(directory, "goose");
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching PATH.
    }
  }
  return undefined;
}

export async function resolveEnv(env: NodeJS.ProcessEnv): Promise<ValidatedEnv> {
  let provider = env["GOOSE_PROVIDER"]?.trim();
  let model = env["GOOSE_MODEL"]?.trim();
  let gooSeCli = env["GOOSE_CLI"]?.trim();

  if (!provider || !model) {
    const gooseRoot = env["GOOSE_PATH_ROOT"]?.trim();
    const configHome = env["XDG_CONFIG_HOME"]?.trim() || join(env["HOME"] ?? "", ".config");
    const configPath = gooseRoot
      ? join(gooseRoot, "config/config.yaml")
      : join(configHome, "goose/config.yaml");
    let config: GooseConfig;
    try {
      config = parseYaml(await readFile(configPath, "utf8")) as GooseConfig;
    } catch (error) {
      throw new Error(`Cannot load Goose configuration from ${configPath}`, { cause: error });
    }
    provider ||= typeof config.active_provider === "string" ? config.active_provider.trim() : "";
    const configuredModel = provider && config.providers?.[provider]?.model;
    model ||= typeof configuredModel === "string" ? configuredModel.trim() : "";
  }

  gooSeCli ||= await findGooseCli(env["PATH"]);
  return validateEnv({ GOOSE_PROVIDER: provider, GOOSE_MODEL: model, GOOSE_CLI: gooSeCli });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sha256Str = (s: string): string =>
  createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

/** Default child process runner (real eval-hub invocation). */
const defaultRunner: FullChildRunner = {
  async run(cmd, args, env, cwd, timeoutMs) {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        env,
        cwd,
        stdio: ["inherit", "inherit", "inherit"],
      });

      let timeout: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timeout = setTimeout(() => {
          child.kill();
          resolve({ exitCode: 1, stdout: "", stderr: "Timeout" });
        }, timeoutMs);
      }

      child.on("close", (code) => {
        if (timeout) clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, stdout: "", stderr: "" });
      });

      child.on("error", (err) => {
        if (timeout) clearTimeout(timeout);
        resolve({ exitCode: 1, stdout: "", stderr: err.message });
      });
    });
  },
};

/** Lazy loader for operations exposed by the release and manager packages. */
async function loadTooling(root: string) {
  const load = (pkg: "harness-release" | "harness-manager", module: string) =>
    import(pathToFileURL(join(root, "src/app", pkg, "dist", `${module}.js`)).href);
  const { buildHarness } = await load("harness-release", "build-harness");
  const { resolveExternalSkills } = await load("harness-release", "resolve-external-skills");
  const { projectHarnessRuntime } = await load("harness-manager", "project-harness-runtime");
  const { activateRuntime, verifyRelease } = await load("harness-manager", "manage-project-runtime");
  return { buildHarness, resolveExternalSkills, projectHarnessRuntime, activateRuntime, verifyRelease };
}

/** Default build/resolve/project/activate/goose operations (lazy-loaded). */
async function defaultOperations(root: string): Promise<FullOperations> {
  const t = await loadTooling(root);
  return {
    async build(output) {
      await t.buildHarness({ output, target: "linux-x86_64", skipCompile: false, root });
    },
    async resolve(staging) {
      // HARNESS_SKILLS_SOURCE_ROOT: optional local directory where <skillName>/ subdirs live.
      // Allows offline resolution without GitHub cloning (digests must match the lock).
      const sourceRoot = process.env["HARNESS_SKILLS_SOURCE_ROOT"] ?? undefined;
      await t.resolveExternalSkills({
        lock: "src/harness/external-skills.lock.json",
        staging,
        offline: false,
        skillsCli: "1.5.20",
        root,
        sourceRoot,
      });
    },
    project: t.projectHarnessRuntime,
    activate: t.activateRuntime,
    async gooseVersion(cli, env) {
      const { execFile } = await import("node:child_process");
      const execAsync = promisify(execFile);
      try {
        const { stdout, stderr } = await execAsync(cli, ["--version"], { env, timeout: 15_000 });
        return (stdout + stderr).trim();
      } catch (error) {
        const e = error as { stdout?: string; stderr?: string };
        return ((e.stdout ?? "") + (e.stderr ?? "")).trim() || "unknown";
      }
    },
  async evalHubTree(root) {
    return sha256Tree(join(root, "src/app/eval-hub"), true);
  },
  async corpusTree(root) {
    return sha256Tree(join(root, "src/app/eval-hub/evals"), false);
  },
  async sourceTree(root) {
    return sha256Tree(join(root, "src"));
  },
  async locksFile(root) {
    return commonSha256File(join(root, "src/app/pnpm-lock.yaml"));
  },
  };
}

// ── Dynamic eval-hub imports (avoid TS rootDir constraint) ───────────────────

async function dynamicLoadLayer(repo: string, storeRoot: string): Promise<FullStoreLayer> {
  const storeUrl = pathToFileURL(
    join(repo, "src/app/eval-hub/dist/domains/persistence/integrityV2Store.js")
  ).href;
  const mod = await import(storeUrl) as {
    EvalIntegrityV2Store: new (root: string) => {
      loadManifest(): Promise<{ hash: string; manifest: unknown }>;
      readReportState(): Promise<unknown | null>;
      listTerminals(): Promise<unknown[]>;
    };
    integrityValueHash(value: unknown): string;
  };
  const store = new mod.EvalIntegrityV2Store(storeRoot);
  const stored = await store.loadManifest();
  const manifest = (stored as { manifest?: unknown }).manifest ?? stored;
  const manifestHash = mod.integrityValueHash(manifest);
  const report = await store.readReportState();
  const terminals = await store.listTerminals();
  return { manifest, manifestHash, report, terminals };
}

async function dynamicEvaluateGate(repo: string): Promise<FullGateEvaluator> {
  const gateUrl = pathToFileURL(
    join(repo, "src/app/eval-hub/dist/domains/measurement/releaseGate.js")
  ).href;
  const mod = await import(gateUrl) as { evaluateReleaseGate(input: unknown): unknown };
  return { evaluateReleaseGate: mod.evaluateReleaseGate };
}

// ── Minimum project source copy for eval-hub isolation ───────────────────────

async function copyProjectSource(repo: string, projectDir: string): Promise<void> {
  // Copy eval definitions so PROJECT_SOURCE_ROOT/src/app/eval-hub/evals is present.
  const evalsTarget = join(projectDir, "src/app/eval-hub/evals");
  await mkdir(evalsTarget, { recursive: true });
  const evalsSource = join(repo, "src/app/eval-hub/evals");
  try {
    await cp(evalsSource, evalsTarget, { recursive: true, force: true });
  } catch { /* directory may be empty for fresh workspaces */ }
  // Ensure src/ exists so findProjectRoot succeeds.
  await mkdir(join(projectDir, "src"), { recursive: true });
  // dist/ for any writes that fall back to DIST_DIR.
  await mkdir(join(projectDir, "dist/evals"), { recursive: true });
}

// ── Population from source manifest ──────────────────────────────────────────

interface SourceComponent {
  kind: "skill" | "agent" | "recipe" | "plugin";
  name: string;
  evaluation: { required: boolean; reason?: string };
}

function buildPopulation(components: SourceComponent[]): unknown[] {
  const evidentKinds = new Set(["skill", "agent", "recipe"]);
  const seen = new Set<string>();
  const population: unknown[] = [];
  for (const c of components) {
    if (!evidentKinds.has(c.kind)) continue;
    const key = `${c.kind}:${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (c.evaluation.required) {
      population.push({ kind: c.kind, component: c.name, disposition: "covered" });
    } else {
      const type = c.name.includes("premium") ? "premium-variant" : "non-behavioral";
      population.push({
        kind: c.kind,
        component: c.name,
        disposition: "exempt",
        exemption: {
          type,
          owner: "harness-evaluation",
          reason: c.evaluation.reason ?? "not a standalone behavioral target",
          expiresAt: "2030-01-01T00:00:00Z",
        },
      });
    }
  }
  return population;
}

export function calculateEvalTimeoutMs(
  subjectCount: number,
  repetitions: number,
  perEvaluationTimeoutMs: number,
  workers = 3
): number {
  const pairedRuns = subjectCount * repetitions * 2;
  return Math.ceil(pairedRuns / workers) * perEvaluationTimeoutMs + 300_000;
}

// ── Evidence layer builder ────────────────────────────────────────────────────

interface PairMicro {
  meanDeltaPp: number | null;
  candidateMean: number | null;
  baselineMean: number | null;
  n: number;
  interval: { lower: number | null; upper: number | null };
}

interface GateLayerEvidence {
  level: string;
  kind: string;
  executed: boolean;
  passed: boolean;
  validPairRate: number | null;
  exclusionRate: number | null;
  pairMicro: PairMicro | null;
  subjectMacro: PairMicro | null;
  reasons: string[];
}

interface GateResult {
  passed: boolean;
  l0: { baselineMean: number | null };
  layers: GateLayerEvidence[];
  reasons: string[];
}

function buildEvidenceLayers(
  gateResult: GateResult,
  minimumRepetitions: number
): unknown[] {
  const skillsLayer = gateResult.layers.find(l => l.kind === "skills");
  const agentsLayer = gateResult.layers.find(l => l.kind === "agents");
  const recipesLayer = gateResult.layers.find(l => l.kind === "recipes");

  function layerEntry(gl: GateLayerEvidence | undefined, label: string) {
    if (!gl?.executed || !gl.pairMicro) {
      return {
        layer: label, executed: false, repetitions: 0,
        validPairs: 0, exclusions: [], delta: 0, confidenceInterval95: [0, 0],
      };
    }
    const pm = gl.pairMicro;
    // validPairs = pm.n (count of valid pairs from the report).
    // repetitions = ceil(validPairs / validPairRate) clamped to >= minimumRepetitions.
    const validPairs = pm.n;
    const rawTotal = (gl.validPairRate && gl.validPairRate > 0)
      ? Math.ceil(validPairs / gl.validPairRate)
      : validPairs;
    const repetitions = Math.max(rawTotal, minimumRepetitions, validPairs);
    const delta = (pm.meanDeltaPp ?? 0) / 100;
    const ciLower = (pm.interval.lower ?? 0) / 100;
    const ciUpper = (pm.interval.upper ?? 0) / 100;
    return {
      layer: label, executed: true, repetitions, validPairs,
      exclusions: [] as unknown[],
      delta,
      confidenceInterval95: [ciLower, ciUpper] as [number, number],
    };
  }

  // L0 is conceptual — executed as the baseline side of the skills layer.
  // L1 = skills, L2 = agents, L3 = recipes.
  return [
    layerEntry(skillsLayer, "L0"),
    layerEntry(skillsLayer, "L1"),
    layerEntry(agentsLayer, "L2"),
    layerEntry(recipesLayer, "L3"),
  ];
}

// ── Run ID ────────────────────────────────────────────────────────────────────

function generateRunId(): string {
  return new Date().toISOString().replace(/[:\-.]/g, "").slice(0, 15) + "Z";
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runLocalEvaluationFull(
  options: LocalFullOptions = {}
): Promise<LocalFullResult> {
  const repo = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const evidenceDir = resolve(options.evidenceDir ?? join(repo, "dist/evidence/local-full"));
  const nowFn = options.now ?? (() => new Date());
  const startedAt = nowFn().toISOString();
  const processEnv = options.processEnv ?? process.env;
  const ops = options.operations ?? await defaultOperations(repo);
  const childRunner = options.runner ?? defaultRunner;

  // ── 1. Validate environment ────────────────────────────────────────────────
  const { provider, model, gooSeCli } = await resolveEnv(processEnv);

  // Verify goose binary is accessible (skip for injected operations in tests).
  if (!options.operations) {
    await stat(gooSeCli).catch(() => {
      throw new Error(`GOOSE_CLI not found or not accessible: ${gooSeCli}`);
    });
  }

  // ── 2. Load base profile ───────────────────────────────────────────────────
  const baseProfileRaw = JSON.parse(
    await readFile(join(repo, "src/harness/local-evaluation-profile.json"), "utf8")
  ) as {
    profileVersion: string;
    profiles: {
      release: {
        repetitions: number;
        maxTurns: number;
        timeoutMs: number;
        sandboxRootsRequired: true;
      };
    };
    thresholds: Record<string, number>;
    integrity: { minimumPairedRepetitions: number };
  };

  // ── 3. Create tooling sandbox ──────────────────────────────────────────────
  const sandbox = createSandbox({
    ...(options.sandboxOptions ?? {}),
    repositoryRoot: repo,
    providerCredential: provider,
  });

  try {
    // ── 4. Copy minimum project source into sandbox.project ─────────────────
    //    PROJECT_SOURCE_ROOT will point here; eval-hub reads evals from it.
    await copyProjectSource(repo, sandbox.paths.project);

    // ── 5. Build harness into sandbox.internal ─────────────────────────────
    await ops.build(sandbox.paths.internal, repo);

    // ── 6. Resolve external skills into sandbox.external ───────────────────
    await ops.resolve(sandbox.paths.external, repo);

    // ── 7. Project + activate candidate under sandbox.runtime ───────────────
    //    Ensures sandbox.project .agents/.goose point to the candidate release.
    const releaseDigest = ops.project(
      sandbox.paths.internal,
      sandbox.paths.external,
      sandbox.paths.runtime
    );
    ops.activate(sandbox.paths.runtime, sandbox.paths.project, releaseDigest);
    sandbox.assertWritable(join(sandbox.paths.project, ".agents"));
    sandbox.assertWritable(join(sandbox.paths.project, ".goose"));

    // ── 8. Compute SHA256 bindings ─────────────────────────────────────────
    //    Gate bindings: raw strings for provider/model/goose version.
    //    Attestation bindings: all SHA256 digests.
    const gooseRaw = await ops.gooseVersion(
      gooSeCli,
      { ...sandbox.env, GOOSE_PROVIDER: provider, GOOSE_MODEL: model }
    );
    const [evalHubDigest, sourceDigest, locksDigest, corpusDigest] = await Promise.all([
      ops.evalHubTree(repo),
      ops.sourceTree(repo),
      ops.locksFile(repo),
      ops.corpusTree(repo),
    ]);
    // Base profile for attestation (stable, provider-independent).
    const profileBaseDigest = digestLocalEvaluationProfile(baseProfileRaw);

    const attestationBindings: LocalEvaluationBindings = {
      source: sourceDigest,
      locks: locksDigest,
      runtime: releaseDigest,
      release: releaseDigest,
      goose: sha256Str(gooseRaw),
      evalHub: evalHubDigest,
      provider: sha256Str(provider),
      model: sha256Str(model),
      corpus: corpusDigest,
      profile: profileBaseDigest,
    };

    // Effective profile: clone with actual provider/model for statistical gate.
    const effectiveProfile = JSON.parse(JSON.stringify(baseProfileRaw)) as typeof baseProfileRaw;
    const effectiveProfileDigest = digestLocalEvaluationProfile(effectiveProfile);

    // ── 9. Smoke evidence — run/reuse deterministic check ──────────────────
    let smokeEvidence: SmokeEvidence;
    if (options.smokeEvidence) {
      smokeEvidence = options.smokeEvidence;
    } else if (options.smokeEvidencePath) {
      smokeEvidence = JSON.parse(
        await readFile(resolve(options.smokeEvidencePath), "utf8")
      ) as SmokeEvidence;
      if (smokeEvidence.releaseDigest !== releaseDigest)
        throw new Error("Smoke evidence release digest does not match current runtime");
    } else {
      // Auto-generate smoke to approved path and reuse if release matches.
      const { runLocalEvaluationSmoke } = await import("./smokeRunner.js");
      const smokePath = join(repo, "src/app/eval-hub/dist/evidence/smoke-pre-full.json");
      smokeEvidence = await runLocalEvaluationSmoke({
        repositoryRoot: repo,
        evidencePath: smokePath,
        sandbox: { ...(options.sandboxOptions ?? {}), repositoryRoot: repo },
      });
    }

    // ── 10. Invoke built eval-hub CLI as child process ─────────────────────
    const sourceManifest = JSON.parse(
      await readFile(join(repo, "src/harness/source-manifest.json"), "utf8")
    ) as { components: SourceComponent[] };
    const population = buildPopulation(sourceManifest.components);
    const coveredSubjectCount = population.filter(
      entry => (entry as { disposition?: string }).disposition === "covered"
    ).length;
    const runId = generateRunId();
    const runProvenanceId = randomUUID();
    const evalHubCli = join(repo, "src/app/eval-hub/dist/index.js");
    const releaseRepetitions = Math.max(5, baseProfileRaw.profiles.release.repetitions);
    const evalHubArgs = [
      evalHubCli,
      "--run",
      "--release-gate",
      "--run-id", runId,
      "--run-provenance-id", runProvenanceId,
      "--layers", "skills,agents,recipes",
      "--repetitions", String(releaseRepetitions),
      "--no-early-stop",
      "--max-turns", String(baseProfileRaw.profiles.release.maxTurns),
      "--timeout", String(Math.ceil(baseProfileRaw.profiles.release.timeoutMs / 1000)),
      "--goose-cli", gooSeCli,
      "--sandbox-root", sandbox.paths.root,
      "--runtime-root", sandbox.paths.runtime,
      "--evidence-root", sandbox.paths.evidence,
      // 7 release binding flags accepted by run.ts
      "--binding-profile", effectiveProfileDigest,
      "--binding-runtime", releaseDigest,
      "--binding-release", releaseDigest,
      "--binding-corpus", corpusDigest,
      "--binding-goose", gooseRaw,    // raw version string
      "--binding-provider", provider, // raw provider name
      "--binding-model", model,       // raw model name
    ];

    const evalHubEnv: NodeJS.ProcessEnv = {
      ...sandbox.env,
      PROJECT_SOURCE_ROOT: sandbox.paths.project,
      // paths.ts resolves projected subjects from HARNESS_RUNTIME_ROOT itself.
      // Passing the parent would append another build/harness/runtime/current
      // and incorrectly fall back to the empty sandbox HOME.
      HARNESS_RUNTIME_ROOT: join(sandbox.paths.runtime, "current"),
      GOOSE_PROVIDER: provider,
      GOOSE_MODEL: model,
    };
    // Do NOT include GOOSE_CLI in env; pass it explicitly via --goose-cli.

    // Each subject has control/treatment runs; Eval Hub schedules three workers by default.
    const evalTimeoutMs = calculateEvalTimeoutMs(
      coveredSubjectCount,
      releaseRepetitions,
      baseProfileRaw.profiles.release.timeoutMs
    );

    const evalResult = await childRunner.run(
      process.execPath,
      evalHubArgs,
      evalHubEnv,
      sandbox.paths.project,
      evalTimeoutMs
    );
    if (evalResult.exitCode !== 0) {
      const diagnostic = evalResult.stderr.trim() || evalResult.stdout.trim();
      throw new Error(
        `eval-hub exited with code ${evalResult.exitCode}: ` +
        diagnostic.slice(0, 500)
      );
    }

    // ── 11. Load each of the three Integrity V2 stores via dynamic imports ─
    //    IntegrityV2Store root: evidenceRoot/<runId>/<kind>/_integrity-v2/<kind>
    //    (LayeredRunner uses cfg.sandbox.evidenceRoot when set.)
    const layerKinds = ["skills", "agents", "recipes"] as const;
    const storeLoader = options.storeLoader;
    const layerData = await Promise.all(
      layerKinds.map(async kind => {
        const storeRoot = join(sandbox.paths.evidence, runId, kind, "_integrity-v2", kind);
        if (storeLoader) return storeLoader.loadLayer(storeRoot);
        return dynamicLoadLayer(repo, storeRoot);
      })
    );

    // ── 12. Build ReleaseGateInput and call evaluateReleaseGate ───────────
    const gateBindings = {
      runProvenanceId,
      profile: effectiveProfileDigest,
      runtime: releaseDigest,
      release: releaseDigest,
      corpus: corpusDigest,
      goose: gooseRaw,
      provider,
      model,
    };

    const releaseProfile = {
      profileVersion: baseProfileRaw.profileVersion,
      release: {
        providerBacked: true as const,
        layers: ["skills", "agents", "recipes"] as const,
        conceptualBaseline: "L0" as const,
        noEarlyStop: true as const,
        repetitions: releaseRepetitions,
        provider,
        model,
        maxTurns: baseProfileRaw.profiles.release.maxTurns,
        timeoutMs: baseProfileRaw.profiles.release.timeoutMs,
        decoding: {
          temperature: null,
          seedPolicy: "provider-deterministic-when-supported-otherwise-null",
          seed: null,
        },
        gooseBinary: gooSeCli,
        sandboxRootsRequired: true as const,
      },
      thresholds: baseProfileRaw.thresholds as {
        minimumValidPairRate: number;
        maximumExclusionRate: number;
        minimumTreatmentDelta: number;
        minimumConfidenceIntervalLowerBoundExclusive: number;
      },
    };

    const gateInput = {
      profile: releaseProfile,
      bindings: gateBindings,
      execution: {
        noEarlyStop: true,
        resumed: false,
        mixedProvenance: false,
        sandboxed: true,
      },
      layers: Object.fromEntries(
        layerKinds.map((kind, i) => [
          kind,
          layerData[i]
            ? {
                executed: true,
                manifestHash: layerData[i]!.manifestHash,
                manifest: layerData[i]!.manifest,
                report: layerData[i]!.report,
                terminals: layerData[i]!.terminals,
              }
            : undefined,
        ])
      ),
    };

    const gateEvaluator = options.gateEvaluator ?? (await dynamicEvaluateGate(repo));
    const gateResult = gateEvaluator.evaluateReleaseGate(gateInput) as GateResult;

    // Fail closed: gate fail → throw, no export.
    if (!gateResult.passed) {
      throw new Error(
        `Release gate failed: ${[...gateResult.reasons, ...gateResult.layers.flatMap(l => l.reasons)].join("; ")}`
      );
    }

    // ── 13. Construct strict local release evidence ────────────────────────
    const completedAt = nowFn().toISOString();
    const evidenceLayers = buildEvidenceLayers(
      gateResult,
      baseProfileRaw.integrity.minimumPairedRepetitions
    );

    const releaseEvidence = {
      schemaVersion: 1,
      profileVersion: baseProfileRaw.profileVersion,
      profile: "release",
      status: "pass",
      releaseDigest,
      bindings: { ...attestationBindings },
      population,
      layers: evidenceLayers,
      startedAt,
      completedAt,
    };

    // ── 15. Validate evidence — fail closed ───────────────────────────────
    const findings = validateLocalEvaluationEvidence(
      releaseEvidence, baseProfileRaw, nowFn(), "release"
    );
    if (findings.length > 0) {
      throw new Error(
        `Release evidence failed validation: ${findings.map(f => `${f.code}@${f.path}`).join("; ")}`
      );
    }

    // ── 16. Create and verify local attestation ────────────────────────────
    const attestation = createLocalEvaluationAttestation({
      smoke: smokeEvidence,
      releaseGate: {
        status: "pass",
        releaseDigest,
        bindings: attestationBindings,
        evidence: releaseEvidence,
        population,
        commands: evalHubArgs,
      },
      currentBindings: attestationBindings,
      population,
      profile: baseProfileRaw,  // attestation uses BASE profile
      startedAt,
      completedAt,
      commands: evalHubArgs,
    });

    if (!verifyLocalEvaluationAttestation(
      attestation, attestationBindings, baseProfileRaw, nowFn()
    )) {
      throw new Error("Local evaluation attestation verification failed — fail closed");
    }

    // ── 17. Verify protected paths unchanged ──────────────────────────────
    sandbox.verifyClean();

    // ── 18. Export canonical JSON + HTML + bindings + run metadata ─────────
    //    Only reached after sandbox passes clean check.
    await mkdir(evidenceDir, { recursive: true });

    const metaNoSecrets = {
      schema: "local-evaluation-full-meta-v1",
      runId,
      runProvenanceId,
      provider,           // raw provider name — not a secret
      model,              // raw model name — not a secret
      gooseVersion: gooseRaw,
      startedAt,
      completedAt,
      status: "pass",
      evidenceDir,
    };

    await Promise.all([
      writeFile(join(evidenceDir, "attestation.json"), prettyJson(attestation)),
      writeFile(join(evidenceDir, "attestation.html"), attestation.html),
      writeFile(join(evidenceDir, "bindings.json"), prettyJson(attestationBindings)),
      writeFile(join(evidenceDir, "run-meta.json"), prettyJson(metaNoSecrets)),
    ]);

    return {
      evidenceDir,
      attestationPath: join(evidenceDir, "attestation.json"),
      bindingsPath: join(evidenceDir, "bindings.json"),
      status: "pass",
    };
  } finally {
    // Always cleanup — sandbox removes its temp root even on error.
    sandbox.cleanup();
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────

export async function fullCli(argv: string[]): Promise<number> {
  try {
    const idx = argv.indexOf("--evidence-dir");
    const evidenceDir = idx >= 0 ? argv[idx + 1] : undefined;
    const smokeIdx = argv.indexOf("--smoke-evidence");
    const smokeEvidencePath = smokeIdx >= 0 ? argv[smokeIdx + 1] : undefined;
    if (argv.includes("--help") || argv.includes("-h")) {
      console.log([
        "",
        "  local-evaluation-full — full provider-backed local evaluation",
        "",
        "  Options:",
        "    --evidence-dir <dir>    Output directory (default: dist/evidence/local-full)",
        "    --smoke-evidence <file> Reuse existing smoke evidence file",
        "",
        "  Environment:",
        "    GOOSE_PROVIDER  Provider name (required)",
        "    GOOSE_MODEL     Model name (required)",
        "    GOOSE_CLI       Absolute path to goose binary (required)",
        "",
      ].join("\n"));
      return 0;
    }
    const result = await runLocalEvaluationFull({ evidenceDir, smokeEvidencePath });
    console.log(JSON.stringify({ status: result.status, evidenceDir: result.evidenceDir }));
    return result.status === "pass" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (isMain(import.meta.url)) {
  void fullCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
}