import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AjvModule from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { canonicalLocalEvaluationJson, createLocalEvaluationAttestation, verifyLocalEvaluationAttestation, type LocalEvaluationBindings } from "../attestation.js";
import { digestLocalEvaluationProfile } from "../evidence.js";
import { parseVerifyLocalAttestationArgs, verifyLocalAttestationFiles } from "../verifyAttestation.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const root=resolve(import.meta.dirname,"../../../../../../..");
const load=async()=>JSON.parse(await readFile(resolve(root,"src/harness/local-evaluation-profile.json"),"utf8"));
const now=new Date("2026-07-29T12:00:00Z");
const hex=(character:string)=>character.repeat(64);
function fixture(profile:any, population:unknown[]=[{kind:"skill",component:"task-framing",disposition:"covered"},{kind:"agent",component:"premium",disposition:"exempt",exemption:{type:"premium-variant",owner:"evaluation",reason:"separate treatment",expiresAt:"2030-01-01T00:00:00Z"}}]) {
 const bindings:LocalEvaluationBindings={source:hex("1"),locks:hex("2"),runtime:hex("3"),release:hex("4"),goose:hex("5"),evalHub:hex("6"),provider:hex("7"),model:hex("8"),corpus:hex("9"),profile:digestLocalEvaluationProfile(profile)};
 const layers=["L0","L1","L2","L3"].map(layer=>({layer,executed:true,repetitions:10,validPairs:10,exclusions:[],delta:.06,confidenceInterval95:[.001,.1]}));
 const evidence={schemaVersion:1,profileVersion:profile.profileVersion,profile:"release",status:"pass",releaseDigest:bindings.release,bindings:{...bindings},population,layers,startedAt:"2026-07-29T11:00:00Z",completedAt:"2026-07-29T11:30:00Z"};
 const smoke={schemaVersion:1 as const,profileVersion:profile.profileVersion,profile:"smoke" as const,status:"pass" as const,releaseDigest:bindings.release,bindings:{source:bindings.source,locks:bindings.locks,runtime:bindings.runtime,release:bindings.release,goose:bindings.goose,evalHub:bindings.evalHub,profile:bindings.profile},checks:[{name:"reproducibility",status:"pass" as const,command:"build twice"}],startedAt:"2026-07-29T10:00:00Z",completedAt:"2026-07-29T10:30:00Z"};
 const input={smoke,releaseGate:{status:"pass" as const,releaseDigest:bindings.release,bindings:{...bindings},evidence,population:structuredClone(population),commands:["evaluate release"]},currentBindings:{...bindings},population,profile,startedAt:"2026-07-29T10:00:00Z",completedAt:"2026-07-29T11:30:00Z",commands:["evaluate smoke","evaluate release"]};
 return {bindings,evidence,input};
}

describe("local evaluation attestation",()=>{
 it("creates stable canonical JSON and a valid, self-contained L0-L3 report",async()=>{const profile=await load(),{bindings,input}=fixture(profile);const a=createLocalEvaluationAttestation(input),b=createLocalEvaluationAttestation(structuredClone(input));expect(a).toEqual(b);expect(canonicalLocalEvaluationJson(a)).toBe(canonicalLocalEvaluationJson(b));expect(verifyLocalEvaluationAttestation(a,bindings,profile,now)).toBe(true);for(const term of ["L0","L1","L2","L3","pair-micro","subject-macro","CI","exclusions","Population and exemptions"])expect(a.html).toContain(term);const schema=JSON.parse(await readFile(resolve(root,".specs/schemas/local-harness-attestation.schema.json"),"utf8"));delete schema.$schema;const Ajv=AjvModule as unknown as new(o:object)=>{compile:(s:object)=>(v:unknown)=>boolean};expect(new Ajv({strict:true,formats:{"date-time":true}}).compile(schema)(a)).toBe(true)});
 it("rejects every current binding mutation including corpus, Goose, model, release, and profile",async()=>{const profile=await load(),{bindings,input}=fixture(profile),a=createLocalEvaluationAttestation(input);for(const key of Object.keys(bindings) as (keyof LocalEvaluationBindings)[]){const current={...bindings,[key]:hex("a")};expect(verifyLocalEvaluationAttestation(a,current,profile,now),key).toBe(false)}});
 it("rejects semantic gate mutations, status, partial layers, exclusions, timestamps, extras, and HTML mutation",async()=>{const profile=await load();const cases:[string,(x:any)=>void][]=[
  ["smoke status",x=>x.input.smoke.status="fail"],["release status",x=>x.input.releaseGate.status="fail"],["release digest",x=>x.input.releaseGate.releaseDigest=hex("a")],
  ["partial layer",x=>x.evidence.layers.pop()],["layer mutation",x=>x.evidence.layers[0].layer="L3"],["exclusion",x=>x.evidence.layers[1].exclusions=[{reason:"contamination"}]],
  ["stale",x=>x.input.completedAt="2026-07-27T00:00:00Z"],["nested stale",x=>x.evidence.completedAt="2020-01-01T00:00:00Z"],["population drift",x=>x.input.releaseGate.population=[]],["nested population drift",x=>x.evidence.population=[]],["nested status",x=>x.evidence.status="fail"],["future",x=>x.input.completedAt="2026-07-30T00:00:00Z"]];
  for(const [name,mutate] of cases){const x=fixture(profile);mutate(x);const a=createLocalEvaluationAttestation(x.input);expect(verifyLocalEvaluationAttestation(a,x.bindings,profile,now),name).toBe(false)}
  const x=fixture(profile),a:any=createLocalEvaluationAttestation(x.input);a.extra=true;expect(verifyLocalEvaluationAttestation(a,x.bindings,profile,now)).toBe(false);delete a.extra;a.html+="<script>alert(1)</script>";expect(verifyLocalEvaluationAttestation(a,x.bindings,profile,now)).toBe(false)});
 it("escapes report content and rejects secret-like keys without retaining raw logs or prompts",async()=>{const profile=await load(),x=fixture(profile,[{kind:"skill",component:"<img src=x onerror=alert(1)>",disposition:"covered"}]);const a=createLocalEvaluationAttestation(x.input);expect(a.html).toContain("&lt;img");expect(a.html).not.toContain("<img");expect(verifyLocalEvaluationAttestation(a,x.bindings,profile,now)).toBe(true);const secret:any=createLocalEvaluationAttestation(x.input);secret.payload.population.push({api_token:"forbidden"});expect(verifyLocalEvaluationAttestation(secret,x.bindings,profile,now)).toBe(false)});
});