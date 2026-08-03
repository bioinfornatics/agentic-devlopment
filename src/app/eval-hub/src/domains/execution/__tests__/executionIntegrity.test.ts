import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildExecutionMatrix,
  buildGooseInvocation,
  buildTreatmentPair,
  resolveTypedRecipeSource,
  terminalExecutionResult,
  inspectRuntimeHealth,
  inspectTreatmentActivation,
  validateRepetitionCount,
  type InvariantExecutionEnvelope,
} from "../executionIntegrity.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

const envelope: InvariantExecutionEnvelope = {
  taskPayload: "Implement AUTH-03 exactly.\nDo not change the exercise.",
  fixtureHashes: { "fixtures/auth.ts": "sha256:fixture" },
  timeBudgetMs: 60_000,
  tokenBudget: 8_000,
  provider: "anthropic",
  model: "claude-test",
  decoding: { temperature: null, seed: null },
  gooseRuntimeVersion: "goose-1",
  evalHubRuntimeVersion: "eval-hub-1",
};

function ids(kind: "skills" | "agents" | "recipes") {
  const pair = buildTreatmentPair({
    kind,
    subject: kind === "skills" ? "sdd" : kind === "agents" ? "architect" : "dev",
    declaredSkills: ["sdd", "code-review"],
    declaredAgents: ["orchestrator"],
    resolvedRecipePath: "/repo/.goose/recipes/dev.yaml",
  });
  return [pair.candidate.id, pair.baseline.id];
}

describe("EVAL-INT-02/19 typed effective treatments", () => {
  it("defines exactly the six layer treatment IDs", () => {
    expect(ids("skills")).toEqual(["skill_l1", "skill_l0"]);
    expect(ids("agents")).toEqual(["agent_l2", "agent_l1"]);
    expect(ids("recipes")).toEqual(["recipe_l3", "recipe_l2"]);
  });

  it("keeps lower layers identical and bootstrap separate from user task", () => {
    const skill = buildTreatmentPair({ kind: "skills", subject: "sdd", declaredSkills: [], declaredAgents: [] });
    expect(skill.candidate.bootstrap).toEqual({ kind: "system_instruction", bytes: "load skill: sdd" });
    expect(skill.baseline.bootstrap).toEqual({ kind: "none", bytes: "" });

    const agent = buildTreatmentPair({ kind: "agents", subject: "architect", declaredSkills: ["sdd"], declaredAgents: [] });
    expect(agent.candidate.bootstrap.bytes).toBe("load skill: sdd\nload agent: architect");
    expect(agent.baseline.bootstrap.bytes).toBe("load skill: sdd");

    const recipe = buildTreatmentPair({ kind: "recipes", subject: "dev", declaredSkills: ["sdd"], declaredAgents: ["orchestrator"], resolvedRecipePath: "/repo/dev.yaml" });
    expect(recipe.candidate.bootstrap).toEqual({ kind: "recipe", bytes: "/repo/dev.yaml" });
    expect(recipe.baseline.bootstrap.bytes).toBe("load skill: sdd\nload agent: orchestrator");
    for (const treatment of [skill.candidate, skill.baseline, agent.candidate, agent.baseline, recipe.candidate, recipe.baseline]) {
      expect(treatment.bootstrap.bytes).not.toContain(envelope.taskPayload);
      expect(treatment.bootstrap.bytes).not.toMatch(/pretend|imitate|role-?play/i);
    }
  });

  it("captures supported Goose arguments and invokes a real recipe", () => {
    const pair = buildTreatmentPair({ kind: "recipes", subject: "dev", declaredSkills: ["sdd"], declaredAgents: ["orchestrator"], resolvedRecipePath: "/repo/dev.yaml" });
    const candidate = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8, { ac_id: "AUTH-03" });
    expect(candidate).toEqual(["run", "--recipe", "/repo/dev.yaml", "--params", "ac_id=AUTH-03", "--params", `task=${envelope.taskPayload}`, "--no-session", "--max-turns", "8", "--output-format", "stream-json", "--quiet"]);
    const featureRecipe = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8, { feature: "stale" }, "feature");
    expect(featureRecipe).toContain(`feature=${envelope.taskPayload}`);
    expect(featureRecipe).not.toContain("feature=stale");
  });
});


  it("uses --system for bootstrap while preserving exact --text task bytes", () => {
    const pair = buildTreatmentPair({ kind: "agents", subject: "architect", declaredSkills: ["sdd"], declaredAgents: [] });
    const candidate = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8);
    const baseline = buildGooseInvocation(pair.baseline, envelope.taskPayload, 8);
    expect(candidate.slice(0, 5)).toEqual(["run", "--system", "load skill: sdd\nload agent: architect", "--text", envelope.taskPayload]);
    expect(baseline.slice(0, 5)).toEqual(["run", "--system", "load skill: sdd", "--text", envelope.taskPayload]);
    expect(candidate[candidate.indexOf("--text") + 1]).toBe(baseline[baseline.indexOf("--text") + 1]);
  });

  it("propagates an explicit provider and model override", () => {
    const pair = buildTreatmentPair({ kind: "agents", subject: "architect", declaredSkills: ["sdd"], declaredAgents: [] });
    const args = buildGooseInvocation(pair.candidate, envelope.taskPayload, 1, {}, "task", { provider: "chatgpt_codex", model: "gpt-5.5" });
    expect(args).toContain("--provider");
    expect(args[args.indexOf("--provider") + 1]).toBe("chatgpt_codex");
    expect(args[args.indexOf("--model") + 1]).toBe("gpt-5.5");
  });

describe("EVAL-INT-01/03 invariant repeated schedule", () => {
  it.each([0, -1, 1.5, Number.NaN])("rejects invalid repetition count %s", value => {
    expect(() => validateRepetitionCount(value)).toThrow(/integer.*at least 1/i);
  });

  it("schedules both sides for every eval at indexes 0 through R-1", () => {
    const pair = buildTreatmentPair({ kind: "skills", subject: "sdd", declaredSkills: [], declaredAgents: [] });
    const rows = buildExecutionMatrix({ kind: "skills", subject: "sdd", evalIds: [0, 1], repetitions: 3, pair, envelope });
    expect(rows).toHaveLength(12);
    expect([...new Set(rows.map(row => row.repetition))]).toEqual([0, 1, 2]);
    expect(rows.filter(row => row.evalId === 0 && row.repetition === 0).map(row => row.side)).toEqual(["candidate", "baseline"]);
    expect(rows.filter(row => row.evalId === 0 && row.repetition === 1).map(row => row.side)).toEqual(["baseline", "candidate"]);
    for (const repetition of [0, 1, 2]) for (const evalId of [0, 1]) {
      const sides = rows.filter(row => row.repetition === repetition && row.evalId === evalId);
      expect(sides.map(row => row.side).sort()).toEqual(["baseline", "candidate"]);
      expect(new Set(sides.map(row => row.taskPayloadHash)).size).toBe(1);
      expect(sides[0]?.envelope).toEqual(sides[1]?.envelope);
      expect(sides[0]?.workspace).not.toBe(sides[1]?.workspace);
    }
  });
});

describe("EVAL-INT-17 typed recipe resolution", () => {
  it("resolves explicit top-level and subrecipe sources without basename guessing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "typed-recipes-")); roots.push(root);
    await fs.mkdir(path.join(root, "subrecipes"));
    await fs.writeFile(path.join(root, "dev.yaml"), "version: 1\n");
    await fs.writeFile(path.join(root, "subrecipes", "amend-spec.yaml"), "version: 1\n");
    expect(await resolveTypedRecipeSource(root, "dev", "top_level")).toBe(path.join(root, "dev.yaml"));
    expect(await resolveTypedRecipeSource(root, "amend-spec", "subrecipe")).toBe(path.join(root, "subrecipes", "amend-spec.yaml"));
    await expect(resolveTypedRecipeSource(root, "amend-spec", "top_level")).rejects.toThrow(/source_missing/);
    await expect(resolveTypedRecipeSource(root, "missing", "subrecipe")).rejects.toThrow(/source_missing/);
  });
});

describe("EVAL-INT-06 execution failure is terminal", () => {
  it("never turns a failed or timed-out execution into score zero", () => {
    expect(terminalExecutionResult(2, null)).toEqual({ status: "failed", exitCode: 2, signal: null, score: null });
    expect(terminalExecutionResult(null, "SIGKILL")).toEqual({ status: "failed", exitCode: null, signal: "SIGKILL", score: null });
    expect(terminalExecutionResult(0, null)).toEqual({ status: "succeeded", exitCode: 0, signal: null, score: null });
  });
});


describe("AC-EVAL-08/10 treatment activation evidence", () => {
  const skillLoad = (name: string, text: string, id = "skill-load") => [
    JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id, toolCall: { value: { name: "load_skill", arguments: { name } } } },
    ] } }),
    JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id, toolResult: { value: { content: [{ type: "text", text }] } } },
    ] } }),
  ];

  it("detects explicit Goose load failures only for requested treatment artifacts", () => {
    const result = inspectTreatmentActivation(
      skillLoad("sdd", "Skill 'sdd' not found."), { skills: ["sdd"], agents: [] },
    );
    expect(result).toEqual({
      requestedSkills: ["sdd"], requestedAgents: [], materializedSkills: [], materializedAgents: [],
      failedSkills: ["sdd"], failedAgents: [], inSessionActivatedAgents: [], agentActivationProofs: [], status: "failed",
    });
  });

  it("does not treat unrelated tool errors as treatment bootstrap failures", () => {
    const result = inspectTreatmentActivation([
      ...skillLoad("other", "Skill 'other' not found.", "other-load"),
      ...skillLoad("sdd", "# Loaded Skill: sdd (skill)"),
    ], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] });
    expect(result.status).toBe("verified");
    expect(result.failedSkills).toEqual([]);
  });

  it("distinguishes copied artifacts from runtime-verified activation", () => {
    expect(inspectTreatmentActivation(
      [], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] },
    ).status).toBe("materialized");
    // Materialized skill with no explicit load_skill call → accepted via system bootstrap (symmetric with agents)
    expect(inspectTreatmentActivation(
      [], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] }, { runtimeComplete: true },
    )).toMatchObject({ status: "verified", failedSkills: [] });
    // Non-materialized skill → still fails even with runtimeComplete (fail-closed guarantee preserved)
    expect(inspectTreatmentActivation(
      [], { skills: ["sdd"], agents: [] }, { skills: [], agents: [] }, { runtimeComplete: true },
    )).toMatchObject({ status: "failed", failedSkills: ["sdd"] });
  });

  it("does not accept assistant-authored load markers as activation evidence", () => {
    const assistant = JSON.stringify({ type: "message", message: { role: "assistant", content: "# Loaded Skill: sdd (skill)" } });
    // Security invariant: fake markers in assistant prose must NOT activate a non-materialized skill.
    // (A materialized skill IS accepted — this test specifically checks the non-materialized case.)
    expect(inspectTreatmentActivation(
      [assistant], { skills: ["sdd"], agents: [] }, { skills: [], agents: [] }, { runtimeComplete: true },
    )).toMatchObject({ status: "failed", failedSkills: ["sdd"] });
  });

  it("does not accept nested transcript text returned by another tool as activation evidence", () => {
    const shellResult = JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id: "shell-1", toolResult: { value: { content: [
        { type: "text", text: '{"toolResponse":"# Loaded Skill: sdd (skill)"}' },
      ] } } },
    ] } });
    // Security invariant: fake markers embedded in another tool's output must NOT activate a
    // non-materialized skill. (A materialized skill is accepted via system bootstrap.)
    expect(inspectTreatmentActivation(
      [shellResult], { skills: ["sdd"], agents: [] }, { skills: [], agents: [] }, { runtimeComplete: true },
    )).toMatchObject({ status: "failed", failedSkills: ["sdd"] });
  });

  it("does not verify activation when the correlated load response is marked as an error", () => {
    const [request, response] = skillLoad("sdd", "# Loaded Skill: sdd (skill)");
    const failedResponse = JSON.stringify({ message: { role: "user", content: [{ type: "toolResponse", id: "skill-load", toolResult: { status: "error", value: { content: [{ type: "text", text: "# Loaded Skill: sdd (skill)" }], isError: true } } }] } });
    expect(inspectTreatmentActivation(
      [request!, failedResponse], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] }, { runtimeComplete: true },
    )).toMatchObject({ status: "failed", failedSkills: ["sdd"] });
    expect(response).toBeDefined();
  });
});


describe("AC-EVAL-08 agent activation via system hook", () => {
  function agentLoad(name: string, response: string, id = "agent-load-1") {
    return [
      JSON.stringify({ message: { role: "assistant", content: [{ type: "toolRequest", id, toolCall: { status: "success", value: { name: "load", arguments: { source: name } } } }] } }),
      JSON.stringify({ message: { role: "user", content: [{ type: "toolResponse", id, toolResult: { status: "success", value: { content: [{ type: "text", text: response }] } } }] } }),
    ];
  }

  it("verifies agent loaded via explicit load() call with success marker", () => {
    const result = inspectTreatmentActivation(
      agentLoad("architect", "# Loaded: architect (agent)\n\n## architect (agent)\n\nFull instructions..."),
      { skills: [], agents: ["architect"] },
      { skills: [], agents: ["architect"] },
      { runtimeComplete: true },
    );
    expect(result.status).toBe("verified");
    expect(result.failedAgents).toEqual([]);
  });

  it("verifies agent loaded via system hook (no explicit load() call) when pre-run materialized", () => {
    // No load() call in stream, but agent was materialized pre-run
    const result = inspectTreatmentActivation(
      [], // empty stream — no load() call
      { skills: [], agents: ["independent-verifier"] },
      { skills: [], agents: ["independent-verifier"] }, // materialized pre-run
      { runtimeComplete: true },
    );
    expect(result.status).toBe("verified");
    expect(result.failedAgents).toEqual([]);
  });

  it("fails agent not materialized and no load() call", () => {
    const result = inspectTreatmentActivation(
      [],
      { skills: [], agents: ["missing-agent"] },
      { skills: [], agents: [] }, // NOT in materialized list
      { runtimeComplete: true },
    );
    expect(result.status).toBe("failed");
    expect(result.failedAgents).toContain("missing-agent");
  });

  it("fails agent with explicit load() call returning not-found", () => {
    const result = inspectTreatmentActivation(
      agentLoad("bad-agent", "Agent 'bad-agent' not found."),
      { skills: [], agents: ["bad-agent"] },
      { skills: [], agents: ["bad-agent"] },
      { runtimeComplete: true },
    );
    expect(result.status).toBe("failed");
    expect(result.failedAgents).toContain("bad-agent");
  });

  it("fails agent with load() call returning unexpected response (no success marker)", () => {
    const result = inspectTreatmentActivation(
      agentLoad("flaky-agent", "Something went wrong loading the agent."),
      { skills: [], agents: ["flaky-agent"] },
      { skills: [], agents: ["flaky-agent"] },
      { runtimeComplete: true },
    );
    expect(result.status).toBe("failed");
    expect(result.failedAgents).toContain("flaky-agent");
  });
});

describe("AC-EVAL-08-B1 skill bootstrap via system hook (Bug 1: false activation failures)", () => {
  it("accepts a skill materialized via system bootstrap with no explicit load_skill call", () => {
    // --system 'load skill: sdd' activates the skill; no load_skill tool call appears in output
    const result = inspectTreatmentActivation(
      [], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] }, { runtimeComplete: true },
    );
    expect(result.status).toBe("verified");
    expect(result.failedSkills).toEqual([]);
  });

  it("still fails a non-materialized skill with no explicit load_skill call (fail-closed preserved)", () => {
    const result = inspectTreatmentActivation(
      [], { skills: ["sdd"], agents: [] }, { skills: [], agents: [] }, { runtimeComplete: true },
    );
    expect(result.status).toBe("failed");
    expect(result.failedSkills).toEqual(["sdd"]);
  });

  it("still fails a skill whose explicit load_skill call returned an error (fail-closed preserved)", () => {
    const request = JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id: "s1", toolCall: { value: { name: "load_skill", arguments: { name: "sdd" } } } },
    ] } });
    const failedResponse = JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id: "s1", toolResult: {
        status: "error", value: { content: [{ type: "text", text: "Skill 'sdd' not found." }], isError: true },
      } },
    ] } });
    const result = inspectTreatmentActivation(
      [request, failedResponse], { skills: ["sdd"], agents: [] }, { skills: ["sdd"], agents: [] }, { runtimeComplete: true },
    );
    expect(result.status).toBe("failed");
    expect(result.failedSkills).toEqual(["sdd"]);
  });
});

describe("AC-EVAL-08-B2 inSessionActivatedAgents (Bug 2: structured proof of in-session L2 activation)", () => {
  function agentLoadLines(id: string, name: string, text: string, failed = false) {
    return [
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "toolRequest", id, toolCall: { value: { name: "load", arguments: { source: name } } } },
      ] } }),
      JSON.stringify({ message: { role: "user", content: [
        { type: "toolResponse", id, toolResult: {
          status: failed ? "error" : "success",
          value: { content: [{ type: "text", text }], isError: failed },
        } },
      ] } }),
    ];
  }

  it("records in-session activation for a successful load() call with success marker", () => {
    const result = inspectTreatmentActivation(
      agentLoadLines("a1", "change-builder", "# Loaded: change-builder (agent)\n..."),
      { skills: [], agents: ["change-builder"] },
      { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true },
    );
    expect(result.inSessionActivatedAgents).toEqual(["change-builder"]);
    expect(result.failedAgents).toEqual([]);
    expect(result.status).toBe("verified");
  });

  it("does NOT record in-session activation for a pre-materialized agent with no load() call", () => {
    // Agent is materialized (accepted via system hook), but was NOT explicitly loaded in-session
    const result = inspectTreatmentActivation(
      [], // no load() call
      { skills: [], agents: ["change-builder"] },
      { skills: [], agents: ["change-builder"] }, // materialized pre-run
      { runtimeComplete: true },
    );
    expect(result.inSessionActivatedAgents).toEqual([]);
    expect(result.failedAgents).toEqual([]);
    expect(result.status).toBe("verified");
  });

  it("does NOT record in-session activation for a delegate() tool call (sessionChain delegation)", () => {
    // sessionChain delegation uses the 'delegate' tool, not 'load' — must NOT appear as in-session activation
    const delegateLine = JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id: "d1", toolCall: { value: { name: "delegate", arguments: { source: "change-builder" } } } },
    ] } });
    const result = inspectTreatmentActivation(
      [delegateLine],
      { skills: [], agents: ["change-builder"] },
      { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true },
    );
    expect(result.inSessionActivatedAgents).toEqual([]); // delegation ≠ in-session activation
    expect(result.failedAgents).toEqual([]);
  });

  it("does NOT record in-session activation when load() call returns an error response", () => {
    const result = inspectTreatmentActivation(
      agentLoadLines("a1", "change-builder", "Agent 'change-builder' not found.", true),
      { skills: [], agents: ["change-builder"] },
      { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true },
    );
    expect(result.inSessionActivatedAgents).toEqual([]);
    expect(result.failedAgents).toContain("change-builder");
  });

  it("does NOT record in-session activation when load() response has no success marker", () => {
    const result = inspectTreatmentActivation(
      agentLoadLines("a1", "change-builder", "Unexpected response from agent loading subsystem."),
      { skills: [], agents: ["change-builder"] },
      { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true },
    );
    expect(result.inSessionActivatedAgents).toEqual([]);
    expect(result.failedAgents).toContain("change-builder");
  });

  it("proves system-bootstrap activation with a correlated bootstrap hash", () => {
    const result = inspectTreatmentActivation(
      [], { skills: [], agents: ["change-builder"] }, { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true, bootstrap: { kind: "system_instruction", bytes: "load agent: change-builder" } },
    );
    expect(result.status).toBe("verified");
    expect(result.agentActivationProofs).toEqual([{
      agentName: "change-builder", mode: "system_bootstrap", bootstrapHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }]);
  });

  it("proves explicit in-session load with a response digest", () => {
    const result = inspectTreatmentActivation(
      agentLoadLines("a1", "change-builder", "# Loaded: change-builder (agent)\n..."),
      { skills: [], agents: ["change-builder"] }, { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true, bootstrap: { kind: "system_instruction", bytes: "load agent: other-agent" } },
    );
    expect(result.status).toBe("verified");
    expect(result.agentActivationProofs).toEqual([{
      agentName: "change-builder", mode: "explicit_load", responseDigest: expect.stringMatching(/^[a-f0-9]{16}$/),
    }]);
  });

  it("does not verify an agent absent from the supplied system bootstrap", () => {
    const result = inspectTreatmentActivation(
      [], { skills: [], agents: ["change-builder"] }, { skills: [], agents: ["change-builder"] },
      { runtimeComplete: true, bootstrap: { kind: "system_instruction", bytes: "load agent: other-agent" } },
    );
    expect(result.agentActivationProofs).toEqual([{ agentName: "change-builder", mode: "none" }]);
    expect(result.status).toBe("materialized");
  });
});

describe("AC-EVAL-10 runtime dependency health", () => {
  it.each([
    "DeploymentNotFound: The API deployment claude-sonnet-4-5 does not exist",
    "Background task 20260722_193 panicked: task was cancelled",
    "extension summon failed to connect",
  ])("classifies a fatal runtime diagnostic from stderr: %s", diagnostic => {
    expect(inspectRuntimeHealth([], [diagnostic])).toMatchObject({ status: "failed", diagnostics: [diagnostic] });
  });

  it("classifies a fatal runtime diagnostic in a structured tool response", () => {
    const request = JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id: "delegate-1", toolCall: { value: { name: "load", arguments: { source: "task" } } } },
    ] } });
    const response = JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id: "delegate-1", toolResult: { value: { content: [
        { type: "text", text: "Error: Task panicked: task was cancelled" },
      ] } } },
    ] } });
    expect(inspectRuntimeHealth([request, response])).toMatchObject({ status: "failed" });
  });


  it("does not flag 'panicked' text inside a successful shell command output (e.g. vitest test names)", () => {
    const request = JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id: "shell-1", toolCall: { status: "success", value: { name: "shell", arguments: { command: "pnpm test" } } } },
    ] } });
    const response = JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id: "shell-1", toolResult: { status: "success", value: { content: [
        { type: "text", text: "✓ classifies a fatal runtime diagnostic from stderr: Background task 20260722_193 panicked: task was cancelled\n✓ Task panicked: quoted as test name\n Test Files  1 passed (1)\n Tests  27 passed (27)" },
      ] } } },
    ] } });
    expect(inspectRuntimeHealth([request, response])).toEqual({ status: "healthy", diagnostics: [] });
  });

  it("still flags 'Task panicked' from a delegation/load tool response (not a command tool)", () => {
    const request = JSON.stringify({ message: { role: "assistant", content: [
      { type: "toolRequest", id: "load-1", toolCall: { status: "success", value: { name: "load", arguments: { source: "task" } } } },
    ] } });
    const response = JSON.stringify({ message: { role: "user", content: [
      { type: "toolResponse", id: "load-1", toolResult: { value: { content: [
        { type: "text", text: "Error: Task panicked: task was cancelled" },
      ] } } },
    ] } });
    expect(inspectRuntimeHealth([request, response])).toMatchObject({ status: "failed" });
  });

  it("does not fail ordinary, assistant-authored, or nested transcript output", () => {
    const assistant = JSON.stringify({ type: "message", message: { role: "assistant", content: "Task panicked: quoted as documentation" } });
    const nested = JSON.stringify({ message: { role: "assistant", content: [
      { type: "text", text: "Task panicked: quoted nested transcript" },
    ] } });
    expect(inspectRuntimeHealth(["completed normally", assistant, nested])).toEqual({ status: "healthy", diagnostics: [] });
  });
});
