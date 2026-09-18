import { describe, expect, it } from "vitest";
import { phase11StableId } from "./identity";

describe("Phase 11 stable identifiers", () => {
  it("is deterministic, bounded, and sensitive to every canonical part", () => {
    const first = phase11StableId("phase11-action", [
      "hypothesis-1",
      "capability-1",
      "1.0.0",
      ["node-1"],
      ["observation-1"],
    ]);
    const replay = phase11StableId("phase11-action", [
      "hypothesis-1",
      "capability-1",
      "1.0.0",
      ["node-1"],
      ["observation-1"],
    ]);
    const changedVersion = phase11StableId("phase11-action", [
      "hypothesis-1",
      "capability-1",
      "2.0.0",
      ["node-1"],
      ["observation-1"],
    ]);

    expect(first).toBe(replay);
    expect(first).not.toBe(changedVersion);
    expect(first).toMatch(/^phase11-action:[0-9a-f]{64}$/);
    expect(first.length).toBeLessThan(100);
  });

  it("stays fixed-size for long and unicode inputs", () => {
    const value = phase11StableId("phase11-authz", [
      "🚀".repeat(4_000),
      "x".repeat(20_000),
    ]);
    expect(value).toMatch(/^phase11-authz:[0-9a-f]{64}$/);
    expect(value.length).toBe(78);
  });
});
