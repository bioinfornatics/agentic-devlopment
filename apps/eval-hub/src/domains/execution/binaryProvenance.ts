/**
 * Binary provenance module.
 *
 * Captures a snapshot of the Goose binary (or any executable) before and after
 * a run so that unexpected in-flight mutations can be detected and excluded from
 * grading (exclusion: runtime_binary_changed).
 *
 * Injectable via IBinaryProvenanceChecker for deterministic unit tests.
 * NullBinaryProvenanceChecker is provided for tests that do not exercise provenance.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const BINARY_PROVENANCE_SCHEMA = "binary-provenance-v1" as const;

export interface BinarySnapshot {
  readonly schema: typeof BINARY_PROVENANCE_SCHEMA;
  readonly capturedAt: string;   // ISO timestamp
  readonly inputPath: string;    // original path as supplied
  readonly realpath: string;     // resolved symlinks
  readonly sha256: string;       // full hex digest of binary bytes
  readonly version: string | null; // from `<binary> --version`, null on error
  readonly size: number;         // bytes
  readonly mtimeMs: number;      // mtime in milliseconds since epoch
  readonly inode: number;        // inode number (for rename/replacement detection)
}

export interface BinaryStabilityResult {
  readonly stableDuringRun: boolean;
  /** Human-readable detail of what changed; null when stable. */
  readonly instabilityDetail: string | null;
}

export interface IBinaryProvenanceChecker {
  captureSnapshot(binaryPath: string): Promise<BinarySnapshot>;
  checkStability(before: BinarySnapshot, after: BinarySnapshot): BinaryStabilityResult;
}

// ── Filesystem implementation ─────────────────────────────────────────────────

export class FsBinaryProvenanceChecker implements IBinaryProvenanceChecker {
  async captureSnapshot(binaryPath: string): Promise<BinarySnapshot> {
    const absolute = path.isAbsolute(binaryPath) ? binaryPath : await this._resolveViaPath(binaryPath);
    const resolved = await fs.realpath(absolute);
    const [stat, buf] = await Promise.all([fs.stat(resolved), fs.readFile(resolved)]);
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const version = await this._readVersion(resolved);
    return {
      schema: BINARY_PROVENANCE_SCHEMA,
      capturedAt: new Date().toISOString(),
      inputPath: binaryPath,
      realpath: resolved,
      sha256,
      version,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      inode: stat.ino,
    };
  }

  checkStability(before: BinarySnapshot, after: BinarySnapshot): BinaryStabilityResult {
    const reasons: string[] = [];
    if (before.sha256 !== after.sha256)
      reasons.push(`sha256 changed: ${before.sha256.slice(0, 16)}… → ${after.sha256.slice(0, 16)}…`);
    if (before.inode !== after.inode)
      reasons.push(`inode changed: ${before.inode} → ${after.inode}`);
    if (before.size !== after.size)
      reasons.push(`size changed: ${before.size} → ${after.size}`);
    if (before.mtimeMs !== after.mtimeMs)
      reasons.push(`mtime changed: ${before.mtimeMs} → ${after.mtimeMs}`);
    if (before.realpath !== after.realpath)
      reasons.push(`realpath changed: ${before.realpath} → ${after.realpath}`);
    const stableDuringRun = reasons.length === 0;
    return {
      stableDuringRun,
      instabilityDetail: stableDuringRun ? null : reasons.join("; "),
    };
  }

  /** Resolve a bare command name (e.g. "goose") via PATH using `which`. */
  private async _resolveViaPath(command: string): Promise<string> {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync("which", [command], { timeout: 5_000 }));
    } catch (err) {
      throw new Error(
        `cannot resolve command '${command}' via PATH: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const resolved = stdout.trim();
    if (!resolved) throw new Error(`command not found in PATH: ${command}`);
    return resolved;
  }

  private async _readVersion(binaryPath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(binaryPath, ["--version"], { timeout: 5_000 });
      const trimmed = stdout.trim().slice(0, 128);
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
}

// ── No-op checker for tests ───────────────────────────────────────────────────

const NULL_SNAPSHOT: BinarySnapshot = {
  schema: BINARY_PROVENANCE_SCHEMA,
  capturedAt: "1970-01-01T00:00:00.000Z",
  inputPath: "null-checker",
  realpath: "null-checker",
  sha256: "0".repeat(64),
  version: null,
  size: 0,
  mtimeMs: 0,
  inode: 0,
};

/**
 * No-op checker for unit tests that do not need real binary I/O.
 * Always returns an identical stable snapshot pair.
 */
export class NullBinaryProvenanceChecker implements IBinaryProvenanceChecker {
  async captureSnapshot(_binaryPath: string): Promise<BinarySnapshot> {
    return NULL_SNAPSHOT;
  }
  checkStability(_before: BinarySnapshot, _after: BinarySnapshot): BinaryStabilityResult {
    return { stableDuringRun: true, instabilityDetail: null };
  }
}

/**
 * Checker that throws on captureSnapshot to simulate binary unavailability.
 *
 * throwOnCall:
 *   "first"  — throws on the pre-run snapshot (BEFORE); AFTER is the null snapshot
 *   "second" — returns null snapshot BEFORE; throws on the post-run snapshot (AFTER)
 *   "both"   — throws on every call
 */
export class ThrowingBinaryProvenanceChecker implements IBinaryProvenanceChecker {
  constructor(private readonly throwOnCall: "first" | "second" | "both" = "first") {}
  private callCount = 0;
  async captureSnapshot(_binaryPath: string): Promise<BinarySnapshot> {
    this.callCount++;
    const shouldThrow =
      this.throwOnCall === "both" ||
      (this.throwOnCall === "first"  && this.callCount === 1) ||
      (this.throwOnCall === "second" && this.callCount === 2);
    if (shouldThrow) throw new Error("binary unavailable (test — ThrowingBinaryProvenanceChecker)");
    return NULL_SNAPSHOT;
  }
  checkStability(before: BinarySnapshot, after: BinarySnapshot): BinaryStabilityResult {
    return new FsBinaryProvenanceChecker().checkStability(before, after);
  }
}

/**
 * Mutation-detecting checker for tests: returns a different snapshot on the
 * second call (simulates an in-flight binary replacement).
 */
export class MutatingBinaryProvenanceChecker implements IBinaryProvenanceChecker {
  private callCount = 0;
  async captureSnapshot(_binaryPath: string): Promise<BinarySnapshot> {
    this.callCount++;
    if (this.callCount === 1) return NULL_SNAPSHOT;
    return {
      ...NULL_SNAPSHOT,
      sha256: "f".repeat(64),
      mtimeMs: 1_000_000,
      inode: 99999,
    };
  }
  checkStability(before: BinarySnapshot, after: BinarySnapshot): BinaryStabilityResult {
    return new FsBinaryProvenanceChecker().checkStability(before, after);
  }
}
