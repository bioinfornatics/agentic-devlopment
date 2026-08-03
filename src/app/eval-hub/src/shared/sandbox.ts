import fs from "node:fs/promises";
import path from "node:path";
import type { SandboxProcessConfig } from "../domains/execution/ports.js";
async function canonical(candidate: string): Promise<string> {
  const absolute=path.resolve(candidate); let cursor=absolute; const suffix:string[]=[];
  for (;;) { try { return path.join(await fs.realpath(cursor), ...suffix.reverse()); } catch { const parent=path.dirname(cursor); if(parent===cursor) throw new Error("cannot canonicalize sandbox path: "+candidate); suffix.push(path.basename(cursor)); cursor=parent; } }
}
function inside(root:string,value:string):boolean { const rel=path.relative(root,value); return rel==="" || (!rel.startsWith(".."+path.sep)&&rel!==".."&&!path.isAbsolute(rel)); }
export async function seedGooseConfiguration(sourceDir:string,destinationGooseConfig:string):Promise<string[]> {
 const copied:string[]=[];let entries:import("node:fs").Dirent[];
 try{entries=await fs.readdir(sourceDir,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return copied;throw error;}
 const destination=destinationGooseConfig;
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){if(!entry.isFile()||(entry.name!=="config.yaml"&&!entry.name.startsWith("custom_")))continue;const source=path.join(sourceDir,entry.name),target=path.join(destination,entry.name),mode=(await fs.stat(source)).mode&0o777;await fs.mkdir(destination,{recursive:true});await fs.copyFile(source,target);await fs.chmod(target,mode);copied.push(entry.name);}
 return copied;
}
export async function createSandboxProcessConfig(input:{sandboxRoot:string;runtimeRoot:string;evidenceRoot:string;gooseConfigSource?:string}):Promise<SandboxProcessConfig>{
 if(!input.sandboxRoot||!input.runtimeRoot||!input.evidenceRoot) throw new Error("release/full gate requires --sandbox-root, --runtime-root and --evidence-root");
 const sandboxRoot=await canonical(input.sandboxRoot), runtimeRoot=await canonical(input.runtimeRoot), evidenceRoot=await canonical(input.evidenceRoot), projectRoot=await canonical(path.join(sandboxRoot,"project")),gooseRoot=await canonical(path.join(sandboxRoot,"goose"));
 for(const [name,value] of Object.entries({runtimeRoot,evidenceRoot,projectRoot,gooseRoot})) if(!inside(sandboxRoot,value)) throw new Error(name+" resolves outside sandbox root");
 const home=path.join(sandboxRoot,"home"),gooseConfig=path.join(gooseRoot,"config"); const xdg={XDG_CONFIG_HOME:path.join(home,".config"),XDG_CACHE_HOME:path.join(home,".cache"),XDG_DATA_HOME:path.join(home,".local","share"),XDG_STATE_HOME:path.join(home,".local","state"),XDG_RUNTIME_DIR:path.join(sandboxRoot,"run","user")};
 await Promise.all([projectRoot,runtimeRoot,evidenceRoot,home,...Object.values(xdg),gooseConfig,path.join(gooseRoot,"data"),path.join(gooseRoot,"state")].map(p=>fs.mkdir(p,{recursive:true})));
 await Promise.all([xdg.XDG_RUNTIME_DIR,gooseRoot,gooseConfig,path.join(gooseRoot,"data"),path.join(gooseRoot,"state")].map(p=>fs.chmod(p,0o700)));
 const inheritedConfigHome=process.env["XDG_CONFIG_HOME"]?.trim(); const sourceConfigHome=inheritedConfigHome||path.join(process.env["HOME"]??"",".config");
 await seedGooseConfiguration(path.resolve(input.gooseConfigSource??path.join(sourceConfigHome,"goose")),gooseConfig);
 
  // Seed OAuth tokens from real config to sandbox config dir
  const realConfigHome = process.env["XDG_CONFIG_HOME"]?.trim() || path.join(process.env["HOME"]??"", ".config");
  const realGooseConfig = path.resolve(realConfigHome, "goose");
  try {
    const configEntries = await fs.readdir(realGooseConfig, { withFileTypes: true }).catch(() => []);
    for (const entry of configEntries) {
      if (entry.isDirectory()) {
        // Seed provider credential directories (chatgpt_codex/, gemini_oauth/, etc.)
        const srcDir = path.join(realGooseConfig, entry.name);
        const dstDir = path.join(gooseConfig, entry.name);
        await fs.mkdir(dstDir, { recursive: true });
        const files = await fs.readdir(srcDir).catch(() => [] as string[]);
        for (const f of files) {
          await fs.copyFile(path.join(srcDir, f), path.join(dstDir, f)).catch(() => {});
        }
      }
    }
  } catch { /* best effort */ }
  return {projectRoot,runtimeRoot,evidenceRoot,env:{HOME:home,...xdg,GOOSE_PATH_ROOT:gooseRoot,PATH:process.env["PATH"]??"",HARNESS_RUNTIME_ROOT:runtimeRoot,EVAL_EVIDENCE_ROOT:evidenceRoot}};
}