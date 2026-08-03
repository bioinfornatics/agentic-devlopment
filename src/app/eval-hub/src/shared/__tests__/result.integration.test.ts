/**
 * Integration-level consumer test for getOrElse and orElse.
 *
 * Demonstrates realistic usage patterns: wrapping async I/O with tryAsync,
 * then recovering with getOrElse (default value) or orElse (fallback Result).
 * These tests would fail if either combinator were absent or semantically wrong.
 */
import { describe, it, expect } from "vitest";
import { tryAsync, getOrElse, orElse, ok, err } from "../result.js";

// Simulate a domain-layer async read that may fail (e.g. missing DB row)
async function fetchRow(id: string): Promise<string> {
  if (id === "missing") throw new Error("row not found: " + id);
  return "row:" + id;
}

describe("Result combinators — realistic async consumer patterns", () => {
  it("getOrElse provides a default when an async fetch fails", async () => {
    const result = await tryAsync(() => fetchRow("missing"));
    const value  = getOrElse(result, "default-row");
    expect(value).toBe("default-row");
  });

  it("getOrElse returns the real value when the async fetch succeeds", async () => {
    const result = await tryAsync(() => fetchRow("abc"));
    const value  = getOrElse(result, "default-row");
    expect(value).toBe("row:abc");
  });

  it("orElse chains a fallback fetch when the primary async fetch fails", async () => {
    const primary  = await tryAsync(() => fetchRow("missing"));
    const fallback = orElse(primary, (_e) => ok("fallback-row"));
    expect(fallback).toEqual({ ok: true, value: "fallback-row" });
  });

  it("orElse does not invoke the fallback when the primary succeeds", async () => {
    let called = false;
    const primary = await tryAsync(() => fetchRow("abc"));
    orElse(primary, (_e) => { called = true; return ok("fallback"); });
    expect(called).toBe(false);
  });

  it("orElse passes the original error to the recovery function", async () => {
    const primary = await tryAsync(() => fetchRow("missing"));
    let received: Error | null = null;
    orElse(primary, (e) => { received = e; return err(e); });
    expect(received).toBeInstanceOf(Error);
    expect((received as unknown as Error).message).toContain("row not found");
  });

  it("combining getOrElse with a recovered orElse returns the recovered value", async () => {
    const primary   = await tryAsync(() => fetchRow("missing"));
    const recovered = orElse(primary, (_e) => ok("recovered-row"));
    const value     = getOrElse(recovered, "should-not-reach");
    expect(value).toBe("recovered-row");
  });
});
