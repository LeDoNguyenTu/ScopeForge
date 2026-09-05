import { describe, expect, it } from "vitest";

import { createValidationScanner } from "@/packages/validation-accuracy";

describe("validation scanner ownership", () => {
  it.each([
    ["secrets", "secrets/github-token", "secrets"],
    ["jsts", "jsts/dynamic-code-execution", "jsts"],
    ["jsts", "jsts/command-injection", "jsts"],
    ["iac", "iac/docker-floating-base-image", "iac"],
    ["iac", "iac/kubernetes-privileged-container", "iac"],
    ["iac", "iac/terraform-aws-public-rds", "iac"],
    ["iac", "iac/github-actions-write-all-permissions", "iac"],
    ["iac", "iac/config-npm-strict-ssl-disabled", "iac"],
  ] as const)("creates only %s for %s", (family, ruleId, expectedName) => {
    const scanner = createValidationScanner(family, ruleId);
    expect(scanner.name).toBe(expectedName);
  });

  it("rejects a rule owned by another scanner family", () => {
    expect(() => createValidationScanner("jsts", "secrets/github-token"))
      .toThrowError(expect.objectContaining({ code: "VALIDATION_RULE_INVALID" }));
  });

  it("rejects unrepresented offline rules even when the family owns them", () => {
    expect(() => createValidationScanner("jsts", "jsts/tls-verification-disabled"))
      .toThrowError(expect.objectContaining({ code: "VALIDATION_RULE_INVALID" }));
  });
});
