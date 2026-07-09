import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bootstrap } from "./bootstrap.js";
import { reason, RULES } from "./reason.js";
import { parseJSONL } from "./types.js";

describe("parseJSONL", () => {
  test("handles malformed lines gracefully", () => {
    const { entities, relations } = parseJSONL(
      '{"type":"entity","name":"ok","entityType":"test","observations":[]}\nnot-json\n'
    );
    assert.equal(entities.size, 1);
    assert.equal(relations.length, 0);
  });
  test("deduplicates entities by name", () => {
    const { entities } = parseJSONL(
      JSON.stringify({ type:"entity",name:"dup",entityType:"feature",observations:["v1"] })+"\n"+
      JSON.stringify({ type:"entity",name:"dup",entityType:"feature",observations:["v2"] })
    );
    assert.equal(entities.size, 1);
    assert.deepEqual(entities.get("dup")!.observations, ["v2"]);
  });
});

describe("RULES", () => {
  test("KG-01: 5+ named rules present", () => {
    assert.ok(RULES.length >= 5);
    const names = RULES.map(r => r.name);
    for (const n of ["R1:ac-test-gap","R2:feature-not-decomposed","R3:feature-not-implemented","R4:transitive-skill","R5:epic-blocked"])
      assert.ok(names.includes(n), "Missing: "+n);
  });
  test("R1: AC without VALIDATES test → test-gap", () => {
    const kg = parseJSONL(JSON.stringify({type:"entity",name:"AC-01",entityType:"acceptance_criterion",observations:[]}));
    const r1 = RULES.find(r => r.name === "R1:ac-test-gap")!;
    const d = r1.fn(kg, new Set());
    assert.equal(d.length, 1);
    assert.equal(d[0].status_value, "test-gap");
  });
  test("R1: AC with VALIDATES test → no gap", () => {
    const lines = [
      JSON.stringify({type:"entity",name:"AC-02",entityType:"acceptance_criterion",observations:[]}),
      JSON.stringify({type:"entity",name:"t1",entityType:"test",observations:[]}),
      JSON.stringify({type:"relation",from:"t1",to:"AC-02",relationType:"VALIDATES"}),
    ].join("\n");
    const kg = parseJSONL(lines);
    const rs = new Set(kg.relations.map(r => r.from+"|"+r.to+"|"+r.relationType));
    assert.equal(RULES.find(r=>r.name==="R1:ac-test-gap")!.fn(kg, rs).length, 0);
  });
  test("R3: IMPLEMENTED_BY closes the gap", () => {
    const lines = [
      JSON.stringify({type:"entity",name:"feat-x",entityType:"feature",observations:[]}),
      JSON.stringify({type:"entity",name:"f.ts",entityType:"code_file",observations:[]}),
      JSON.stringify({type:"relation",from:"feat-x",to:"f.ts",relationType:"IMPLEMENTED_BY"}),
    ].join("\n");
    const kg = parseJSONL(lines);
    const rs = new Set(kg.relations.map(r => r.from+"|"+r.to+"|"+r.relationType));
    assert.equal(RULES.find(r=>r.name==="R3:feature-not-implemented")!.fn(kg, rs).length, 0);
  });
  test("R3: bare feature → not-implemented", () => {
    const kg = parseJSONL(JSON.stringify({type:"entity",name:"feat-bare",entityType:"feature",observations:[]}));
    const d = RULES.find(r=>r.name==="R3:feature-not-implemented")!.fn(kg, new Set());
    assert.equal(d.length, 1); assert.equal(d[0].status_value, "not-implemented");
  });
  test("R5: epic all-not-implemented → blocked", () => {
    const kg = parseJSONL([
      JSON.stringify({type:"entity",name:"epic-e",entityType:"epic",observations:[]}),
      JSON.stringify({type:"entity",name:"feat-f",entityType:"feature",observations:[]}),
      JSON.stringify({type:"relation",from:"feat-f",to:"epic-e",relationType:"DECOMPOSES_INTO"}),
    ].join("\n"));
    (kg.relations as any[]).push({type:"relation",from:"feat-f",to:"status:not-implemented",relationType:"HAS_STATUS",status_value:"not-implemented"});
    const rs = new Set(kg.relations.map(r => r.from+"|"+r.to+"|"+r.relationType));
    const d = RULES.find(r=>r.name==="R5:epic-blocked")!.fn(kg, rs);
    assert.equal(d.length, 1); assert.equal(d[0].status_value, "blocked");
  });
  test("bootstrap + reason are functions", () => {
    assert.ok(typeof bootstrap === "function");
    assert.ok(typeof reason === "function");
  });
});
