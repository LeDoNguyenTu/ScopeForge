import { describe, expect, it } from "vitest";
import {
  findingSourceLabel,
  findingTechnicalRuleLabel,
  humanizeSecurityValue,
} from "@/lib/security-findings/presentation";

describe("security finding presentation", () => {
  it("turns hosted scanner identifiers into user-facing source names", () => {
    expect(findingSourceLabel("scopeforge:jsts:jsts/command-injection", "deterministic-passive-scanner"))
      .toBe("JavaScript and TypeScript code analysis");
    expect(findingSourceLabel("scopeforge:sca:sca/known-vulnerability", "deterministic-passive-scanner"))
      .toBe("Dependency vulnerability analysis");
  });

  it("keeps the canonical rule available as compact technical metadata", () => {
    expect(findingTechnicalRuleLabel("phase3-rule:jsts/command-injection@1.0.0"))
      .toBe("jsts/command-injection · version 1.0.0");
  });

  it("humanizes lifecycle and evidence values", () => {
    expect(humanizeSecurityValue("static_confirmed")).toBe("Static confirmed");
    expect(humanizeSecurityValue("finding.reobserved")).toBe("Finding reobserved");
  });
});
