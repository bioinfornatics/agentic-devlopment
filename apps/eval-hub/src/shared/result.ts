/** Result<T,E> monad — explicit error handling, no unchecked exceptions. */

export type Result<T, E = Error> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok  = <T>(value: T):  Result<T, never> => ({ ok: true,  value });
export const err = <E>(error: E):  Result<never, E>  => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } { return r.ok; }

export function mapResult<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/**
 * Monadic bind / chain for Result.
 * If `r` is ok, calls `fn(r.value)` and returns the resulting Result.
 * If `r` is an error, short-circuits and returns the error unchanged.
 */
export function flatMapResult<T, U, E>(r: Result<T, E>, fn: (v: T) => Result<U, E>): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try   { return ok(await fn()); }
  catch (e) { return err(e instanceof Error ? e : new Error(String(e))); }
}

export function unwrap<T>(r: Result<T, Error>, msg?: string): T {
  if (r.ok) return r.value;
  throw new Error(msg ? `${msg}: ${r.error.message}` : r.error.message);
}

/**
 * Returns the value inside an ok Result, or `fallback` if the Result is an error.
 *
 * AC-1: getOrElse(ok(v), fallback) → v
 * AC-2: getOrElse(err(e), fallback) → fallback
 */
export function getOrElse<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/**
 * Error-recovery combinator.  If `r` is ok, returns it unchanged.
 * If `r` is an error, calls `fn(r.error)` and returns the recovered Result.
 *
 * AC-3: orElse(ok(v), fn) → ok(v) (fn is never called)
 * AC-4: orElse(err(e), fn) → fn(e)
 */
export function orElse<T, E, F>(r: Result<T, E>, fn: (e: E) => Result<T, F>): Result<T, F> {
  return r.ok ? r : fn(r.error);
}
