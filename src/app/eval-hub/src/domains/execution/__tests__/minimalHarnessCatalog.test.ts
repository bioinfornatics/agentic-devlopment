import { describe, expect, it } from "vitest";
import { loadMinimalHarnessCatalog, MINIMAL_HARNESS_SUBJECTS, validateExemptions } from "../minimalHarnessCatalog.js";

describe("inventory-derived minimal harness catalog",()=>{
 it("asserts exact subjects and derives protocol counts from corpus",async()=>{const c=await loadMinimalHarnessCatalog();expect(c.subjects).toEqual(MINIMAL_HARNESS_SUBJECTS);expect(c.subjects.skills).toContain("output-discipline");expect(c.counts.agents).toBeGreaterThanOrEqual(c.subjects.agents.length*4);expect(c.counts.skills).toBeGreaterThanOrEqual(c.subjects.skills.length*3);expect(c.counts.total).toBe(c.counts.agents+c.counts.skills+c.counts.recipes+c.counts.architecture);});
 it("includes controlled architecture ablations",async()=>{const c=await loadMinimalHarnessCatalog();const names=c.architecture.map(x=>x.name);expect(names).toEqual(expect.arrayContaining(["minimal-vs-full-simple-change","skill-ablation","agent-ablation"]));});
 it("rejects expired exemptions",()=>expect(()=>validateExemptions({exemptions:[{component:"agent:change-builder-premium",type:"premium-variant",variantOf:"change-builder",layer:"L2-B",owner:"loop",reason:"typed premium model variant",expiresAt:"2020-01-01T00:00:00Z"}]},["change-builder-premium"],new Date("2026-01-01"))).toThrow(/expired/));
 it("rejects premium variants silently classified as standards or the wrong layer",()=>expect(()=>validateExemptions({exemptions:[{component:"agent:change-builder-premium",type:"premium-variant",variantOf:"change-builder-premium",layer:"L2",owner:"loop",reason:"bad classification",expiresAt:"2027-01-01T00:00:00Z"}]},["change-builder-premium"],new Date("2026-01-01"))).toThrow(/misclassification/));
});
