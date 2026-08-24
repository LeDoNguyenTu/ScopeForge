import { describe, expect, it } from "vitest";
import { canTransitionFindingLifecycle } from "@/packages/security-domain";

describe("finding lifecycle", () => {
  it("allows explicit remediation and retest progression", () => {
    expect(canTransitionFindingLifecycle("open", "acknowledged")).toBe(true);
    expect(canTransitionFindingLifecycle("acknowledged", "in_progress")).toBe(true);
    expect(canTransitionFindingLifecycle("in_progress", "resolved")).toBe(true);
    expect(canTransitionFindingLifecycle("resolved", "retest_pending")).toBe(true);
    expect(canTransitionFindingLifecycle("retest_pending", "verified_fixed")).toBe(true);
  });

  it("allows verified-fixed recurrence without reopening false positives", () => {
    expect(canTransitionFindingLifecycle("verified_fixed", "open")).toBe(true);
    expect(canTransitionFindingLifecycle("false_positive", "open")).toBe(false);
  });

  it("allows idempotent state handling", () => {
    expect(canTransitionFindingLifecycle("open", "open")).toBe(true);
    expect(canTransitionFindingLifecycle("verified_fixed", "verified_fixed")).toBe(true);
  });
});
