import { describe, expect, it } from "vitest";
import { decodeFindingRouteId } from "@/lib/security-findings/route-param";

describe("finding route parameter", () => {
  it("decodes the encoded canonical finding id emitted by the findings list", () => {
    expect(decodeFindingRouteId("phase3%3A" + "a".repeat(64))).toBe(
      "phase3:" + "a".repeat(64),
    );
  });

  it("preserves an already-decoded canonical finding id", () => {
    expect(decodeFindingRouteId("phase3:" + "a".repeat(64))).toBe(
      "phase3:" + "a".repeat(64),
    );
  });
});
