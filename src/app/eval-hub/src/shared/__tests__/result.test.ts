/**
 * result.ts unit tests
 *
 * AC-1  flatMapResult(ok(x), fn)   → calls fn(x) and returns its Result
 * AC-2  flatMapResult(err(e), fn)  → short-circuits; fn never called; error returned
 */
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../result.js";
import {
  err,
  flatMapResult,
  getOrElse,
  isOk,
  mapResult,
  ok,
  orElse,
  tryAsync,
  unwrap,
} from "../result.js";

// ── existing helpers (smoke tests) ────────────────────────────────────────────

describe("ok / err / isOk", () => {
  it("ok wraps a value and isOk returns true", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("err wraps an error and isOk returns false", () => {
    const e = new Error("boom");
    const r = err(e);
    expect(r.ok).toBe(false);
    expect(isOk(r)).toBe(false);
    if (!r.ok) expect(r.error).toBe(e);
  });
});

describe("mapResult", () => {
  it("maps the value when ok", () => {
    const r = mapResult(ok(3), x => x * 2);
    expect(r).toEqual(ok(6));
  });

  it("passes the error through when not ok", () => {
    const e = new Error("nope");
    const r = mapResult(err(e), (_x: number) => 99);
    expect(r).toEqual(err(e));
  });
});

describe("tryAsync", () => {
  it("wraps a resolved promise as ok", async () => {
    const r = await tryAsync(async () => "hello");
    expect(r).toEqual(ok("hello"));
  });

  it("wraps a rejected promise as err", async () => {
    const boom = new Error("async fail");
    const r = await tryAsync(async () => { throw boom; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(boom);
  });
});

describe("unwrap", () => {
  it("returns value when ok", () => {
    expect(unwrap(ok(7))).toBe(7);
  });

  it("throws when not ok", () => {
    expect(() => unwrap(err(new Error("x")))).toThrow("x");
  });

  it("uses custom message prefix when provided", () => {
    expect(() => unwrap(err(new Error("inner")), "prefix")).toThrow("prefix: inner");
  });
});

// ── AC-1 and AC-2: flatMapResult ──────────────────────────────────────────────

describe("AC-1 flatMapResult(ok(x), fn) calls fn and returns its Result", () => {
  it("forwards the value to fn and returns fn's ok Result", () => {
    const r = flatMapResult(ok(5), x => ok(x * 10));
    expect(r).toEqual(ok(50));
  });

  it("forwards the value to fn and returns fn's err Result", () => {
    const e = new Error("derived error");
    const r = flatMapResult(ok(5), _x => err(e));
    expect(r).toEqual(err(e));
    if (!r.ok) expect(r.error).toBe(e);
  });

  it("calls fn exactly once", () => {
    const fn = vi.fn((x: number) => ok(x + 1));
    flatMapResult(ok(3), fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(3);
  });
});

describe("AC-2 flatMapResult(err(e), fn) short-circuits without calling fn", () => {
  it("returns the original error unchanged", () => {
    const e = new Error("original");
    const source: Result<number, Error> = err(e);
    const r = flatMapResult(source, _x => ok(_x + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(e);
  });

  it("never invokes fn", () => {
    const fn = vi.fn((x: number) => ok(x));
    const source: Result<number, Error> = err(new Error("skip"));
    flatMapResult(source, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── chain composition (AC-1 + AC-2 together) ─────────────────────────────────

describe("flatMapResult chain composition", () => {
  const parsePositive = (n: number): Result<number, Error> =>
    n > 0 ? ok(n) : err(new Error("must be positive"));

  const double = (n: number): Result<number, Error> => ok(n * 2);

  it("chains two successful steps", () => {
    const start: Result<number, Error> = ok(3);
    const r = flatMapResult(flatMapResult(start, parsePositive), double);
    expect(r).toEqual(ok(6));
  });

  it("short-circuits on the first failing step", () => {
    const start: Result<number, Error> = ok(-1);
    const r = flatMapResult(flatMapResult(start, parsePositive), double);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const e = r.error;
      expect(e instanceof Error ? e.message : String(e)).toBe("must be positive");
    }
  });
});

// ── AC-1/AC-2: getOrElse ──────────────────────────────────────────────────────

describe("AC-1 getOrElse(ok(v), fallback) returns the value", () => {
  it("returns the wrapped value, not the fallback", () => {
    expect(getOrElse(ok(42), 0)).toBe(42);
  });

  it("works with string values", () => {
    expect(getOrElse(ok("hello"), "default")).toBe("hello");
  });
});

describe("AC-2 getOrElse(err(e), fallback) returns the fallback", () => {
  it("returns fallback when result is an error", () => {
    expect(getOrElse(err(new Error("oops")), 99)).toBe(99);
  });

  it("works with custom error types", () => {
    const r = err({ code: 404 });
    expect(getOrElse(r, "missing")).toBe("missing");
  });
});

// ── AC-3/AC-4: orElse ─────────────────────────────────────────────────────────

describe("AC-3 orElse(ok(v), fn) returns ok(v) without calling fn", () => {
  it("returns the original ok result unchanged", () => {
    const fn = vi.fn((_e: Error) => ok(-1));
    const r = orElse(ok(5), fn);
    expect(r).toEqual(ok(5));
  });

  it("never calls fn", () => {
    const fn = vi.fn((_e: Error) => ok(-1));
    orElse(ok(5), fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("AC-4 orElse(err(e), fn) returns fn(e)", () => {
  it("calls fn with the error and returns its Result when successful recovery", () => {
    const r = orElse(err(new Error("recoverable")), _e => ok(0));
    expect(r).toEqual(ok(0));
  });

  it("calls fn with the error and returns its err Result when recovery also fails", () => {
    const original = new Error("original");
    const fallback = new Error("fallback");
    const r = orElse(err(original), _e => err(fallback));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(fallback);
  });

  it("receives the original error in fn", () => {
    const fn = vi.fn((_e: Error) => ok(42));
    const original = new Error("passed-through");
    orElse(err(original), fn);
    expect(fn).toHaveBeenCalledWith(original);
  });
});
