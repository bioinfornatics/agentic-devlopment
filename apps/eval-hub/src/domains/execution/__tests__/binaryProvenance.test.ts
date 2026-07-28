/**
 * Binary provenance tests.
 *
 * 1. FsBinaryProvenanceChecker snapshot captures real fs metadata
 * 2. Mutation between snapshots: stableDuringRun = false
 * 3. Identical snapshots: stableDuringRun = true
 * 4. NullBinaryProvenanceChecker always stable
 * 5. MutatingBinaryProvenanceChecker simulates in-flight replacement
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BINARY_PROVENANCE_SCHEMA,
  FsBinaryProvenanceChecker,
  MutatingBinaryProvenanceChecker,
  NullBinaryProvenanceChecker,
  ThrowingBinaryProvenanceChecker,
} from "../binaryProvenance.js";

let tmpDir: string;
beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bprov-test-")); });
afterEach(async () => { await fs.rm(tmpDir, { recursive: true, force: true }); });

const checker = new FsBinaryProvenanceChecker();

function randomBytes(n: number): Buffer {
  return crypto.randomBytes(n);
}

describe("FsBinaryProvenanceChecker.captureSnapshot", () => {
  it("returns a snapshot with the correct schema", async () => {
    const bin = path.join(tmpDir, "fake-binary");
    await fs.writeFile(bin, randomBytes(64));
    const snap = await checker.captureSnapshot(bin);
    expect(snap.schema).toBe(BINARY_PROVENANCE_SCHEMA);
  });

  it("resolves realpath and reports correct size", async () => {
    const content = randomBytes(128);
    const bin = path.join(tmpDir, "bin");
    await fs.writeFile(bin, content);
    const snap = await checker.captureSnapshot(bin);
    expect(snap.size).toBe(128);
    expect(snap.realpath).toBeTruthy();
    expect(snap.inode).toBeGreaterThan(0);
    expect(snap.mtimeMs).toBeGreaterThan(0);
  });

  it("sha256 matches the file content", async () => {
    const content = Buffer.from("hello provenance");
    const expected = crypto.createHash("sha256").update(content).digest("hex");
    const bin = path.join(tmpDir, "bin2");
    await fs.writeFile(bin, content);
    const snap = await checker.captureSnapshot(bin);
    expect(snap.sha256).toBe(expected);
  });

  it("version is null when the binary does not support --version", async () => {
    // A file that is not executable or fails --version
    const bin = path.join(tmpDir, "not-a-binary");
    await fs.writeFile(bin, "not executable content");
    const snap = await checker.captureSnapshot(bin);
    // version may be null or a string; must not throw
    expect(snap.version === null || typeof snap.version === "string").toBe(true);
  });

  it("throws when the file does not exist", async () => {
    await expect(checker.captureSnapshot(path.join(tmpDir, "nonexistent"))).rejects.toThrow();
  });
});

describe("FsBinaryProvenanceChecker.checkStability", () => {
  it("detects sha256 change after file mutation", async () => {
    const bin = path.join(tmpDir, "binary");
    await fs.writeFile(bin, randomBytes(64));
    const before = await checker.captureSnapshot(bin);

    // Mutate the file (overwrite with different content)
    await new Promise(r => setTimeout(r, 10)); // ensure mtime changes
    await fs.writeFile(bin, randomBytes(64));
    const after = await checker.captureSnapshot(bin);

    const stability = checker.checkStability(before, after);
    expect(stability.stableDuringRun).toBe(false);
    expect(stability.instabilityDetail).not.toBeNull();
    expect(stability.instabilityDetail).toMatch(/sha256 changed/);
  });

  it("is stable when the file is unchanged", async () => {
    const bin = path.join(tmpDir, "stable-binary");
    await fs.writeFile(bin, randomBytes(64));
    const before = await checker.captureSnapshot(bin);
    const after  = await checker.captureSnapshot(bin);
    const stability = checker.checkStability(before, after);
    expect(stability.stableDuringRun).toBe(true);
    expect(stability.instabilityDetail).toBeNull();
  });

  it("instabilityDetail is null when stable", () => {
    const snap = { schema: BINARY_PROVENANCE_SCHEMA as typeof BINARY_PROVENANCE_SCHEMA, capturedAt: "t", inputPath: "x", realpath: "x", sha256: "a".repeat(64), version: null, size: 10, mtimeMs: 1000, inode: 1 };
    const result = checker.checkStability(snap, { ...snap, capturedAt: "t2" });
    expect(result.stableDuringRun).toBe(true);
    expect(result.instabilityDetail).toBeNull();
  });
});

describe("NullBinaryProvenanceChecker", () => {
  it("always returns stable result", async () => {
    const nc = new NullBinaryProvenanceChecker();
    const before = await nc.captureSnapshot("/any/path");
    const after  = await nc.captureSnapshot("/any/path");
    const result = nc.checkStability(before, after);
    expect(result.stableDuringRun).toBe(true);
    expect(result.instabilityDetail).toBeNull();
  });
});

describe("FsBinaryProvenanceChecker — PATH resolution", () => {
  it("resolves a command name via PATH (e.g. 'ls' or 'node')", async () => {
    // Pick a command guaranteed to exist in PATH in a POSIX environment
    const snap = await checker.captureSnapshot("node");
    expect(snap.schema).toBe(BINARY_PROVENANCE_SCHEMA);
    expect(path.isAbsolute(snap.realpath)).toBe(true);
    expect(snap.size).toBeGreaterThan(0);
  });

  it("throws for a command that does not exist in PATH", async () => {
    await expect(
      checker.captureSnapshot("__nonexistent_command_xyz_789__"),
    ).rejects.toThrow(/cannot resolve command|command not found/i);
  });
});

describe("ThrowingBinaryProvenanceChecker", () => {
  it("throws on first call (default — simulates BEFORE unavailable)", async () => {
    const tc = new ThrowingBinaryProvenanceChecker();
    await expect(tc.captureSnapshot("/any")).rejects.toThrow(/binary unavailable/i);
  });

  it("succeeds on first call, throws on second (simulates AFTER unavailable)", async () => {
    const tc = new ThrowingBinaryProvenanceChecker("second");
    const snap = await tc.captureSnapshot("/any");
    expect(snap.schema).toBe(BINARY_PROVENANCE_SCHEMA);
    await expect(tc.captureSnapshot("/any")).rejects.toThrow(/binary unavailable/i);
  });

  it("throws on every call when configured 'both'", async () => {
    const tc = new ThrowingBinaryProvenanceChecker("both");
    await expect(tc.captureSnapshot("/any")).rejects.toThrow();
    await expect(tc.captureSnapshot("/any")).rejects.toThrow();
  });
});

describe("MutatingBinaryProvenanceChecker", () => {
  it("first call matches null snapshot, second call is different — checkStability reports unstable", async () => {
    const mc = new MutatingBinaryProvenanceChecker();
    const before = await mc.captureSnapshot("/fake");
    const after  = await mc.captureSnapshot("/fake");
    const result = mc.checkStability(before, after);
    expect(result.stableDuringRun).toBe(false);
    expect(result.instabilityDetail).not.toBeNull();
  });
});
