import { describe, expect, it } from "vitest";
import {
  assertRuntimeJobTransition,
  normalizeRuntimeObservationPayloads,
} from "@/lib/runtime-observations/repository";
import type { RuntimeObservation } from "@/packages/runtime-observer";

describe("runtime observation job transitions", () => {
  it.each([
    ["queued", "running"],
    ["queued", "blocked"],
    ["queued", "cancelled"],
    ["running", "succeeded"],
    ["running", "failed"],
    ["running", "blocked"],
    ["running", "cancelled"],
  ] as const)("allows %s to %s", (current, next) => {
    expect(() => assertRuntimeJobTransition(current, next)).not.toThrow();
  });

  it.each([
    ["queued", "succeeded"],
    ["queued", "failed"],
    ["blocked", "running"],
    ["cancelled", "running"],
    ["succeeded", "running"],
    ["failed", "running"],
  ] as const)("rejects %s to %s", (current, next) => {
    expect(() => assertRuntimeJobTransition(current, next)).toThrow(/invalid runtime job transition/i);
  });
});

describe("runtime observation persistence normalization", () => {
  it("serializes bounded normalized observations without mutation", () => {
    const observations: readonly RuntimeObservation[] = [
      { kind: "http-status", url: "https://example.com/", status: 200 },
      { kind: "header", name: "strict-transport-security", present: false },
    ];

    const rows = normalizeRuntimeObservationPayloads(observations, 65_536);

    expect(rows).toEqual([
      { sequence: 0, kind: "http-status", payload: observations[0] },
      { sequence: 1, kind: "header", payload: observations[1] },
    ]);
    expect(rows[0]?.payload).not.toBe(observations[0]);
  });

  it("rejects persistence when the total normalized payload exceeds the budget", () => {
    const observations: readonly RuntimeObservation[] = [{
      kind: "header",
      name: "server",
      present: true,
      value: "x".repeat(2_000),
    }];

    expect(() => normalizeRuntimeObservationPayloads(observations, 128)).toThrow(/observation persistence budget/i);
  });
});
