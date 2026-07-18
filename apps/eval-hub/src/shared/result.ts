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

export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try   { return ok(await fn()); }
  catch (e) { return err(e instanceof Error ? e : new Error(String(e))); }
}

export function unwrap<T>(r: Result<T, Error>, msg?: string): T {
  if (r.ok) return r.value;
  throw new Error(msg ? `${msg}: ${r.error.message}` : r.error.message);
}
