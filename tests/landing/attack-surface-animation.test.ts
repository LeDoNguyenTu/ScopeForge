import { describe, expect, it } from "vitest";
import { getParallaxStrength, getPulseCount, getRingSpeed } from "@/components/landing/attack-surface/animation";

describe("attack surface animation policy", () => {
  it("uses the configured pulse budget per quality tier", () => {
    expect(getPulseCount("high")).toBe(6);
    expect(getPulseCount("balanced")).toBe(4);
    expect(getPulseCount("mobile")).toBe(2);
    expect(getPulseCount("reduced")).toBe(0);
  });

  it("reduces parallax and continuous motion on constrained modes", () => {
    expect(getParallaxStrength("mobile")).toBeLessThan(getParallaxStrength("high"));
    expect(getRingSpeed("balanced", 1)).toBeLessThan(getRingSpeed("high", 1));
    expect(getRingSpeed("reduced", 1)).toBe(0);
  });
});
