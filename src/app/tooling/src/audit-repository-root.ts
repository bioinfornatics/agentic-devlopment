#!/usr/bin/env node
import {execFile as execFileCallback} from "node:child_process";
import {resolve} from "node:path";
import {promisify} from "node:util";
const execFile=promisify(execFileCallback);
const patterns=[/^apps\//,/^companions\//,/^\.agents\//,/^\.goose\//,/^src\/app\/node_modules\//,/^src\/app\/[^/]+\/node_modules\//,/^src\/app\/[^/]+\/dist\//,/(^|\/)\.vite\//,/(^|\/)__pycache__\//,/\.db(?:-wal|-shm)?$/];
export function auditTrackedPaths(tracked:Iterable<string>,deleted:Iterable<string>=[]):string[]{const removed=new Set(deleted);return [...tracked].filter(p=>p&&!removed.has(p)).sort().filter(p=>patterns.some(re=>re.test(p)))}
async function gitLines(args:string[]){const{stdout}=await execFile("git",args,{encoding:"utf8"});return stdout.split(/\r?\n/).filter(Boolean)}
export async function auditRepositoryRoot(cwd=process.cwd()){const[tracked,deleted]=await Promise.all([gitLines(["-C",cwd,"ls-files"]),gitLines(["-C",cwd,"diff","--cached","--name-only","--diff-filter=D","--no-renames"])]);const bad=auditTrackedPaths(tracked,deleted);return bad.length?{exitCode:1 as const,stdout:"",stderr:"tracked generated artifacts:\n  "+bad.slice(0,30).join("\n  ")+"\n",bad}:{exitCode:0 as const,stdout:"OK tracked root is source-only\n",stderr:"",bad}}
async function main(){const r=await auditRepositoryRoot();process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.exitCode}
if(process.argv[1]&&import.meta.url===new URL("file:"+resolve(process.argv[1])).href)void main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1});
