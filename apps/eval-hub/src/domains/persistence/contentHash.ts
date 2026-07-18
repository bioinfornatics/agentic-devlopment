/**
 * Content hasher — native TypeScript implementation of Python's content_hash().
 * SHA-256 of sorted (path, content) pairs, truncated to 16 hex chars.
 */
import crypto from "node:crypto";
import fs     from "node:fs/promises";
import path   from "node:path";
import type { IContentHasher } from "./ports.js";

async function collectFiles(p: string): Promise<string[]> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try { stat = await fs.stat(p); } catch { return []; }

  if (stat.isFile()) return [p];

  const entries = await fs.readdir(p, { withFileTypes: true });
  const results: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".") || e.name === "__pycache__" || e.name === "node_modules") continue;
    const child = path.join(p, e.name);
    results.push(...await collectFiles(child));
  }
  return results;
}

export class ContentHasher implements IContentHasher {
  constructor(private readonly length: number = 16) {}

  async hash(paths: readonly string[]): Promise<string> {
    const h = crypto.createHash("sha256");

    // Collect and sort all files across all input paths
    const allFiles: string[] = [];
    for (const p of paths) {
      allFiles.push(...await collectFiles(p));
    }
    allFiles.sort();

    for (const file of allFiles) {
      try {
        const content = await fs.readFile(file);
        h.update(file);
        h.update(content);
      } catch {
        // Skip unreadable files (matches Python's iter_files behaviour)
      }
    }

    return h.digest("hex").slice(0, this.length);
  }
}

export const contentHasher = new ContentHasher();
