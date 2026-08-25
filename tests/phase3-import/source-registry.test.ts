import { describe, expect, it } from "vitest";

import {
  Phase3ImportValidationError,
  resolvePhase3Source,
} from "@/lib/phase3-import/source-registry";

describe("Phase 3 hosted source registry", () => {
  it("maps known built-in static rules to a closed trusted source descriptor", () => {
    expect(resolvePhase3Source("jsts", "jsts/command-injection", "1.0.0")).toEqual({
      sourceKind: "deterministic-passive-scanner",
      sourceId: "scopeforge:phase3:jsts",
      sourceVersion: "1.0.0",
      ruleRef: "jsts/command-injection",
      provenanceKind: "scanner-derived",
      evidenceKind: "static-analysis",
      classification: "internal",
      artifactRef: null,
    });

    expect(resolvePhase3Source("secrets", "secrets/github-token", "1.0.0").evidenceKind).toBe(
      "static-analysis",
    );
    expect(resolvePhase3Source("iac", "iac/docker-root-user", "1.0.0").evidenceKind).toBe(
      "static-analysis",
    );
  });

  it("maps the built-in SCA vulnerability rule to dependency evidence", () => {
    expect(resolvePhase3Source("sca", "sca/known-vulnerability", "1.0.0")).toMatchObject({
      sourceId: "scopeforge:phase3:sca",
      evidenceKind: "dependency",
      classification: "internal",
      artifactRef: null,
    });
  });

  it.each([
    ["unknown", "jsts/command-injection", "1.0.0"],
    ["jsts", "jsts/not-a-rule", "1.0.0"],
    ["jsts", "jsts/command-injection", "999.0.0"],
    ["secrets", "jsts/command-injection", "1.0.0"],
  ])("rejects unknown or mismatched scanner/rule/version combinations", (scanner, ruleId, ruleVersion) => {
    expect(() => resolvePhase3Source(scanner, ruleId, ruleVersion)).toThrow(Phase3ImportValidationError);
    try {
      resolvePhase3Source(scanner, ruleId, ruleVersion);
    } catch (error) {
      expect((error as Phase3ImportValidationError).code).toBe("PHASE3_SOURCE_NOT_ALLOWED");
    }
  });
});
