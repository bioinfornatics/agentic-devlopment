import { createHash } from "node:crypto";
import { chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile, rename } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
export const REPOSITORY_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../../../..");
export async function pathExists(p:string){try{await stat(p);return true}catch{return false}}
export async function filesBelow(root:string,exclude=false){const out:string[]=[];async function walk(p:string){for(const e of await readdir(p,{withFileTypes:true})){if(exclude&&["__pycache__","node_modules","dist",".vite"].includes(e.name))continue;const c=resolve(p,e.name);if(e.isDirectory())await walk(c);else if(e.isFile())out.push(c);else if(e.isSymbolicLink()){try{if((await stat(c)).isFile())out.push(c)}catch{/* broken/external symlink excluded from source digest */}}}}await walk(root);return out.sort((a,b)=>relative(root,a).split(sep).join("/") < relative(root,b).split(sep).join("/") ? -1 : relative(root,a).split(sep).join("/") > relative(root,b).split(sep).join("/") ? 1 : 0)}
export async function sha256Tree(root:string,exclude=false){const h=createHash("sha256");for(const f of await filesBelow(root,exclude)){h.update(relative(root,f).split(sep).join("/"));h.update(Buffer.from([0]));h.update(await readFile(f))}return h.digest("hex")}
export async function sha256File(p:string){return createHash("sha256").update(await readFile(p)).digest("hex")}
export async function replaceDirectory(partial:string,dest:string){await rm(dest,{recursive:true,force:true});await mkdir(dirname(dest),{recursive:true});await rename(partial,dest)}
export async function copyDereferenced(src:string,dst:string,filter?:(s:string)=>boolean){await cp(src,dst,{recursive:true,dereference:true,filter,force:true})}
function sorted(v:unknown):unknown{if(Array.isArray(v))return v.map(sorted);if(v!==null&&typeof v==="object")return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,sorted(x)]));return v}
export async function writeJson(p:string,v:unknown){await writeFile(p,JSON.stringify(sorted(v),null,2)+"\n")}
export async function makeExecutable(p:string){await chmod(p,(await stat(p)).mode|0o111)}