#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

export interface RuntimeFile { path: string; sha256: string; size: number }
export interface ProjectionManifest {
  schema: "harness-runtime-projection-v1";
  digest: string;
  target: "linux-x86_64";
  internalManifestSha256: string;
  externalManifestSha256: string;
  files: RuntimeFile[];
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function comparePaths(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

export function runtimeTree(root: string): RuntimeFile[] {
  const paths: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) paths.push(path);
    }
  };
  walk(root);
  return paths.sort(comparePaths).map((path) => ({
    path: relative(root, path).split(sep).join("/"),
    sha256: sha256File(path),
    size: statSync(path).size,
  }));
}

function stableJson(value: unknown, indent?: number): string {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => comparePaths(a, b)).map(([key, child]) => [key, ordered(child)]));
    }
    return item;
  };
  return JSON.stringify(ordered(value), null, indent);
}

export function projectHarnessRuntime(internalInput: string, externalInput: string, runtimeInput: string): string {
  const internal = resolve(internalInput);
  const external = resolve(externalInput);
  const runtime = resolve(runtimeInput);
  mkdirSync(runtime, { recursive: true });
  const partial = mkdtempSync(join(runtime, "runtime-partial-"));
  const root = join(partial, "root");
  mkdirSync(root);
  try {
    for (const name of [".agents", ".goose"]) {
      const source = join(internal, name);
      if (existsSync(source)) cpSync(source, join(root, name), { recursive: true });
    }
    const skills = join(root, ".agents", "skills");
    mkdirSync(skills, { recursive: true });
    for (const item of readdirSync(external, { withFileTypes: true })) {
      if (item.name === "resolved.json") continue;
      if (!item.isDirectory()) throw new Error("external runtime entry is not a directory: " + item.name);
      cpSync(join(external, item.name), join(skills, item.name), { recursive: true });
    }
    const files = runtimeTree(root);
    const payload = stableJson(files);
    const digest = createHash("sha256").update(payload).digest("hex");
    const manifest: ProjectionManifest = {
      schema: "harness-runtime-projection-v1",
      digest,
      target: "linux-x86_64",
      internalManifestSha256: sha256File(join(internal, "build-manifest.json")),
      externalManifestSha256: sha256File(join(external, "resolved.json")),
      files,
    };
    writeFileSync(join(root, ".harness-runtime.json"), stableJson(manifest, 2) + "\n");
    const releases = join(runtime, "releases");
    const target = join(releases, digest);
    mkdirSync(releases, { recursive: true });
    if (existsSync(target)) rmSync(partial, { recursive: true });
    else {
      renameSync(root, target);
      rmSync(partial, { recursive: true, force: true });
    }
    writeFileSync(join(runtime, "candidate"), digest + "\n");
    return digest;
  } catch (error) {
    rmSync(partial, { recursive: true, force: true });
    throw error;
  }
}

function option(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = args[index + 1];
  if (index < 0 || value === undefined || value.startsWith("--")) throw new Error("the following arguments are required: " + name);
  return value;
}

export function projectCli(args: string[]): number {
  try {
    const digest = projectHarnessRuntime(option(args, "--internal"), option(args, "--external"), option(args, "--runtime-root"));
    console.log(digest);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] !== undefined && basename(process.argv[1]).replace(/\.(?:js|ts)$/, "") === "project-harness-runtime") process.exitCode = projectCli(process.argv.slice(2));
