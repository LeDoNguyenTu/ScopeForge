import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/error-message";

describe("authErrorMessage", () => {
  it("does not echo sign-in provider details", () => {
    expect(
      authErrorMessage(
        new Error("Invalid login credentials for user alice@example.com"),
        "sign-in"
      )
    ).toBe("Unable to sign in. Check your credentials and try again.");
  });

  it("does not echo sign-up provider details", () => {
    expect(authErrorMessage(new Error("User already registered"), "sign-up")).toBe(
      "Unable to create the account. Review your details and try again."
    );
  });

  it.each([
    "rate limit exceeded for IP 203.0.113.7",
    "Too many requests from this client",
    "over_request_rate_limit"
  ])("maps provider rate-limit detail to bounded retry guidance: %s", (message) => {
    expect(authErrorMessage(new Error(message), "sign-in")).toBe(
      "Too many authentication attempts. Try again later."
    );
  });

  it("handles non-Error values without serializing them", () => {
    expect(authErrorMessage({ secret: "should-not-render" }, "sign-in")).toBe(
      "Unable to sign in. Check your credentials and try again."
    );
  });
});
