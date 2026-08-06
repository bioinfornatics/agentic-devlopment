import { describe, it, expect } from "vitest";
import { bootstrap } from "../src/bootstrap.js";
import { reason, RULES } from "../src/reason.js";
import { parseJSONL } from "../src/types.js";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const j = (o: object) => JSON.stringify(o);
const e = (name: string, entityType: string, obs: string[] = []) =>
  j({ type: "entity", name, entityType, observations: obs });
const r = (from: string, to: string, relationType: string, extra: object = {}) =>
  j({ type: "relation", from, to, relationType, ...extra });

describe("parseJSONL", () => {
  it("parses valid entity + skips malformed lines", () => {
    const { entities, relations } = parseJSONL(
      e("ok", "test") + "\nnot-json\n"
    );
    expect(entities.size).toBe(1);
    expect(relations.length).toBe(0);
  });

  it("deduplicates entities by name — last write wins", () => {
    const { entities } = parseJSONL(
      e("dup", "feature", ["v1"]) + "\n" + e("dup", "feature", ["v2"])
    );
    expect(entities.size).toBe(1);
    expect(entities.get("dup")!.observations).toEqual(["v2"]);
  });

  it("parses relations correctly", () => {
    const { relations } = parseJSONL(
      e("a", "feature") + "\n" + r("a", "b", "IMPLEMENTS")
    );
    expect(relations.length).toBe(1);
    expect(relations[0].relationType).toBe("IMPLEMENTS");
  });

  it("normalizes entities with missing observations to an empty array", () => {
    const { entities } = parseJSONL(
      JSON.stringify({ type: "entity", name: "bad-code", entityType: "code_file" })
    );
    expect(entities.get("bad-code")!.observations).toEqual([]);
  });

  it("skips structurally invalid relations", () => {
    const { relations } = parseJSONL(
      JSON.stringify({ type: "relation", from: "a", to: "b" })
    );
    expect(relations).toHaveLength(0);
  });
});

describe("RULES", () => {
  it("RULES: exports 7+ named rules (R1–R7)", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(7);
    const names = RULES.map(r => r.name);
    expect(names).toContain("R1:ac-test-gap");
    expect(names).toContain("R2:feature-not-decomposed");
    expect(names).toContain("R3:feature-not-implemented");
    expect(names).toContain("R4:transitive-skill");
    expect(names).toContain("R5:epic-blocked");
    expect(names).toContain("R6:deprecated-impl-detection");
    expect(names).toContain("R7:status-disposition");
  });

  it("R1: AC without VALIDATES test → HAS_STATUS test-gap", () => {
    const kg = parseJSONL(e("AC-01", "acceptance_criterion"));
    const r1 = RULES.find(r => r.name === "R1:ac-test-gap")!;
    const derived = r1.fn(kg, new Set());
    expect(derived).toHaveLength(1);
    expect(derived[0].status_value).toBe("test-gap");
    expect(derived[0].relationType).toBe("HAS_STATUS");
  });

  it("R1: AC with VALIDATES test → no gap", () => {
    const kg = parseJSONL([
      e("AC-02", "acceptance_criterion"),
      e("t1", "test"),
      r("t1", "AC-02", "VALIDATES"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    const derived = RULES.find(r => r.name === "R1:ac-test-gap")!.fn(kg, rs);
    expect(derived).toHaveLength(0);
  });

  it("R2: feature without REFINED_INTO → not-decomposed", () => {
    const kg = parseJSONL(e("feat-bare", "feature"));
    const d = RULES.find(r => r.name === "R2:feature-not-decomposed")!.fn(kg, new Set());
    expect(d).toHaveLength(1);
    expect(d[0].status_value).toBe("not-decomposed");
  });

  it("R2: feature with REFINED_INTO user_story → no gap", () => {
    const kg = parseJSONL([
      e("feat-ok", "feature"),
      e("story-1", "user_story"),
      r("feat-ok", "story-1", "REFINED_INTO"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    expect(RULES.find(r => r.name === "R2:feature-not-decomposed")!.fn(kg, rs)).toHaveLength(0);
  });

  it("R2: feature with HAS_CRITERION acceptance criterion → no decomposition gap", () => {
    const kg = parseJSONL([
      e("feat-criteria", "feature"),
      e("AC-X", "acceptance_criterion"),
      r("feat-criteria", "AC-X", "HAS_CRITERION"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    expect(RULES.find(r => r.name === "R2:feature-not-decomposed")!.fn(kg, rs)).toHaveLength(0);
  });

  it("R3: feature IMPLEMENTED_BY code_file → gap closed", () => {
    const kg = parseJSONL([
      e("feat-x", "feature"),
      e("f.ts", "code_file"),
      r("feat-x", "f.ts", "IMPLEMENTED_BY"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    expect(RULES.find(r => r.name === "R3:feature-not-implemented")!.fn(kg, rs)).toHaveLength(0);
  });

  it("R3: feature IMPLEMENTS code_file → gap closed (bidirectional)", () => {
    const kg = parseJSONL([
      e("feat-y", "feature"),
      e("g.ts", "code_file"),
      r("g.ts", "feat-y", "IMPLEMENTS"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    expect(RULES.find(r => r.name === "R3:feature-not-implemented")!.fn(kg, rs)).toHaveLength(0);
  });

  it("R3: feature IMPLEMENTED_IN artifact → gap closed", () => {
    const kg = parseJSONL([
      e("feat-cli", "feature"),
      r("feat-cli", "scripts/run.ts", "IMPLEMENTED_IN"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    expect(RULES.find(r => r.name === "R3:feature-not-implemented")!.fn(kg, rs)).toHaveLength(0);
  });

  it("R3: bare feature → not-implemented", () => {
    const kg = parseJSONL(e("feat-none", "feature"));
    const d = RULES.find(r => r.name === "R3:feature-not-implemented")!.fn(kg, new Set());
    expect(d).toHaveLength(1);
    expect(d[0].status_value).toBe("not-implemented");
  });

  it("R5: epic where all features are not-implemented → blocked", () => {
    const kg = parseJSONL([
      e("epic-e", "epic"),
      e("feat-f", "feature"),
      r("feat-f", "epic-e", "DECOMPOSES_INTO"),
    ].join("\n"));
    (kg.relations as any[]).push({
      type: "relation", from: "feat-f", to: "status:not-implemented",
      relationType: "HAS_STATUS", status_value: "not-implemented"
    });
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    const d = RULES.find(r => r.name === "R5:epic-blocked")!.fn(kg, rs);
    expect(d).toHaveLength(1);
    expect(d[0].status_value).toBe("blocked");
  });

  it("R5: epic with some implemented features → not blocked", () => {
    const kg = parseJSONL([
      e("epic-2", "epic"),
      e("feat-done", "feature"),
      e("code.ts", "code_file"),
      r("feat-done", "epic-2", "DECOMPOSES_INTO"),
      r("feat-done", "code.ts", "IMPLEMENTED_BY"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    // feat-done IS implemented (IMPLEMENTED_BY) so R3 won't fire → R5 won't fire either
    const r5 = RULES.find(r => r.name === "R5:epic-blocked")!;
    const d = r5.fn(kg, rs);
    // no HAS_STATUS not-implemented in relations, so epic is not blocked
    expect(d).toHaveLength(0);
  });
});

describe("R6: deprecated-impl-detection", () => {
  it("R6: feature with one deprecated and one canonical code_file → has-deprecated-impl", () => {
    const kg = parseJSONL([
      e("feat-z", "feature"),
      e("old.ts", "code_file", ["path: old.ts", "status: deprecated"]),
      e("new.ts", "code_file", ["path: new.ts"]),
      r("feat-z", "old.ts", "IMPLEMENTED_BY"),
      r("feat-z", "new.ts", "IMPLEMENTED_BY"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    const d = RULES.find(r => r.name === "R6:deprecated-impl-detection")!.fn(kg, rs);
    expect(d.some(x => x.status_value === "has-deprecated-impl")).toBe(true);
  });

  it("R6: feature with only one non-deprecated code_file → no gap", () => {
    const kg = parseJSONL([
      e("feat-ok", "feature"),
      e("ok.ts", "code_file", ["path: ok.ts"]),
      r("feat-ok", "ok.ts", "IMPLEMENTED_BY"),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    const d = RULES.find(r => r.name === "R6:deprecated-impl-detection")!.fn(kg, rs);
    expect(d).toHaveLength(0);
  });
});

describe("R7: status-disposition", () => {
  it("R7: status with beads-issue observation → STATUS_DISPOSED_BY", () => {
    const kg = parseJSONL([
      e("AC-GAP", "acceptance_criterion", ["beads-issue: issue-123"]),
      r("AC-GAP", "status:test-gap", "HAS_STATUS", { status_value: "test-gap" }),
    ].join("\n"));
    const rs = new Set(kg.relations.map(rel => rel.from+"|"+rel.to+"|"+rel.relationType));
    const d = RULES.find(r => r.name === "R7:status-disposition")!.fn(kg, rs);
    expect(d.some(x => x.relationType === "STATUS_DISPOSED_BY" && x.to === "issue-123")).toBe(true);
  });
});

describe("non-mutating reason output", () => {
  it("reason writes to explicit output path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kg-reason-"));
    const output = join(dir, "derived.jsonl");
    await reason({ input: join(dir, "missing-memory.jsonl"), output });
    const text = await readFile(output, "utf8");
    expect(text).toBe("\n");
  });
});

describe("bootstrap + reason exports", () => {
  it("bootstrap is a function", () => { expect(typeof bootstrap).toBe("function"); });
  it("reason is a function",    () => { expect(typeof reason).toBe("function"); });
});
