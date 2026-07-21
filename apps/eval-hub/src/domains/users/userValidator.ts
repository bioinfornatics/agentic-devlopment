export interface UserInput {
  readonly name?: unknown;
  readonly email?: unknown;
}

export interface User {
  readonly name: string;
  readonly email: string;
}

export interface UserValidationErrors {
  readonly name?: string;
  readonly email?: string;
}

export type UserValidationResult =
  | { readonly success: true; readonly user: User }
  | { readonly success: false; readonly errors: UserValidationErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUser(input: UserInput): UserValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const errors: { name?: string; email?: string } = {};

  if (!name) errors.name = "Name is required";
  if (!EMAIL_PATTERN.test(email)) errors.email = "Email must be valid";

  if (errors.name || errors.email) return { success: false, errors };
  return { success: true, user: { name, email } };
}
