import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sep, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url || "unused")), "../../../../..") as string;

export async function sha256Tree(root: string, exclude = false) {
  const h = createHash("sha256");
  async function* walk(p: string): AsyncGenerator<string> {
    const { readdir, stat } = await import("node:fs/promises");
    for (const e of await readdir(p, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = resolve(p, e.name);
      if (exclude && (full.includes("node_modules") || full.includes("dist") || full.includes(".beads") || full.endsWith("pnpm-lock.yaml"))) continue;
      if (e.isDirectory()) yield* walk(full);
      else { h.update(relative(root, full).split(sep).join("/")); h.update(Buffer.from([0])); h.update(await readFile(full)); }
    }
  }
  await walk(root);
  return h.digest("hex");
}

export async function sha256File(p: string) {
  return createHash("sha256").update(await readFile(p)).digest("hex");
}

export function isMain(url: string) {
  return process.argv[1] !== undefined && resolve(process.argv[1]) == resolve(new URL(url).pathname);
}

function stable(v: unknown): unknown {
  if (v == null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(stable);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object).sort()) out[k] = stable((v as Record<string, unknown>)[k]);
  return out;
}

export function compactJson(value: unknown) { return JSON.stringify(stable(value)) + "\n"; }
export function prettyJson(value: unknown) { return JSON.stringify(stable(value), null, 2) + "\n"; }

// List files below a directory, respecting .gitignore-equivalent excludes
async function filesBelow(root: string, exclude: boolean): Promise<string[]> {
  const { readdir, stat } = await import("node:fs/promises");
  const out: string[] = [];
  async function walk(p: string) {
    for (const e of await readdir(p, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = resolve(p, e.name);
      if (exclude && (full.includes("node_modules") || full.includes("dist") || full.includes(".beads") || full.endsWith("pnpm-lock.yaml"))) continue;
      if (e.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}
