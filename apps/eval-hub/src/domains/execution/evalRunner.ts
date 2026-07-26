/**
 * IEvalRunner — thin orchestrator. Delegates to:
 *   IPromptBuilder   → SkillPromptBuilder
 *   IGrader          → LlmGrader
 *   IWorkspaceWriter → FsWorkspaceWriter
 *   IGooseRunner     → GooseProcessRunner
 *   IEventSink       → EventBus / NULL_SINK
 *
 * Integrity contract (EVAL-INT-04/06/12/15/20):
 *   B. Loads store manifest at start; validates payload hash, treatment id/
 *      content hash / side, runtime context; builds IntegrityTerminalRecordV2
 *      template whose pairKey exactly mirrors the manifest.
 *   C. Resume: complete terminal → skip; incomplete slot → immutable throw.
 *   E. Failed execution → exactly one failed terminal BEFORE rethrow.
 *   F. Grade validation → succeeded terminal (valid or grader_invalid).
 *   G. Record terminal BEFORE final graded event / return.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import type { IEvalRunner, IGooseRunner, IPromptBuilder, IGrader, GradingResult, ScenarioRunConfig, IEventSink } from "./ports.js";
import type { EvalEvent } from "../../shared/events.js";
import { GooseProcessRunner }  from "./gooseRunner.js";
import { SkillPromptBuilder }  from "./promptBuilder.js";
import { LlmGrader }           from "./grader.js";
import { FsWorkspaceWriter }   from "../persistence/workspaceWriter.js";
import type { IWorkspaceWriter } from "../persistence/ports.js";
import { NULL_SINK }           from "../../shared/eventBus.js";
import { PROJECT_SKILLS_DIR, PROJECT_AGENTS_DIR } from "../../shared/paths.js";
import { buildGooseInvocation, hashUtf8, inspectRuntimeHealth, inspectTreatmentActivation, terminalExecutionResult, treatmentContentHash } from "./executionIntegrity.js";
import { analyzeGooseLogs, gooseLogCaptureForWorkspace } from "./gooseLogAnalyzer.js";
import { analyzeSessionChain } from "./sessionChainAnalyzer.js";
import { checkPhaseCompliance } from "./phaseComplianceChecker.js";
import {
  EvalIntegrityV2Store, INTEGRITY_SCHEMA_V2, integrityValueHash,
  type IntegrityTerminalRecordV2,
} from "../persistence/integrityV2Store.js";

// ── Grading validation ────────────────────────────────────────────────────────

/**
 * Returns true iff the raw grading result is fully valid for the given
 * expected criterion IDs:
 *   • expected list is nonempty
 *   • exact count of expectation outputs (no more, no less)
 *   • every expectation has a non-empty text field
 *   • summary total / passed / failed / pass_rate is self-consistent
 *   • computed pass fraction == summary pass_rate (finite)
 *
 * No zero coercion: a null / NaN / missing score is always "invalid".
 */
function validateGrading(
  grading: GradingResult,
  expectedCriterionIds: readonly string[],
): boolean {
  if (expectedCriterionIds.length === 0) return false;
  if (!Array.isArray(grading.expectations) || grading.expectations.length !== expectedCriterionIds.length) return false;
  if (!grading.expectations.every(e => typeof e.text === "string" && e.text.length > 0)) return false;
  const total = expectedCriterionIds.length;
  const passed = grading.expectations.filter(e => e.passed).length;
  const failed = total - passed;
  const computedPassRate = passed / total;
  if (grading.summary.pass_rate === null || !Number.isFinite(grading.summary.pass_rate)) return false;
  if (grading.summary.pass_rate !== computedPassRate) return false;
  if (grading.summary.total !== total) return false;
  if (grading.summary.passed !== passed) return false;
  if (grading.summary.failed !== failed) return false;
  return true;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export class SkillEvalRunner implements IEvalRunner {
  constructor(
    private readonly goose:   IGooseRunner    = new GooseProcessRunner(),
    private readonly prompt:  IPromptBuilder  = new SkillPromptBuilder(),
    private readonly grader:  IGrader         = new LlmGrader(),
    private readonly writer:  IWorkspaceWriter = new FsWorkspaceWriter(),
  ) {}

  async *run(cfg: ScenarioRunConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<EvalEvent> {
    const { kind, subject, hash, scenario, evalId, config, treatment, repetition, gooseCli } = cfg;
    // Legacy artifact directories are one-based; integrity identity is the explicit zero-based repetition.
    const run = repetition + 1;

    // ── A/B. Load store manifest and validate ─────────────────────────────────
    const store = new EvalIntegrityV2Store(cfg.integrity.root);
    const stored = await store.loadManifest();

    if (stored.hash !== cfg.integrity.manifestHash) {
      throw new Error(
        `integrity manifest hash mismatch: plan expected ${cfg.integrity.manifestHash} but store has ${stored.hash}`,
      );
    }

    // Validate payload hash against manifest
    const taskKey = `${kind}/${subject}/${evalId}`;
    const expectedTaskHash = stored.manifest.taskPayloadHashes[taskKey];
    if (expectedTaskHash === undefined || expectedTaskHash !== cfg.plannedTaskPayloadHash) {
      throw new Error(`integrity payload hash mismatch for ${taskKey}: plan=${cfg.plannedTaskPayloadHash} manifest=${String(expectedTaskHash)}`);
    }

    // Validate treatment id/side against integrity plan
    const { side } = cfg.integrity;
    const expectedTreatmentId = side === "candidate"
      ? cfg.integrity.candidateTreatmentId
      : cfg.integrity.baselineTreatmentId;
    if (treatment.id !== expectedTreatmentId) {
      throw new Error(
        `integrity treatment id mismatch: plan expects ${expectedTreatmentId} for side ${side}, got ${treatment.id}`,
      );
    }

    // Validate the per-task manifest-frozen turn budget before any provider call.
    const expectedMaxTurns = stored.manifest.maxTurnsByTask[taskKey];
    if (expectedMaxTurns === undefined || cfg.maxTurns !== expectedMaxTurns) {
      throw new Error("integrity maxTurns mismatch: plan=" + cfg.maxTurns + " manifest=" + String(expectedMaxTurns));
    }

    // Validate runtime context (goose version must match manifest envelope)
    if (cfg.gooseRuntimeVersion !== stored.manifest.executionEnvelope.gooseRuntimeVersion) {
      throw new Error(
        `integrity goose runtime version mismatch: plan=${cfg.gooseRuntimeVersion} manifest=${stored.manifest.executionEnvelope.gooseRuntimeVersion}`,
      );
    }

    // ── A2. Validate treatment hashes against manifest definitionHash ─────────
    // candidateTreatmentHash / baselineTreatmentHash in the plan MUST mirror the
    // manifest's definitionHash for the matching side — before any artifact or
    // provider call.
    const manifestCandidateTreatment = stored.manifest.treatments.find(
      t => t.kind === kind && t.subject === subject && t.side === "candidate",
    );
    const manifestBaselineTreatment = stored.manifest.treatments.find(
      t => t.kind === kind && t.subject === subject && t.side === "baseline",
    );
    if (!manifestCandidateTreatment) {
      throw new Error(`integrity manifest missing candidate treatment for ${kind}/${subject}`);
    }
    if (!manifestBaselineTreatment) {
      throw new Error(`integrity manifest missing baseline treatment for ${kind}/${subject}`);
    }
    if (cfg.integrity.candidateTreatmentHash !== manifestCandidateTreatment.definitionHash) {
      throw new Error(
        `integrity candidateTreatmentHash mismatch: plan=${cfg.integrity.candidateTreatmentHash} manifest=${manifestCandidateTreatment.definitionHash}`,
      );
    }
    if (cfg.integrity.baselineTreatmentHash !== manifestBaselineTreatment.definitionHash) {
      throw new Error(
        `integrity baselineTreatmentHash mismatch: plan=${cfg.integrity.baselineTreatmentHash} manifest=${manifestBaselineTreatment.definitionHash}`,
      );
    }

    // Validate actual treatment content hash matches manifest definitionHash for
    // the selected side — catches in-flight mutations of the treatment object.
    const manifestSideTreatment = side === "candidate" ? manifestCandidateTreatment : manifestBaselineTreatment;
    const actualTreatmentContentHash = treatmentContentHash(treatment);
    if (actualTreatmentContentHash !== manifestSideTreatment.definitionHash) {
      throw new Error(
        `integrity treatment content hash mismatch for side ${side}: computed=${actualTreatmentContentHash} manifest=${manifestSideTreatment.definitionHash}`,
      );
    }

    // ── B. Build pairKey exactly from manifest + integrity plan ───────────────
    const pairKey: IntegrityTerminalRecordV2["pairKey"] = {
      taskPayloadHash:        cfg.plannedTaskPayloadHash,
      maxTurns:               cfg.maxTurns,
      fixtureHashes:          stored.manifest.fixtureHashes,
      executionEnvelopeHash:  integrityValueHash(stored.manifest.executionEnvelope),
      candidateTreatmentId:   cfg.integrity.candidateTreatmentId,
      baselineTreatmentId:    cfg.integrity.baselineTreatmentId,
      candidateTreatmentHash: cfg.integrity.candidateTreatmentHash,
      baselineTreatmentHash:  cfg.integrity.baselineTreatmentHash,
      runProvenanceId:        stored.manifest.runProvenanceId,
      graderId:               cfg.integrity.grader.id,
      graderVersion:          cfg.integrity.grader.version,
      rubricId:               cfg.integrity.rubric.id,
      rubricVersion:          cfg.integrity.rubric.version,
    };

    // Terminal template — used as a key for store lookups; status/grading filled before write
    const terminalTemplate: IntegrityTerminalRecordV2 = {
      schema:      INTEGRITY_SCHEMA_V2,
      manifestHash: stored.hash,
      kind, subject, evalId, repetition, side,
      treatmentId: treatment.id,
      status:      "succeeded", // placeholder
      pairKey,
      grading:     null,        // placeholder
      exclusion:   null,        // placeholder
    };

    // ── C. Resume check — BEFORE any artifact write or provider call ──────────
    if (await store.isTerminalComplete(terminalTemplate)) {
      // Valid complete terminal already exists: skip execution and grading entirely.
      const ev0 = { type: "subject.started" as const, kind, subject, hash, evalId, config, treatmentId: treatment.id, repetition, run };
      yield ev0; sink.emit(ev0);
      const ev1 = {
        type: "subject.completed" as const, kind, subject, hash, evalId, config, treatmentId: treatment.id, repetition, run,
        status: "done" as const, rc: 0, signal: null, turns: 0, durationMs: 0,
      };
      yield ev1; sink.emit(ev1);
      return;
    }

    // If a terminal exists but is NOT complete the slot is immutable — throw immediately.
    if (await store.readTerminalKey(terminalTemplate) !== null) {
      throw new Error("terminal slot is immutable and incomplete; start a new run");
    }

    // ── Proceed with execution ────────────────────────────────────────────────
    await this.writer.writeEvalMeta(kind, subject, hash, evalId, {
      evalId, evalName: scenario.query?.slice(0, 60), difficulty: scenario.difficulty, hash,
    });

    const ev0 = { type: "subject.started" as const, kind, subject, hash, evalId, config, treatmentId: treatment.id, repetition, run };
    yield ev0; sink.emit(ev0);

    // ── Prompt ────────────────────────────────────────────────────────────────
    const promptText = cfg.plannedTaskPayload;
    await this.writer.writePrompt(kind, subject, hash, evalId, config, run, promptText);

    // ── cwd / env ─────────────────────────────────────────────────────────────
    const cwd = cfg.workspace;
    // Give each execution a private XDG state root. Goose writes the same log
    // formats as ~/.local/state/goose/logs, but concurrent workers can now be
    // attributed without time-window guesses or historical contamination.
    const gooseLogCapture = gooseLogCaptureForWorkspace(cfg.workspace);
    const env: Record<string, string> = {
      XDG_STATE_HOME: gooseLogCapture.stateHome,
      // Isolate sessions DB so delegation chain is attributable to this run only.
      // Goose writes sessions.db to $XDG_DATA_HOME/goose/sessions/sessions.db.
      XDG_DATA_HOME: gooseLogCapture.stateHome,
    };

    // ── Build invocation ──────────────────────────────────────────────────────
    const maxTurns = cfg.maxTurns;
    const provider = cfg.provider;
    const model    = cfg.model;
    const args = buildGooseInvocation(
      treatment, promptText, maxTurns,
      scenario.recipe_params ?? {},
      scenario.recipe_task_parameter ?? "task",
      { provider, model },
    );
    const gooseRuntimeVersion = cfg.gooseRuntimeVersion;

    // Legacy execution-evidence.json (preserves compatibility with reporting/workspace reader)
    // Materialize only the active side's requested artifacts. Goose discovers these by walking up from cwd.
    for (const name of treatment.definition.skills) {
      const source = path.join(PROJECT_SKILLS_DIR, name);
      const target = path.join(cfg.workspace, ".agents", "skills", name);
      try {
        await fs.access(path.join(source, "SKILL.md"));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.cp(source, target, { recursive: true, force: true });
      } catch { /* captured by activation inventory below */ }
    }
    for (const name of treatment.definition.agents) {
      const source = path.join(PROJECT_AGENTS_DIR, name + ".md");
      const target = path.join(cfg.workspace, ".agents", "agents", name + ".md");
      try {
        await fs.access(source);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(source, target);
      } catch { /* captured by activation inventory below */ }
    }

    const materialized = {
      skills: (await Promise.all(treatment.definition.skills.map(async name =>
        fs.access(path.join(cfg.workspace, ".agents", "skills", name, "SKILL.md")).then(() => name).catch(() => null),
      ))).filter((name): name is string => name !== null),
      agents: (await Promise.all(treatment.definition.agents.map(async name =>
        fs.access(path.join(cfg.workspace, ".agents", "agents", name + ".md")).then(() => name).catch(() => null),
      ))).filter((name): name is string => name !== null),
    };
    const initialActivation = inspectTreatmentActivation([], treatment.definition, materialized);
    const executionEvidence = {
      schema: "eval-integrity-execution-v1" as const,
      kind, subject, evalId, repetition,
      treatmentId: treatment.id,
      treatmentDefinition: treatment.definition,
      treatmentBootstrap: treatment.bootstrap,
      treatmentBootstrapHash: hashUtf8(treatment.bootstrap.bytes),
      treatmentContentHash: treatmentContentHash(treatment),
      taskPayloadHash: cfg.plannedTaskPayloadHash,
      fixtureHashes: cfg.fixtureHashes,
      timeBudgetMs: cfg.timeoutMs, tokenBudget: null, maxTurns,
      provider, model, decoding: cfg.decoding,
      gooseRuntimeVersion, evalHubRuntimeVersion: cfg.evalHubRuntimeVersion,
      treatmentActivation: initialActivation,
      gooseLogs: { schema: "goose-log-capture-v1" as const, source: "isolated_xdg_state" as const },
      gooseArgs: args,
    };
    await fs.mkdir(cfg.workspace, { recursive: true });
    await fs.writeFile(
      path.join(cfg.workspace, "execution-evidence.json"),
      JSON.stringify(executionEvidence, null, 2),
    );

    if (initialActivation.status === "failed") {
      await fs.writeFile(
        path.join(cfg.workspace, "execution-result.json"),
        JSON.stringify({
          status: "failed", exitCode: null, signal: null, score: null,
          ...executionEvidence, failureReason: "treatment_bootstrap_failed",
        }, null, 2),
      );
      const failedTerminal: IntegrityTerminalRecordV2 = {
        ...terminalTemplate,
        status: "failed",
        grading: null,
        exclusion: { level: "pair", reason: "treatment_bootstrap_failed" },
      };
      await store.recordTerminal(failedTerminal);
      const failedEvent = {
        type: "subject.completed" as const, kind, subject, hash, evalId, config,
        treatmentId: treatment.id, repetition, run, status: "failed" as const,
        rc: null, signal: null, turns: 0, durationMs: 0,
      };
      yield failedEvent; sink.emit(failedEvent);
      throw new Error("Treatment bootstrap failed for " + subject + " eval-" + evalId + "/" + config);
    }

    // ── Run Goose ─────────────────────────────────────────────────────────────
    const startMs     = Date.now();
    let   turns       = 0;
    let   rc: number | null = null;
    let   signal: string | null = null;
    const outputLines: string[] = [];
    const stderrLines: string[] = [];
    let   gooseError: unknown   = null;

    try {
      for await (const raw of this.goose.run({ gooseCli, args, env, cwd, timeoutMs: cfg.timeoutMs })) {
        if (raw.type === "exit") { rc = raw.code; signal = raw.signal; break; }
        if (!raw.text.trim()) continue;
        if (raw.stream === "stderr") { stderrLines.push(raw.text); continue; }
        outputLines.push(raw.text);
        await this.writer.appendEvent(kind, subject, hash, evalId, config, run, raw.text);
        const parsed = parseStreamLine(raw.text);
        if (parsed?.isTurn) {
          turns++;
          const te = { type: "goose.turn" as const, subject, evalId, config, turn: turns, role: "assistant" as const, preview: parsed.preview ?? "" };
          yield te; sink.emit(te);
        }
        if (parsed?.isToolCall) {
          const tc = { type: "goose.tool_call" as const, subject, evalId, config, tool: parsed.tool ?? "unknown", args: parsed.args };
          yield tc; sink.emit(tc);
        }
      }
    } catch (err) {
      gooseError = err;
    }

    const durationMs = Date.now() - startMs;
    await this.writer.writeTiming(kind, subject, hash, evalId, config, run, {
      startedAt: new Date(startMs).toISOString(), completedAt: new Date().toISOString(),
      durationMs, turnsUsed: turns, maxTurns, maxTurnsReached: turns >= maxTurns,
    });

    // Determine terminal status from goose outcome
    const terminal = gooseError !== null
      ? { status: "failed" as const, exitCode: null as number | null, signal: null as string | null, score: null }
      : terminalExecutionResult(rc, signal);

    const treatmentActivation = inspectTreatmentActivation(
      outputLines, treatment.definition, materialized, { runtimeComplete: terminal.status === "succeeded" },
    );
    const gooseLogAnalysis = await analyzeGooseLogs(gooseLogCapture.logsRoot, model);
    await fs.writeFile(
      path.join(cfg.workspace, "goose-log-analysis.json"),
      JSON.stringify(gooseLogAnalysis, null, 2),
    );
    // Reconstruct delegation chain from the isolated sessions DB before cleanup.
    const sessionChain = analyzeSessionChain(
      path.join(gooseLogCapture.stateHome, "goose", "sessions", "sessions.db")
    );
    await fs.writeFile(
      path.join(cfg.workspace, "session-chain.json"),
      JSON.stringify(sessionChain, null, 2),
    );
    // Evaluate loop-engineering phase compliance from the chain (deterministic, LLM-free).
    const phaseCompliance = checkPhaseCompliance(sessionChain);
    await fs.writeFile(
      path.join(cfg.workspace, "phase-compliance.json"),
      JSON.stringify(phaseCompliance, null, 2),
    );
    // The analysis is the bounded durable artifact. Remove raw LLM request logs
    // because they can contain complete prompts and model responses.
    await fs.rm(gooseLogCapture.stateHome, { recursive: true, force: true }).catch(() => undefined);
    const runtimeHealth = inspectRuntimeHealth(
      outputLines, stderrLines,
      gooseLogAnalysis.fatalDiagnostics.map(item => item.message),
    );
    const failureReason = treatmentActivation.status === "failed"
      ? "treatment_bootstrap_failed" as const
      : runtimeHealth.status === "failed" ? "runtime_dependency_failed" as const : null;
    const effectiveTerminal = failureReason === null ? terminal : {
      status: "failed" as const, exitCode: terminal.exitCode, signal: terminal.signal, score: null,
    };

    // Legacy execution-result.json (always written, even on failure — for compatibility)
    await fs.writeFile(
      path.join(cfg.workspace, "execution-result.json"),
      JSON.stringify({ ...effectiveTerminal, ...executionEvidence, treatmentActivation, runtimeHealth, gooseLogAnalysis, failureReason }, null, 2),
    );

    const ev1 = {
      type: "subject.completed" as const, kind, subject, hash, evalId, config, treatmentId: treatment.id, repetition, run,
      status: effectiveTerminal.status === "succeeded" ? "done" as const : "failed" as const,
      rc: effectiveTerminal.exitCode, signal: effectiveTerminal.signal, turns, durationMs,
    };
    yield ev1; sink.emit(ev1);

    // ── E. Record exactly one failed terminal BEFORE rethrowing ───────────────
    if (effectiveTerminal.status === "failed") {
      const failedTerminal: IntegrityTerminalRecordV2 = {
        ...terminalTemplate,
        status:    "failed",
        grading:   null,
        exclusion: { level: "pair", reason: failureReason ?? "execution_failed" },
      };
      await store.recordTerminal(failedTerminal);

      if (gooseError !== null) throw gooseError;
      if (failureReason === "treatment_bootstrap_failed") {
        throw new Error("Treatment bootstrap failed for " + subject + " eval-" + evalId + "/" + config);
      }
      if (failureReason === "runtime_dependency_failed") {
        throw new Error("Runtime dependency failed for " + subject + " eval-" + evalId + "/" + config);
      }
      throw new Error(
        "Goose run failed for " + subject + " eval-" + evalId + "/" + config + " (exit " + String(effectiveTerminal.exitCode) + ", signal " + String(effectiveTerminal.signal) + ")",
      );
    }

    // ── F. Grade ──────────────────────────────────────────────────────────────
    const expectedCriterionIds = cfg.integrity.rubric.expectedCriterionIds;
    let rawGrading: GradingResult | null = null;
    try {
      rawGrading = await this.grader.grade(
        scenario, config, outputLines.join("\n"), cfg.workspace, gooseCli, { provider, model },
      );
    } catch {
      rawGrading = null;
    }

    // Preserve legacy grading artifact for compatibility (written regardless of validity)
    if (rawGrading !== null) {
      await this.writer.writeGrading(kind, subject, hash, evalId, config, run, rawGrading);
    }

    // Decide grading validity and build terminal grading record
    let gradingRecord: IntegrityTerminalRecordV2["grading"];
    let exclusionRecord: IntegrityTerminalRecordV2["exclusion"];

    if (rawGrading !== null && validateGrading(rawGrading, expectedCriterionIds)) {
      // Valid grading — map criterion IDs by index to grader expectation outcomes
      const passed = rawGrading.expectations.filter(e => e.passed).length;
      const score  = passed / expectedCriterionIds.length;
      gradingRecord = {
        graderId:              cfg.integrity.grader.id,
        graderVersion:         cfg.integrity.grader.version,
        rubricId:              cfg.integrity.rubric.id,
        rubricVersion:         cfg.integrity.rubric.version,
        expectedCriterionIds,
        outcomes: expectedCriterionIds.map((criterionId, i) => ({
          criterionId,
          passed: rawGrading!.expectations[i]!.passed,
        })),
        parseStatus:       "parsed",
        validationStatus:  "valid",
        score,
      };
      exclusionRecord = null;
    } else {
      // Invalid grading — do NOT throw; record grader_invalid exclusion; no zero coercion
      gradingRecord = {
        graderId:              cfg.integrity.grader.id,
        graderVersion:         cfg.integrity.grader.version,
        rubricId:              cfg.integrity.rubric.id,
        rubricVersion:         cfg.integrity.rubric.version,
        expectedCriterionIds,
        outcomes:              [],
        parseStatus:           rawGrading === null ? "failed" : "parsed",
        validationStatus:      "invalid",
        score:                 null,
      };
      exclusionRecord = { level: "pair", reason: "grader_invalid" };
    }

    // ── G. Record terminal BEFORE final graded event / return ─────────────────
    const succeededTerminal: IntegrityTerminalRecordV2 = {
      ...terminalTemplate,
      status:    "succeeded",
      grading:   gradingRecord,
      exclusion: exclusionRecord,
    };
    await store.recordTerminal(succeededTerminal);

    // Emit graded event (legacy pass_rate from raw grading when valid, null otherwise)
    const passRate = exclusionRecord === null ? (gradingRecord?.score ?? null) : null;
    const ev2 = { type: "subject.graded" as const, subject, evalId, config, passed: passRate === 1.0, score: passRate };
    yield ev2; sink.emit(ev2);
  }
}


function parseStreamLine(line: string): { isTurn?: boolean; isToolCall?: boolean; tool?: string; args?: unknown; preview?: string } | null {
  try {
    const ev = JSON.parse(line) as Record<string, unknown>;
    if (ev["role"] === "assistant" || ev["type"] === "message") {
      const content = ev["content"];
      const text = Array.isArray(content)
        ? (content as Record<string, unknown>[]).filter(c => c["type"] === "text").map(c => String(c["text"] ?? "")).join("")
        : String(content ?? "");
      return { isTurn: true, preview: text.slice(0, 120) };
    }
    if (ev["type"] === "tool_use" || ev["name"]) {
      return { isToolCall: true, tool: String(ev["name"] ?? ev["type"] ?? "tool"), args: ev["input"] ?? ev["arguments"] };
    }
    return null;
  } catch { return null; }
}
