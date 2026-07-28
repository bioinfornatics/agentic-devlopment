import { describe, expect, it } from "vitest";
import { validateUser } from "../userValidator.js";

describe("validateUser", () => {
  it("USER-VAL-01 returns a normalized user for valid input", () => {
    expect(validateUser({ name: "  Ada Lovelace  ", email: "  ADA@Example.COM " })).toEqual({
      success: true,
      user: { name: "Ada Lovelace", email: "ada@example.com" },
    });
  });

  it.each([
    [{ email: "ada@example.com" }, { name: "Name is required" }],
    [{ name: "   ", email: "ada@example.com" }, { name: "Name is required" }],
    [{ name: "Ada", email: "not-an-email" }, { email: "Email must be valid" }],
    [{ name: "Ada" }, { email: "Email must be valid" }],
  ])("USER-VAL-02 rejects invalid input %# with field errors", (input, errors) => {
    expect(validateUser(input)).toEqual({ success: false, errors });
  });

  it("USER-VAL-02 reports all invalid fields in one result", () => {
    expect(validateUser({ name: "", email: "bad" })).toEqual({
      success: false,
      errors: { name: "Name is required", email: "Email must be valid" },
    });
  });
});
