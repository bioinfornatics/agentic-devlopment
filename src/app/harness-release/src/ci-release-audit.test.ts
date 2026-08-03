import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { auditBaselineManifest } from "./audit-baseline-manifest.js";
import { ciHarnessRelease, parseCiArgs } from "./ci-harness-release.js";

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function createRepository(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "tooling-git-"));
  temporaryDirectories.push(root);
  await exec("git", ["init", "-q", root]);
  await exec("git", ["-C", root, "config", "user.email", "test@example.com"]);
  await exec("git", ["-C", root, "config", "user.name", "Test"]);
  await writeFile(resolve(root, "staged.txt"), "staged base\n");
  await writeFile(resolve(root, "unstaged.txt"), "unstaged base\n");
  await exec("git", ["-C", root, "add", "staged.txt", "unstaged.txt"]);
  await exec("git", ["-C", root, "commit", "-qm", "base"]);
  return root;
}

function argumentValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

describe("audit baseline manifest", () => {
  it("captures git status and hashes staged plus unstaged patches", async () => {
    const root = await createRepository();
    const output = resolve(root, "result.json");
    await writeFile(resolve(root, "staged.txt"), "staged change\n");
    await exec("git", ["-C", root, "add", "staged.txt"]);
    await writeFile(resolve(root, "unstaged.txt"), "unstaged change\n");

    const unstaged = await exec("git", ["-C", root, "diff", "--binary"]);
    const staged = await exec("git", [
      "-C",
      root,
      "diff",
      "--cached",
      "--binary",
    ]);
    const patch = Buffer.from(
      unstaged.stdout + "\n---CACHED---\n" + staged.stdout,
    );
    const expectedHash = createHash("sha256").update(patch).digest("hex");

    const result = await auditBaselineManifest(
      output,
      root,
      new Date("2026-07-29T07:00:00Z"),
    );

    expect(result.manifest).toMatchObject({
      schema: "harness-audit-baseline-manifest-v1",
      generated_at: "2026-07-29T07:00:00+00:00",
      repository: root,
      dirty: true,
      status_short: ["M  staged.txt", " M unstaged.txt"],
      patch_sha256: expectedHash,
      patch_bytes: patch.length,
    });
    expect(JSON.parse(await readFile(output, "utf8"))).toEqual(result.manifest);
  });
});

describe("CI harness release", () => {
  it("preserves command-line arguments", () => {
    expect(parseCiArgs([
      "--version",
      "1",
      "--output",
      "x",
      "--goose-cli",
      "goose",
      "--attestation", "attestation.json",
      "--bindings", "bindings.json",
      "--profile", "profile.json",
      "--dry-run-publish",
      "--skip-tests",
    ])).toMatchObject({
      version: "1",
      output: "x",
      gooseCli: "goose",
      attestation: "attestation.json",
      bindings: "bindings.json",
      profile: "profile.json",
      dryRunPublish: true,
      skipTests: true,
    });
    expect(() => parseCiArgs(["--wat"])).toThrow("unrecognized");
    expect(() => parseCiArgs(["--version","1","--output","x","--override-attestation"])).toThrow("unrecognized");
  });

  it("enforces a clean git tree", async () => {
    const root = await createRepository();
    await writeFile(resolve(root, "dirty.txt"), "dirty\n");

    await expect(ciHarnessRelease({
      version: "1",
      output: resolve(root, "out"),
      dryRunPublish: false,
      skipTests: true,
      root,
      ci: false,
      command: async () => "",
    })).rejects.toThrow("clean git tree");
  });

  it("orchestrates reproducibly and records results", async () => {
    const root = await createRepository();
    const outputDirectory = resolve(root, "out");
    await mkdir(resolve(root, "src/harness"), { recursive: true });
    await writeFile(resolve(root, "src/harness/external-skills.lock.json"), "lock");
    const calls: string[] = [];

    const command = async (program: string, args: string[]): Promise<string> => {
      calls.push([program, ...args].join(" "));
      const output = argumentValue(args, "--output");
      const staging = argumentValue(args, "--staging");

      if (staging !== undefined) {
        await mkdir(staging, { recursive: true });
        await writeFile(resolve(staging, "resolved.json"), "{}\n");
      }
      if (output !== undefined && args[0]?.includes("build-harness")) {
        await mkdir(output, { recursive: true });
        await writeFile(resolve(output, "build-manifest.json"), "{}\n");
      }
      if (output !== undefined && args[0]?.includes("assemble-harness")) {
        await mkdir(output, { recursive: true });
        await writeFile(
          resolve(output, "harness-1-linux-x86_64.tar"),
          "same",
        );
        await writeFile(resolve(output, "release.json"), "release");
      }
      return "";
    };

    const result = await ciHarnessRelease({
      version: "1",
      output: outputDirectory,
      dryRunPublish: true,
      skipTests: true,
      root,
      ci: true,
      command,
    });

    expect(result).toEqual({
      schema: "harness-ci-release-v1",
      version: "1",
      archive: "harness-1-linux-x86_64.tar",
      digest: createHash("sha256").update("same").digest("hex"),
      releaseManifestSha256: createHash("sha256")
        .update("release")
        .digest("hex"),
      lockSha256: createHash("sha256").update("lock").digest("hex"),
      dryRunPublish: true,
    });
    expect(calls.filter((call) =>
      call.includes("assemble-harness-release")
    )).toHaveLength(2);
    expect(calls.some((call) => call.includes("harness-manager"))).toBe(false);
    expect(JSON.parse(
      await readFile(resolve(outputDirectory, "ci-result.json"), "utf8"),
    )).toEqual(result);
  });
});
