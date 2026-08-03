#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("bash", [resolve(packageRoot, "scripts/build-docs.sh"), ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
