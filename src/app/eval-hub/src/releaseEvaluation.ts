import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface ReleaseEvidence {
  schema: "harness-eval-provenance-v1";
  runId: string;
  releaseDigest: string;
  releaseManifestSha256: string;
  lockSha256: string;
  gooseBinarySha256: string;
  externalSkills: string[];
  evalHubIncludedInRelease: false;
  releaseDigestAfter?: string;
  stableDuringRun?: boolean;
}
export interface ReleaseEvaluationOptions { release: string; gooseCli: string; evalHub?: string; runId?: string; dryRun?: boolean; evalArgs?: string[]; root?: string; }
type ReleaseManifest = { lockSha256: string; files: Array<{ path: string; sha256: string }> };

export async function fileHash(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
async function filesBelow(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesBelow(root, path));
    else if (entry.isFile()) out.push(path.slice(root.length + 1).split("\\").join("/"));
  }
  return out;
}
export async function treeDigest(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const relative of (await filesBelow(root)).sort()) {
    hash.update(relative); hash.update(Buffer.from([0])); hash.update(await readFile(join(root, relative)));
  }
  return hash.digest("hex");
}
export async function verifyRelease(root: string): Promise<ReleaseManifest> {
  const manifest = JSON.parse(await readFile(join(root, "release.json"), "utf8")) as ReleaseManifest;
  for (const file of manifest.files) {
    let regular = false;
    try { regular = (await lstat(join(root, file.path))).isFile(); } catch { /* reported as drift */ }
    if (!regular || await fileHash(join(root, file.path)).catch(() => "") !== file.sha256) throw new Error("release drift: " + file.path);
  }
  return manifest;
}
export async function createEvaluationOverlay(release: string, root: string, parent: string): Promise<string> {
  const overlay = join(parent, "project");
  await cp(release, overlay, { recursive: true, dereference: true });
  for (const name of ["evals", ".beads"]) {
    const source = join(root, name);
    try { await lstat(source); } catch { continue; }
    await rm(join(overlay, name), { recursive: true, force: true });
    await symlink(source, join(overlay, name), "dir");
  }
  return overlay;
}
function utcRunId(): string { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
export function buildEvalHubInvocation(evalHub: string, runId: string, gooseCli: string, evalArgs: string[] = []): string[] {
  return [evalHub, "--run", "--resume", runId, "--goose-cli", gooseCli, ...evalArgs.filter(a => a !== "--")];
}
function invoke(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((done, reject) => { const child = spawn(command, args, { cwd, env, stdio: "inherit" }); child.once("error", reject); child.once("exit", (code, signal) => done(code ?? (signal ? 1 : 0))); });
}
export async function evaluateHarnessRelease(options: ReleaseEvaluationOptions): Promise<{ evidence: ReleaseEvidence; exitCode: number; overlay?: string }> {
  const root = resolve(options.root ?? new URL("../../../..", import.meta.url).pathname);
  const release = resolve(options.release); const goose = resolve(options.gooseCli);
  const manifest = await verifyRelease(release); const digest = await treeDigest(release);
  const lock = JSON.parse(await readFile(join(root, "harness/external-skills.lock.json"), "utf8")) as { skills: Array<{ name: string; active: boolean }> };
  const active = lock.skills.filter(s => s.active).map(s => s.name).sort();
  const missing: string[] = [];
  for (const name of active) { try { await lstat(join(root, "evals/skills", name + ".json")); } catch { missing.push(name); } }
  if (missing.length) throw new Error("external skills missing eval coverage: " + missing.join(","));
  const runId = options.runId ?? utcRunId();
  const evidence: ReleaseEvidence = { schema: "harness-eval-provenance-v1", runId, releaseDigest: digest, releaseManifestSha256: await fileHash(join(release, "release.json")), lockSha256: manifest.lockSha256, gooseBinarySha256: await fileHash(goose), externalSkills: active, evalHubIncludedInRelease: false };
  if (options.dryRun) return { evidence, exitCode: 0 };
  const temporary = await mkdtemp(join(tmpdir(), "eval-release-"));
  try {
    const overlay = await createEvaluationOverlay(release, root, temporary);
    const out = join(root, "dist/evals/layered", runId); await mkdir(out, { recursive: true });
    const provenance = join(out, "harness-release-provenance.json");
    await writeFile(provenance, JSON.stringify(evidence, null, 2) + "\n");
    const hub = resolve(root, options.evalHub ?? "src/app/eval-hub/dist/index.js");
    const args = buildEvalHubInvocation(hub, runId, goose, options.evalArgs);
    const exitCode = await invoke(process.execPath, args, root, { ...process.env, PROJECT_ROOT: overlay, HARNESS_RELEASE_DIGEST: digest });
    const after = await treeDigest(release); evidence.releaseDigestAfter = after; evidence.stableDuringRun = after === digest;
    await writeFile(provenance, JSON.stringify(evidence, null, 2) + "\n");
    if (after !== digest) throw new Error("release mutated during evaluation; discard run " + runId);
    return { evidence, exitCode, overlay };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export function parseReleaseEvaluationArgs(args: string[]): ReleaseEvaluationOptions {
  const take = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const release = take("--release"), gooseCli = take("--goose-cli");
  if (!release || !gooseCli) throw new Error("--release and --goose-cli are required");
  const knownWithValue = new Set(["--release", "--goose-cli", "--eval-hub", "--run-id"]); const evalArgs: string[] = []; let remainder = false;
  for (let i=0;i<args.length;i++) { const a=args[i]!; if (a==="--") { remainder=true; continue; } if (remainder) evalArgs.push(a); else if (knownWithValue.has(a)) i++; else if (a!=="--evaluate-harness-release" && a!=="--dry-run") evalArgs.push(a); }
  const evalHub = take("--eval-hub"), runId = take("--run-id");
  return { release, gooseCli, ...(evalHub ? { evalHub } : {}), ...(runId ? { runId } : {}), dryRun: args.includes("--dry-run"), evalArgs };
}
