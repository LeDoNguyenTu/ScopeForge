import { describe, expect, it } from "vitest";
import {
  RUNTIME_OBSERVATION_MAX_BUDGET,
  validateRuntimeObservationBudget,
} from "@/packages/runtime-observer";

describe("runtime observation budget", () => {
  it("accepts the exact system maxima and freezes the validated copy", () => {
    const validated = validateRuntimeObservationBudget(RUNTIME_OBSERVATION_MAX_BUDGET);

    expect(validated).toEqual({
      maxRequests: 4,
      maxRedirects: 3,
      perRequestTimeoutMs: 5_000,
      totalTimeoutMs: 15_000,
      maxObservationBytes: 65_536,
    });
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it("allows callers to tighten every limit", () => {
    expect(
      validateRuntimeObservationBudget({
        maxRequests: 1,
        maxRedirects: 0,
        perRequestTimeoutMs: 1_000,
        totalTimeoutMs: 2_000,
        maxObservationBytes: 4_096,
      }),
    ).toEqual({
      maxRequests: 1,
      maxRedirects: 0,
      perRequestTimeoutMs: 1_000,
      totalTimeoutMs: 2_000,
      maxObservationBytes: 4_096,
    });
  });

  it.each([
    ["maxRequests", 0],
    ["maxRequests", 1.5],
    ["maxRedirects", -1],
    ["perRequestTimeoutMs", 0],
    ["totalTimeoutMs", -1],
    ["maxObservationBytes", 0],
  ] as const)("rejects invalid %s values", (field, value) => {
    expect(() =>
      validateRuntimeObservationBudget({
        ...RUNTIME_OBSERVATION_MAX_BUDGET,
        [field]: value,
      }),
    ).toThrow(field);
  });

  it.each([
    ["maxRequests", 5],
    ["maxRedirects", 4],
    ["perRequestTimeoutMs", 5_001],
    ["totalTimeoutMs", 15_001],
    ["maxObservationBytes", 65_537],
  ] as const)("rejects %s above the system maximum", (field, value) => {
    expect(() =>
      validateRuntimeObservationBudget({
        ...RUNTIME_OBSERVATION_MAX_BUDGET,
        [field]: value,
      }),
    ).toThrow(field);
  });
});
