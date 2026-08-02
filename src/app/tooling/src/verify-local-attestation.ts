#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { verifyLocalEvaluationAttestation, type LocalEvaluationBindings } from "./local-evaluation-attestation.js";
import { compactJson, isMain } from "./release-common.js";

export interface VerifyLocalAttestationOptions { attestation: string; bindings: string; profile: string; now?: Date }
export interface VerifyLocalAttestationResult { schema: "local-evaluation-attestation-verification-v1"; status: "pass"; attestation: string; bindings: string; profile: string }

async function json(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")); }
export async function verifyLocalAttestationFiles(options: VerifyLocalAttestationOptions): Promise<VerifyLocalAttestationResult> {
  const [attestation, bindings, profile] = await Promise.all([json(options.attestation), json(options.bindings), json(options.profile)]);
  if (!verifyLocalEvaluationAttestation(attestation, bindings as LocalEvaluationBindings, profile, options.now ?? new Date())) throw new Error("local evaluation attestation rejected");
  return { schema: "local-evaluation-attestation-verification-v1", status: "pass", attestation: options.attestation, bindings: options.bindings, profile: options.profile };
}
export function parseVerifyLocalAttestationArgs(argv: string[]): VerifyLocalAttestationOptions | "help" {
  if (argv.includes("--help") || argv.includes("-h")) return "help";
  const values = new Map<string,string>();
  for (let i=0;i<argv.length;i+=2) { const flag=argv[i], value=argv[i+1]; if (!["--attestation","--bindings","--profile"].includes(flag ?? "") || value===undefined || value.startsWith("--")) throw new Error("usage: verify-local-attestation --attestation FILE --bindings FILE --profile FILE"); values.set(flag!,value); }
  for (const flag of ["--attestation","--bindings","--profile"]) if (!values.has(flag)) throw new Error("missing required argument: "+flag);
  return {attestation:values.get("--attestation")!,bindings:values.get("--bindings")!,profile:values.get("--profile")!};
}
export async function main(argv=process.argv.slice(2)) { const options=parseVerifyLocalAttestationArgs(argv); if(options==="help"){console.log("usage: verify-local-attestation --attestation FILE --bindings FILE --profile FILE");return;} console.log(compactJson(await verifyLocalAttestationFiles(options)).trimEnd()); }
if(isMain(import.meta.url)) main().catch((error:unknown)=>{console.error(compactJson({schema:"local-evaluation-attestation-verification-v1",status:"fail",error:error instanceof Error?error.message:String(error)}).trimEnd());process.exitCode=1;});
