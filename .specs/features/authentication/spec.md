# Authentication Flow Specification

**Status:** Active  
**Bead:** `agentic-devlopment-wr1v`

## Intent

Provide a framework-agnostic service for authenticating a registered user, issuing a finite session, resolving an active session, and logging out. Credential hashing and persistence remain behind injected ports; the service never stores or returns a plaintext secret.

## Contracts and constraints

- A user record contains an opaque `credentialHash`; comparison is performed only by `CredentialVerifier`.
- Login identifiers are trimmed and lowercased before repository lookup.
- Authentication failures do not reveal whether an identifier exists; both unknown-user and wrong-secret attempts perform one credential verification, using an injected dummy hash when no user exists.
- Session tokens are opaque values supplied by `TokenGenerator`.
- A session is active strictly before `expiresAt`; at the exact expiry instant it is expired.
- Session lifetime must be a positive, finite integer number of milliseconds and its computed expiry must be representable by JavaScript `Date`.

## Acceptance criteria

### AUTH-01 — Successful login

**WHEN** a registered user's normalized identifier and valid secret are submitted  
**THEN** the authentication service **SHALL** issue one session containing the generated token, the user's ID, and a valid `expiresAt` exactly one configured lifetime after the current clock time, without returning the secret or credential hash; if that expiry is not representable, it **SHALL** reject the login without saving a session.

### AUTH-02 — Non-enumerating credential rejection

**WHEN** login is attempted with either an unknown identifier or an invalid secret  
**THEN** the authentication service **SHALL** perform exactly one credential verification (against the stored hash or injected dummy hash), return exactly `{ success: false, error: "invalid_credentials" }`, and **SHALL NOT** issue a session.

### AUTH-03 — Active session resolution

**WHEN** an issued token is resolved strictly before its expiry  
**THEN** the authentication service **SHALL** return exactly `{ success: true, userId }` for the session owner.

### AUTH-04 — Expired session handling

**WHEN** a known token is resolved at or after its expiry  
**THEN** the authentication service **SHALL** revoke that session and return exactly `{ success: false, error: "session_expired" }`.

### AUTH-05 — Logout

**WHEN** logout receives a token  
**THEN** the authentication service **SHALL** revoke it idempotently, and subsequent resolution **SHALL** return exactly `{ success: false, error: "invalid_session" }`.

## Non-goals

HTTP endpoints, cookies, password-reset flows, registration, authorization/roles, rate limiting, and production hash/token/storage adapters are outside this isolated domain change.
