import { chmod, cp, mkdir, rm, stat, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
export async function pathExists(p:string){try{await stat(p);return true}catch{return false}}
export async function replaceDirectory(partial:string,dest:string){await rm(dest,{recursive:true,force:true});await mkdir(dirname(dest),{recursive:true});await rename(partial,dest)}
export async function copyDereferenced(src:string,dst:string,filter?:(s:string)=>boolean){await cp(src,dst,{recursive:true,dereference:true,filter,force:true})}
function sorted(v:unknown):unknown{if(Array.isArray(v))return v.map(sorted);if(v!==null&&typeof v==="object")return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sorted(x)]));return v}
export async function writeJson(p:string,v:unknown){await writeFile(p,JSON.stringify(sorted(v),null,2)+"\n")}
export async function makeExecutable(p:string){await chmod(p,(await stat(p)).mode|0o111)}
