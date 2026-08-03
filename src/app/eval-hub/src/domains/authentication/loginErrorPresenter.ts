/**
 * HTTP error presenter for AuthenticationFlow domain errors.
 *
 * Maps machine-readable error codes from LoginResult and SessionResolution
 * to safe HTTP-layer responses: status, user-visible message, and category.
 * Never exposes tokens, hashes, provider details, or stack traces.
 */
import type { LoginResult, SessionResolution } from "./authenticationFlow.js";

export interface HttpErrorResponse {
  readonly httpStatus: 401 | 403;
  readonly userMessage: string;
  readonly category: "auth-failure" | "session-expired" | "not-signed-in";
}

/**
 * Present a LoginResult as an HTTP error.
 * Returns undefined when the result is a success — caller handles 2xx.
 */
export function presentLoginError(
  result: LoginResult,
): HttpErrorResponse | undefined {
  if (result.success) return undefined;

  // Only one error code today; switch guards future additions.
  return {
    httpStatus: 403,
    userMessage: "Incorrect credentials. Please try again.",
    category: "auth-failure",
  };
}

/**
 * Present a SessionResolution as an HTTP error.
 * Returns undefined when the session resolved successfully.
 */
export function presentSessionError(
  result: SessionResolution,
): HttpErrorResponse | undefined {
  if (result.success) return undefined;

  switch (result.error) {
    case "session_expired":
      return {
        httpStatus: 401,
        userMessage: "Your session has expired. Please sign in again.",
        category: "session-expired",
      };
    case "invalid_session":
      return {
        httpStatus: 401,
        userMessage: "You are not signed in. Please sign in.",
        category: "not-signed-in",
      };
    default: {
      const exhaustive: never = result.error;
      void exhaustive;
      return {
        httpStatus: 401,
        userMessage: "You are not signed in. Please sign in.",
        category: "not-signed-in",
      };
    }
  }
}