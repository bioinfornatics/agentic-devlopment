#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { REPOSITORY_ROOT } from "./repository-root.js";
import { isMain, prettyJson } from "./release-common.js";

export interface CapturedCommand {
  cmd: string[];
  returncode: number;
  stdout: string;
  stderr: string;
}

export interface AuditBaselineManifest {
  schema: "harness-audit-baseline-manifest-v1";
  generated_at: string;
  repository: string;
  head: string;
  dirty: boolean;
  status_short: string[];
  patch_sha256: string;
  patch_bytes: number;
  commands: {
    head: CapturedCommand;
    status: CapturedCommand;
    diff: { returncode: number };
    diff_cached: { returncode: number };
  };
}

export async function capture(
  command: string,
  args: string[],
  cwd: string,
): Promise<CapturedCommand> {
  return await new Promise((complete, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      complete({
        cmd: [command, ...args],
        returncode: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

function isoUtcSeconds(date: Date): string {
  const seconds = new Date(Math.floor(date.getTime() / 1000) * 1000);
  return seconds.toISOString().replace(/\.000Z$/, "+00:00");
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export async function auditBaselineManifest(
  output?: string,
  root = REPOSITORY_ROOT,
  now = new Date(),
) {
  const execute = (args: string[]) => capture("git", args, root);
  const head = await execute(["rev-parse", "HEAD"]);
  const status = await execute(["status", "--short"]);
  const diff = await execute(["diff", "--binary"]);
  const diffCached = await execute(["diff", "--cached", "--binary"]);
  const patch = Buffer.from(
    diff.stdout + "\n---CACHED---\n" + diffCached.stdout,
  );

  const manifest: AuditBaselineManifest = {
    schema: "harness-audit-baseline-manifest-v1",
    generated_at: isoUtcSeconds(now),
    repository: root,
    head: head.stdout.trim(),
    dirty: status.stdout.trim() !== "",
    status_short: splitLines(status.stdout),
    patch_sha256: createHash("sha256").update(patch).digest("hex"),
    patch_bytes: patch.length,
    commands: {
      head,
      status,
      diff: { returncode: diff.returncode },
      diff_cached: { returncode: diffCached.returncode },
    },
  };

  const path = output ?? resolve(
    root,
    ".audit/harness/audit-baseline-manifest.json",
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, prettyJson(manifest));
  return {
    path,
    dirty: manifest.dirty,
    patch_sha256: manifest.patch_sha256,
    manifest,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length > 1) throw new Error("expected at most one output path");
  const result = await auditBaselineManifest(argv[0]);
  console.log(JSON.stringify({
    path: result.path,
    dirty: result.dirty,
    patch_sha256: result.patch_sha256,
  }, null, 2));
}

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
