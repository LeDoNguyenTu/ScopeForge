import { describe, expect, it } from "vitest";

import { compareText } from "@/packages/scanner-core/determinism/compare-text";

describe("deterministic text ordering", () => {
  it("uses explicit code-unit ordering without locale-sensitive comparison", () => {
    const values = ["zeta", "Zeta", "@scope/pkg", "alpha", "éclair", "eclair"];

    expect([...values].sort(compareText)).toEqual([
      "@scope/pkg",
      "Zeta",
      "alpha",
      "eclair",
      "zeta",
      "éclair"
    ]);
  });

  it("returns zero only for identical strings", () => {
    expect(compareText("same", "same")).toBe(0);
    expect(compareText("a", "b")).toBeLessThan(0);
    expect(compareText("b", "a")).toBeGreaterThan(0);
  });
});
