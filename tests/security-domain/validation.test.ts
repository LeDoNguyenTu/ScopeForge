import { describe, expect, it } from "vitest";
import { canTransitionValidation } from "@/packages/security-domain";

describe("validation authority", () => {
  it("never lets advisory output promote validation", () => {
    expect(canTransitionValidation("unvalidated", "runtime_validated", "advisory")).toBe(false);
    expect(canTransitionValidation("static_confirmed", "user_confirmed", "advisory")).toBe(false);
    expect(canTransitionValidation("static_confirmed", "static_confirmed", "advisory")).toBe(true);
  });

  it("allows deterministic scanners to strengthen observed validation", () => {
    expect(canTransitionValidation("unvalidated", "static_confirmed", "deterministic")).toBe(true);
    expect(canTransitionValidation("static_confirmed", "runtime_observed", "deterministic")).toBe(true);
    expect(canTransitionValidation("runtime_observed", "runtime_validated", "deterministic")).toBe(true);
  });

  it("reserves user confirmation for human authority", () => {
    expect(canTransitionValidation("unvalidated", "user_confirmed", "human")).toBe(true);
    expect(canTransitionValidation("runtime_validated", "user_confirmed", "human")).toBe(true);
    expect(canTransitionValidation("unvalidated", "user_confirmed", "deterministic")).toBe(false);
  });
});
