import { describe, expect, it } from "vitest";

import {
  compareSeverity,
  isSeverityAtLeast
} from "@/packages/scanner-core/findings/severity";

describe("severity helpers", () => {
  it("orders critical above high, medium, low, and info", () => {
    expect(compareSeverity("critical", "high")).toBeGreaterThan(0);
    expect(compareSeverity("high", "medium")).toBeGreaterThan(0);
    expect(compareSeverity("medium", "low")).toBeGreaterThan(0);
    expect(compareSeverity("low", "info")).toBeGreaterThan(0);
  });

  it("checks whether a finding reaches an enforcement threshold", () => {
    expect(isSeverityAtLeast("high", "medium")).toBe(true);
    expect(isSeverityAtLeast("medium", "medium")).toBe(true);
    expect(isSeverityAtLeast("low", "high")).toBe(false);
  });
});
