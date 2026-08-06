import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
export async function filesBelow(root:string,exclude=false){const out:string[]=[];async function walk(p:string){for(const e of await readdir(p,{withFileTypes:true})){if(exclude&&["__pycache__","node_modules","dist",".vite"].includes(e.name))continue;const c=resolve(p,e.name);if(e.isDirectory())await walk(c);else if(e.isFile())out.push(c);else if(e.isSymbolicLink()){try{if((await stat(c)).isFile())out.push(c)}catch{/* broken/external symlink excluded */}}}}await walk(root);return out.sort((a,b)=>relative(root,a).split(sep).join("/").localeCompare(relative(root,b).split(sep).join("/")))}
export async function sha256Tree(root:string,exclude=false){const h=createHash("sha256");for(const f of await filesBelow(root,exclude)){h.update(relative(root,f).split(sep).join("/"));h.update(Buffer.from([0]));h.update(await readFile(f))}return h.digest("hex")}
export async function sha256File(p:string){return createHash("sha256").update(await readFile(p)).digest("hex")}
