export interface UserCredential {
  readonly id: string;
  readonly identifier: string;
  readonly credentialHash: string;
}

export interface Session {
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface UserRepository {
  findByIdentifier(identifier: string): Promise<UserCredential | undefined>;
}

export interface CredentialVerifier {
  verify(secret: string, credentialHash: string): Promise<boolean>;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByToken(token: string): Promise<Session | undefined>;
  revoke(token: string): Promise<void>;
}

export interface TokenGenerator {
  generate(): string;
}

export interface Clock {
  now(): Date;
}

export interface AuthenticationDependencies {
  readonly users: UserRepository;
  readonly credentials: CredentialVerifier;
  readonly dummyCredentialHash: string;
  readonly sessions: SessionRepository;
  readonly tokens: TokenGenerator;
  readonly clock: Clock;
}

export type LoginResult =
  | { readonly success: true; readonly session: Session }
  | { readonly success: false; readonly error: "invalid_credentials" };

export type SessionResolution =
  | { readonly success: true; readonly userId: string }
  | { readonly success: false; readonly error: "invalid_session" | "session_expired" };

const INVALID_CREDENTIALS: LoginResult = { success: false, error: "invalid_credentials" };
const INVALID_SESSION: SessionResolution = { success: false, error: "invalid_session" };

export class AuthenticationFlow {
  constructor(
    private readonly dependencies: AuthenticationDependencies,
    private readonly sessionLifetimeMs: number,
  ) {
    if (!Number.isFinite(sessionLifetimeMs) || !Number.isInteger(sessionLifetimeMs) || sessionLifetimeMs <= 0) {
      throw new Error("sessionLifetimeMs must be a positive finite integer");
    }
  }

  async login(identifier: string, secret: string): Promise<LoginResult> {
    const user = await this.dependencies.users.findByIdentifier(identifier.trim().toLowerCase());
    const verified = await this.dependencies.credentials.verify(
      secret,
      user?.credentialHash ?? this.dependencies.dummyCredentialHash,
    );
    if (!user || !verified) return INVALID_CREDENTIALS;

    const expiresAt = new Date(this.dependencies.clock.now().getTime() + this.sessionLifetimeMs);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw new Error("session expiry must be a valid date");
    }

    const session: Session = {
      token: this.dependencies.tokens.generate(),
      userId: user.id,
      expiresAt,
    };
    await this.dependencies.sessions.save(session);

    return { success: true, session };
  }

  async resolve(token: string): Promise<SessionResolution> {
    const session = await this.dependencies.sessions.findByToken(token);
    if (!session) return INVALID_SESSION;

    if (this.dependencies.clock.now().getTime() >= session.expiresAt.getTime()) {
      await this.dependencies.sessions.revoke(token);
      return { success: false, error: "session_expired" };
    }

    return { success: true, userId: session.userId };
  }

  async logout(token: string): Promise<void> {
    await this.dependencies.sessions.revoke(token);
  }
}
