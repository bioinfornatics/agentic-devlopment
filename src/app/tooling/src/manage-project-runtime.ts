#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ProjectionManifest } from "./project-harness-runtime.js";

function sha256File(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function isSymlink(path: string): boolean { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } }

export function replaceLink(link: string, target: string): void {
  const temporary = join(dirname(link), "." + basename(link) + ".tmp");
  rmSync(temporary, { force: true });
  symlinkSync(target, temporary);
  renameSync(temporary, link);
}

export function verifyRelease(root: string): string {
  const manifest = JSON.parse(readFileSync(join(root, ".harness-runtime.json"), "utf8")) as ProjectionManifest;
  for (const file of manifest.files) {
    const path = join(root, file.path);
    if (!existsSync(path) || !lstatSync(path).isFile() || sha256File(path) !== file.sha256) throw new Error("runtime drift: " + file.path);
  }
  return manifest.digest;
}

export function activateRuntime(runtimeInput: string, projectInput: string, digest: string): void {
  const runtime = resolve(runtimeInput);
  const project = resolve(projectInput);
  const target = join(runtime, "releases", digest);
  if (!existsSync(target) || !lstatSync(target).isDirectory()) throw new Error("runtime release missing: " + digest);
  verifyRelease(target);
  const current = join(runtime, "current");
  const old = isSymlink(current) ? basename(realpathSync(current)) : undefined;
  if (old !== undefined) writeFileSync(join(runtime, "previous"), old + "\n");
  replaceLink(current, join("releases", digest));
  replaceLink(join(project, ".agents"), "build/harness/runtime/current/.agents");
  replaceLink(join(project, ".goose"), "build/harness/runtime/current/.goose");
}

export type RuntimeAction = "activate" | "verify" | "rollback" | "clean";
export function manageProjectRuntime(action: RuntimeAction, runtimeInput: string, projectInput: string): string | undefined {
  const runtime = resolve(runtimeInput);
  const project = resolve(projectInput);
  if (action === "activate") {
    activateRuntime(runtime, project, readFileSync(join(runtime, "candidate"), "utf8").trim());
  } else if (action === "verify") {
    const current = join(runtime, "current");
    if (!isSymlink(current)) throw new Error("runtime current missing");
    const digest = verifyRelease(realpathSync(current));
    for (const name of [".agents", ".goose"]) {
      const link = join(project, name);
      if (!isSymlink(link) || realpathSync(link) !== realpathSync(join(current, name))) throw new Error("project runtime link mismatch: " + name);
    }
    return digest;
  } else if (action === "rollback") {
    const previous = join(runtime, "previous");
    if (!existsSync(previous)) throw new Error("no previous runtime");
    activateRuntime(runtime, project, readFileSync(previous, "utf8").trim());
  } else {
    const current = join(runtime, "current");
    const currentPath = isSymlink(current) ? realpathSync(current) : undefined;
    const previousPath = join(runtime, "previous");
    const previous = existsSync(previousPath) ? readFileSync(previousPath, "utf8").trim() : undefined;
    const releases = join(runtime, "releases");
    if (existsSync(releases)) for (const name of readdirSync(releases)) {
      const path = join(releases, name);
      if (path !== currentPath && name !== previous) rmSync(path, { recursive: true });
    }
  }
  return undefined;
}

function option(args: string[], name: string): string {
  const index = args.indexOf(name); const value = args[index + 1];
  if (index < 0 || value === undefined || value.startsWith("--")) throw new Error("the following arguments are required: " + name);
  return value;
}
export function manageCli(args: string[]): number {
  try {
    const action = args[0];
    if (action !== "activate" && action !== "verify" && action !== "rollback" && action !== "clean") throw new Error("action must be one of: activate, verify, rollback, clean");
    const output = manageProjectRuntime(action, option(args, "--runtime-root"), option(args, "--project-root"));
    if (output !== undefined) console.log(output);
    return 0;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); return 1; }
}
if (process.argv[1] !== undefined && basename(process.argv[1]).replace(/\.(?:js|ts)$/, "") === "manage-project-runtime") process.exitCode = manageCli(process.argv.slice(2));
