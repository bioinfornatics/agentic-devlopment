#!/usr/bin/env node
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { REPOSITORY_ROOT } from "./repository-root.js";
import { compactJson, isMain, prettyJson, run, sha256File } from "./release-common.js";
import { verifyLocalAttestationFiles } from "./verify-local-attestation.js";
import type { LocalEvaluationBindings } from "@harness/eval-hub/local-evaluation";

export interface CiHarnessReleaseOptions {
  version: string;
  output: string;
  gooseCli?: string | undefined;
  attestation?: string | undefined;
  bindings?: string | undefined;
  profile?: string | undefined;
  dryRunPublish: boolean;
  skipTests: boolean;
  root?: string | undefined;
  ci?: boolean | undefined;
  command?: ((program: string, args: string[]) => Promise<string>) | undefined;
}
export interface CiReleaseResult {
  schema: "harness-ci-release-v1";
  version: string;
  archive: string;
  digest: string;
  releaseManifestSha256: string;
  lockSha256: string;
  dryRunPublish: boolean;
}

function validVersion(version: string) {
  return version !== "" && version !== "." && version !== ".." && !/[\\/]/.test(version);
}

export async function ciHarnessRelease(options: CiHarnessReleaseOptions): Promise<CiReleaseResult> {
  const root = options.root ?? REPOSITORY_ROOT;
  const output = resolve(options.output);
  const command = options.command ?? ((program: string, args: string[]) => run(program, args, { cwd: root, stdout: "inherit" }));
  if (!validVersion(options.version)) throw new Error("invalid release version");
  const inCi = options.ci ?? process.env.CI === "true";
  const status = await run("git", ["status", "--porcelain"], { cwd: root }).catch(() => inCi ? "" : Promise.reject(new Error("release build requires a git worktree outside CI")));
  if (status.trim() !== "" && !inCi) throw new Error("release build requires clean git tree");

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await command("pnpm", ["--dir", "src/app", "--filter", "@harness/harness-release", "build"]);
  await command("node", ["src/app/harness-release/dist/validate-harness-manifests.js"]);
  if (!options.skipTests) {
    await command("pnpm", ["--dir", "src/app", "--filter", "@harness/harness-release", "test"]);
  }

  const temporary = await mkdtemp(resolve(tmpdir(), "harness-ci-"));
  try {
    const external = resolve(temporary, "external");
    const internal = resolve(temporary, "internal");
    const release = resolve(output, "release");
    const secondRelease = resolve(temporary, "release2");
    await command("node", ["src/app/harness-release/dist/resolve-external-skills.js", "--staging", external]);
    await command("node", ["src/app/harness-release/dist/build-harness.js", "--output", internal]);
    for (const destination of [release, secondRelease]) {
      await command("node", ["src/app/harness-release/dist/assemble-harness-release.js", "--internal", internal, "--external", external, "--output", destination, "--version", options.version]);
    }
    const archiveName = (await readdir(release)).find((name) => name.endsWith(".tar"));
    const secondArchiveName = (await readdir(secondRelease)).find((name) => name.endsWith(".tar"));
    if (archiveName === undefined || secondArchiveName === undefined) throw new Error("release archive missing");
    const archive = resolve(release, archiveName);
    const secondArchive = resolve(secondRelease, secondArchiveName);
    if (!(await readFile(archive)).equals(await readFile(secondArchive))) throw new Error("reproducibility failure");

    const digest = await sha256File(archive);
    if (!options.dryRunPublish) {
      if (options.attestation === undefined || options.bindings === undefined || options.profile === undefined) throw new Error("publication requires --attestation, --bindings, and --profile");
      const suppliedBindings = JSON.parse(await readFile(resolve(options.bindings), "utf8")) as LocalEvaluationBindings;
      if (suppliedBindings.release !== digest) throw new Error("attestation bindings release digest does not match exact candidate");
      await verifyLocalAttestationFiles({ attestation: resolve(options.attestation), bindings: resolve(options.bindings), profile: resolve(options.profile) });
    }
    const result: CiReleaseResult = {
      schema: "harness-ci-release-v1",
      version: options.version,
      archive: basename(archive),
      digest,
      releaseManifestSha256: await sha256File(resolve(release, "release.json")),
      lockSha256: await sha256File(resolve(root, "src/harness/external-skills.lock.json")),
      dryRunPublish: options.dryRunPublish,
    };
    await writeFile(resolve(output, "ci-result.json"), prettyJson(result));
    return result;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function usage() {
  return "usage: ci-harness-release --version VERSION --output OUTPUT [--goose-cli GOOSE_CLI] [--attestation FILE --bindings FILE --profile FILE] [--dry-run-publish] [--skip-tests]";
}
export function parseCiArgs(argv: string[]): CiHarnessReleaseOptions | "help" {
  let version: string | undefined;
  let output: string | undefined;
  let gooseCli: string | undefined;
  let attestation: string | undefined;
  let bindings: string | undefined;
  let profile: string | undefined;
  let dryRunPublish = false;
  let skipTests = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument === "-h" || argument === "--help") return "help";
    if (argument === "--dry-run-publish") { dryRunPublish = true; continue; }
    if (argument === "--skip-tests") { skipTests = true; continue; }
    if (["--version", "--output", "--goose-cli", "--attestation", "--bindings", "--profile"].includes(argument)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) throw new Error("argument " + argument + ": expected one argument");
      if (argument === "--version") version = value;
      else if (argument === "--output") output = value;
      else if (argument === "--goose-cli") gooseCli = value;
      else if (argument === "--attestation") attestation = value;
      else if (argument === "--bindings") bindings = value;
      else profile = value;
      continue;
    }
    throw new Error("unrecognized arguments: " + argument);
  }
  if (version === undefined || output === undefined) throw new Error("the following arguments are required:" + (version === undefined ? " --version" : "") + (output === undefined ? " --output" : ""));
  return { version, output, gooseCli, attestation, bindings, profile, dryRunPublish, skipTests };
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseCiArgs(argv);
  if (options === "help") { console.log(usage()); return; }
  console.log(compactJson(await ciHarnessRelease(options)).trimEnd());
}
if (isMain(import.meta.url)) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });