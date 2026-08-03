#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface SandboxPaths { root:string; home:string; config:string; data:string; state:string; cache:string; xdgRuntime:string; goose:string; project:string; runtime:string; internal:string; external:string; evidence:string }
export interface Sandbox { paths:SandboxPaths; env:NodeJS.ProcessEnv; seededGooseConfigFiles:readonly string[]; seededGooseProviderCredential:string|null; assertWritable(path:string):string; verifyClean():void; cleanup():void }
export interface SandboxOptions { prefix?:string; tempParent?:string; userHome?:string; repositoryRoot?:string; gooseConfigSource?:string; providerCredential?:string }

/** OAuth cache files confirmed by Goose's provider-secret registry. */
export const GOOSE_PROVIDER_CREDENTIAL_FILES:Readonly<Record<string,string>>={
  chatgpt_codex:"chatgpt_codex/tokens.json",
  gemini_oauth:"gemini_oauth/tokens.json",
  kimi_code:"kimicode/token.json",
};
type Fingerprint = { present:boolean; digest:string };

function digestPath(path:string):Fingerprint {
  if (!existsSync(path)) return { present:false, digest:createHash("sha256").update("absent\0").digest("hex") };
  const hash=createHash("sha256");
  const visit=(entry:string, rel:string):void=>{
    const info=lstatSync(entry); const kind=info.isSymbolicLink()?"link":info.isDirectory()?"dir":info.isFile()?"file":"other";
    hash.update(kind).update("\0").update(rel).update("\0").update(String(info.mode & 0o7777)).update("\0");
    if (kind==="link") hash.update(readlinkSync(entry));
    else if (kind==="file") hash.update(String(info.size)).update("\0").update(createHash("sha256").update(readFileSync(entry)).digest());
    else if (kind==="dir") for (const name of readdirSync(entry).sort()) visit(join(entry,name),rel?rel+"/"+name:name);
  }; visit(path,""); return {present:true,digest:hash.digest("hex")};
}
function watched(options:SandboxOptions):Record<string,string> {
  const home=resolve(options.userHome ?? process.env.HOME ?? ""); const repo=resolve(options.repositoryRoot ?? process.cwd());
  const inheritedConfigHome=process.env.XDG_CONFIG_HOME?.trim();
  const configHome=options.userHome!==undefined?join(home,".config"):resolve(inheritedConfigHome||join(home,".config"));
  // Watch stable subdirs only; sessions/, projects.json, state/logs/, history.txt are volatile
  // (modified by concurrent or controller Goose processes) and do not indicate sandbox leakage.
  // Sandbox isolation is enforced via XDG env vars and GOOSE_PATH_ROOT redirection.
  const userData=join(home,".local/share/goose");
  return { userGoose:join(home,".goose"), userConfig:join(configHome,"goose"), userDataApps:join(userData,"apps"), userDataModels:join(userData,"models"), userCache:join(home,".cache/goose"), repoAgents:join(repo,".agents"), repoGoose:join(repo,".goose") };
}
function snapshot(paths:Record<string,string>):Record<string,Fingerprint> { return Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,digestPath(path)])); }
function changed(before:Record<string,Fingerprint>,after:Record<string,Fingerprint>):string[] { return Object.keys(before).filter(key=>before[key]!.present!==after[key]!.present||before[key]!.digest!==after[key]!.digest); }
function inside(root:string,path:string):boolean { const rel=relative(root,path); return rel===""||(!rel.startsWith(".."+sep)&&rel!==".."&&!isAbsolute(rel)); }
function canonicalCandidate(path:string):string {
  let cursor=resolve(path); const suffix:string[]=[];
  while (!existsSync(cursor)) { const parent=dirname(cursor); if(parent===cursor) break; suffix.unshift(basename(cursor)); cursor=parent; }
  return resolve(realpathSync(cursor),...suffix);
}
export function requireBeneath(rootInput:string,pathInput:string):string {
  const root=realpathSync(rootInput), candidate=canonicalCandidate(pathInput);
  if(!inside(root,candidate)) throw new Error("writable path escapes sandbox");
  return candidate;
}
export function seedGooseConfiguration(sourceDir:string,destinationGooseConfig:string):string[] {
  if(!existsSync(sourceDir)) return [];
  const destination=destinationGooseConfig, copied:string[]=[];
  for(const name of readdirSync(sourceDir).sort()) {
    if(name!=="config.yaml"&&!name.startsWith("custom_")) continue;
    const source=join(sourceDir,name), info=lstatSync(source);
    if(!info.isFile()) continue;
    mkdirSync(destination,{recursive:true});
    const target=join(destination,name); copyFileSync(source,target); chmodSync(target,info.mode&0o777);
    copied.push(name);
  }
  return copied;
}
export function seedGooseProviderCredential(sourceGooseDir:string,destinationGooseConfig:string,provider:string):string|null {
  const relativePath=GOOSE_PROVIDER_CREDENTIAL_FILES[provider];
  if(relativePath===undefined)return null;
  if(!existsSync(sourceGooseDir))throw new Error("Goose credential source is missing for provider "+provider);
  const sourceRoot=realpathSync(sourceGooseDir),source=join(sourceRoot,relativePath);
  if(!existsSync(source))throw new Error("Goose credential cache is missing for provider "+provider);
  const info=lstatSync(source);
  if(!info.isFile()||info.isSymbolicLink())throw new Error("Goose credential cache must be a regular file for provider "+provider);
  const canonical=realpathSync(source);
  if(!inside(sourceRoot,canonical))throw new Error("Goose credential cache escapes its source root for provider "+provider);
  const destinationRoot=destinationGooseConfig,target=join(destinationRoot,relativePath);
  requireBeneath(destinationRoot,target);
  mkdirSync(dirname(target),{recursive:true,mode:0o700});
  chmodSync(destinationRoot,0o700); chmodSync(dirname(target),0o700);
  copyFileSync(canonical,target); chmodSync(target,0o600);
  return relativePath;
}
export function createSandbox(options:SandboxOptions={}):Sandbox {
  const parent=resolve(options.tempParent??tmpdir()); mkdirSync(parent,{recursive:true});
  const root=mkdtempSync(join(parent,options.prefix??"harness-sandbox-"));
  const home=join(root,"home");
  const paths:SandboxPaths={root,home,config:join(home,".config"),data:join(home,".local/share"),state:join(home,".local/state"),cache:join(home,".cache"),xdgRuntime:join(root,"run/user"),goose:join(root,"goose"),project:join(root,"project"),runtime:join(root,"runtime"),internal:join(root,"internal"),external:join(root,"external"),evidence:join(root,"evidence")};
  for(const path of Object.values(paths).slice(1)) mkdirSync(path,{recursive:true});
  for(const path of [paths.xdgRuntime,paths.goose,join(paths.goose,"config"),join(paths.goose,"data"),join(paths.goose,"state")]) { mkdirSync(path,{recursive:true}); chmodSync(path,0o700); }
  // Match activateRuntime's project-relative link layout without pre-creating
  // runtime/current: activation installs that path atomically as a symlink.
  const projectHarness=join(paths.project,"build/harness"); mkdirSync(projectHarness,{recursive:true});
  symlinkSync(paths.runtime,join(projectHarness,"runtime"));
  for(const name of [".agents",".goose"]) symlinkSync(join("build/harness/runtime/current",name),join(paths.project,name));
  const realHome=resolve(options.userHome??process.env.HOME??"");
  const inheritedConfigHome=process.env.XDG_CONFIG_HOME?.trim();
  const sourceConfigHome=options.userHome!==undefined?join(realHome,".config"):resolve(inheritedConfigHome||join(realHome,".config"));
  const gooseConfigSource=resolve(options.gooseConfigSource??join(sourceConfigHome,"goose"));
  const gooseConfig=join(paths.goose,"config");
  const seededGooseConfigFiles=seedGooseConfiguration(gooseConfigSource,gooseConfig);
  let seededGooseProviderCredential:string|null;
  try {
    seededGooseProviderCredential=options.providerCredential===undefined?null:seedGooseProviderCredential(gooseConfigSource,gooseConfig,options.providerCredential);
  } catch(error) {
    rmSync(root,{recursive:true,force:true});
    throw error;
  }
  const targets=watched(options), before=snapshot(targets); let removed=false;
  const env:NodeJS.ProcessEnv={...process.env,HOME:paths.home,XDG_CONFIG_HOME:paths.config,XDG_DATA_HOME:paths.data,XDG_STATE_HOME:paths.state,XDG_CACHE_HOME:paths.cache,XDG_RUNTIME_DIR:paths.xdgRuntime,GOOSE_PATH_ROOT:paths.goose,HARNESS_PROJECT_ROOT:paths.project,HARNESS_RUNTIME_ROOT:paths.runtime,HARNESS_INTERNAL_ROOT:paths.internal,HARNESS_EXTERNAL_ROOT:paths.external,HARNESS_EVIDENCE_ROOT:paths.evidence,HARNESS_SANDBOX_ROOT:paths.root};
  const verifyClean=()=>{const mutations=changed(before,snapshot(targets));if(mutations.length)throw new Error("protected paths mutated: "+mutations.sort().join(","));};
  return {paths,env,seededGooseConfigFiles,seededGooseProviderCredential,assertWritable:path=>requireBeneath(root,path),verifyClean,cleanup(){if(removed)return;let failure:unknown;try{verifyClean();}catch(error){failure=error;}finally{rmSync(root,{recursive:true,force:true});removed=true;}if(failure)throw failure;}};
}
export async function withSandbox<T>(callback:(sandbox:Sandbox)=>T|Promise<T>,options:SandboxOptions={}):Promise<T>{const sandbox=createSandbox(options);try{return await callback(sandbox);}finally{sandbox.cleanup();}}
function runChild(command:string,args:string[],env:NodeJS.ProcessEnv,timeoutMs:number):Promise<number>{return new Promise((done,reject)=>{const child=spawn(command,args,{env,stdio:"inherit",cwd:env.HARNESS_PROJECT_ROOT});let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill("SIGTERM")},timeoutMs);child.once("error",reject);child.once("exit",(code,signal)=>{clearTimeout(timer);if(timedOut)reject(new Error("sandbox command timed out"));else if(signal)reject(new Error("sandbox command terminated by "+signal));else done(code??1);});});}
export async function sandboxCli(args:string[]):Promise<number>{try{if(args[0]!=="smoke"&&args[0]!=="run")throw new Error("action must be smoke or run");const divider=args.indexOf("--");const command=divider>=0?args[divider+1]:undefined;const commandArgs=divider>=0?args.slice(divider+2):[];return await withSandbox(async sandbox=>{for(const path of Object.values(sandbox.paths))sandbox.assertWritable(path);for(const name of [".agents",".goose"])if(readlinkSync(join(sandbox.paths.project,name))!==join("build/harness/runtime/current",name))throw new Error("project link escapes runtime");if(!command)return 0;return runChild(command,commandArgs,sandbox.env,30_000);});}catch(error){console.error(error instanceof Error?error.message:String(error));return 1;}}
if(process.argv[1]!==undefined&&basename(process.argv[1]).replace(/\.(?:js|ts)$/,"")==="local-evaluation-sandbox")sandboxCli(process.argv.slice(2)).then(code=>{process.exitCode=code});