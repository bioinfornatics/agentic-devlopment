import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationFlow,
  type AuthenticationDependencies,
  type Session,
  type UserCredential,
} from "../authenticationFlow.js";

const NOW = new Date("2026-07-21T12:00:00.000Z");
const SESSION_LIFETIME_MS = 30 * 60 * 1000;
const ADA: UserCredential = {
  id: "user-1",
  identifier: "ada@example.com",
  credentialHash: "stored-hash",
};

function createHarness(user: UserCredential | null = ADA) {
  const sessions = new Map<string, Session>();
  const dependencies: AuthenticationDependencies = {
    users: { findByIdentifier: vi.fn(async () => user ?? undefined) },
    credentials: { verify: vi.fn(async (secret, hash) => secret === "correct-secret" && hash === "stored-hash") },
    dummyCredentialHash: "dummy-hash",
    sessions: {
      save: vi.fn(async session => { sessions.set(session.token, session); }),
      findByToken: vi.fn(async token => sessions.get(token)),
      revoke: vi.fn(async token => { sessions.delete(token); }),
    },
    tokens: { generate: vi.fn(() => "opaque-token") },
    clock: { now: vi.fn(() => NOW) },
  };

  return {
    auth: new AuthenticationFlow(dependencies, SESSION_LIFETIME_MS),
    dependencies,
    sessions,
  };
}

describe("AuthenticationFlow", () => {
  it("AUTH-01 normalizes valid credentials and issues a finite opaque session", async () => {
    const { auth, dependencies, sessions } = createHarness();

    const result = await auth.login("  ADA@Example.COM  ", "correct-secret");

    expect(result).toEqual({
      success: true,
      session: {
        token: "opaque-token",
        userId: "user-1",
        expiresAt: new Date(NOW.getTime() + SESSION_LIFETIME_MS),
      },
    });
    expect(dependencies.users.findByIdentifier).toHaveBeenCalledWith("ada@example.com");
    expect(dependencies.credentials.verify).toHaveBeenCalledWith("correct-secret", "stored-hash");
    expect(sessions.get("opaque-token")).toEqual(result.success ? result.session : undefined);
    expect(JSON.stringify(result)).not.toContain("correct-secret");
    expect(JSON.stringify(result)).not.toContain("stored-hash");
  });

  it.each([
    ["unknown identifier", null, "correct-secret"],
    ["wrong secret", ADA, "wrong-secret"],
  ])("AUTH-02 returns one non-enumerating error for %s and issues no session", async (_case, user, secret) => {
    const { auth, dependencies, sessions } = createHarness(user);

    await expect(auth.login("ada@example.com", secret)).resolves.toEqual({
      success: false,
      error: "invalid_credentials",
    });
    expect(dependencies.credentials.verify).toHaveBeenCalledTimes(1);
    expect(dependencies.credentials.verify).toHaveBeenCalledWith(
      secret,
      user ? "stored-hash" : "dummy-hash",
    );
    expect(dependencies.tokens.generate).not.toHaveBeenCalled();
    expect(dependencies.sessions.save).not.toHaveBeenCalled();
    expect(sessions).toHaveLength(0);
  });

  it("AUTH-03 resolves an issued session strictly before expiry", async () => {
    const { auth } = createHarness();
    const login = await auth.login("ada@example.com", "correct-secret");
    expect(login.success).toBe(true);

    await expect(auth.resolve("opaque-token")).resolves.toEqual({
      success: true,
      userId: "user-1",
    });
  });

  it("AUTH-04 revokes a session and reports expiry at the exact boundary", async () => {
    const { auth, dependencies, sessions } = createHarness();
    await auth.login("ada@example.com", "correct-secret");
    vi.mocked(dependencies.clock.now).mockReturnValue(new Date(NOW.getTime() + SESSION_LIFETIME_MS));

    await expect(auth.resolve("opaque-token")).resolves.toEqual({
      success: false,
      error: "session_expired",
    });
    expect(dependencies.sessions.revoke).toHaveBeenCalledWith("opaque-token");
    expect(sessions.has("opaque-token")).toBe(false);
  });

  it("AUTH-05 logs out idempotently and rejects later resolution", async () => {
    const { auth, dependencies } = createHarness();
    await auth.login("ada@example.com", "correct-secret");

    await expect(auth.logout("opaque-token")).resolves.toBeUndefined();
    await expect(auth.logout("opaque-token")).resolves.toBeUndefined();
    await expect(auth.resolve("opaque-token")).resolves.toEqual({
      success: false,
      error: "invalid_session",
    });
    expect(dependencies.sessions.revoke).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-positive or non-finite session lifetime", () => {
    const { dependencies } = createHarness();

    expect(() => new AuthenticationFlow(dependencies, 0)).toThrow("sessionLifetimeMs must be a positive finite integer");
    expect(() => new AuthenticationFlow(dependencies, Number.POSITIVE_INFINITY)).toThrow(
      "sessionLifetimeMs must be a positive finite integer",
    );
  });

  it("AUTH-01 rejects an unrepresentable expiry without saving a session", async () => {
    const { dependencies } = createHarness();
    const auth = new AuthenticationFlow(dependencies, Number.MAX_SAFE_INTEGER);

    await expect(auth.login("ada@example.com", "correct-secret")).rejects.toThrow(
      "session expiry must be a valid date",
    );
    expect(dependencies.sessions.save).not.toHaveBeenCalled();
  });
});
