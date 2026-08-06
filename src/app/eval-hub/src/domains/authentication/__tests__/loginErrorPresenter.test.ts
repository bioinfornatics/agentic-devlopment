import { describe, it, expect } from "vitest";
import { presentLoginError, presentSessionError } from "../loginErrorPresenter.js";

describe("presentLoginError", () => {
  it("returns undefined for a successful login", () => {
    expect(
      presentLoginError({ success: true, session: { token: "t", userId: "u", expiresAt: new Date() } }),
    ).toBeUndefined();
  });

  it("maps invalid_credentials → 403 auth-failure with safe user message", () => {
    const r = presentLoginError({ success: false, error: "invalid_credentials" });
    expect(r).toMatchObject({
      httpStatus: 403,
      category: "auth-failure",
    });
    expect(r!.userMessage).not.toContain("password");
    expect(r!.userMessage).toMatch(/incorrect/i);
    // safety: no internal detail exposed
    expect(JSON.stringify(r)).not.toContain("hash");
    expect(JSON.stringify(r)).not.toContain("token");
  });
});

describe("presentSessionError", () => {
  it("returns undefined for a resolved session", () => {
    expect(presentSessionError({ success: true, userId: "u" })).toBeUndefined();
  });

  it("maps session_expired → 401 session-expired with sign-in-again message", () => {
    const r = presentSessionError({ success: false, error: "session_expired" });
    expect(r).toMatchObject({
      httpStatus: 401,
      category: "session-expired",
    });
    expect(r!.userMessage).toMatch(/session has expired/i);
  });

  it("maps invalid_session → 401 not-signed-in with sign-in message", () => {
    const r = presentSessionError({ success: false, error: "invalid_session" });
    expect(r).toMatchObject({
      httpStatus: 401,
      category: "not-signed-in",
    });
    expect(r!.userMessage).toMatch(/not signed in/i);
  });
});
