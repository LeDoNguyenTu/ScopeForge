import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/lib/auth/password";

describe("validateNewPassword", () => {
  it.each([
    ["", "", "Enter a new password."],
    ["short", "short", "Use at least 12 characters."],
    ["a".repeat(129), "a".repeat(129), "Use no more than 128 characters."],
    ["long-enough-password", "different-password", "The passwords do not match."],
  ])("rejects invalid password input without exposing it", (password, confirmation, message) => {
    expect(validateNewPassword(password, confirmation)).toBe(message);
  });

  it("accepts a matching password within the supported bounds", () => {
    expect(validateNewPassword("correct-horse-battery", "correct-horse-battery")).toBeNull();
  });
});
