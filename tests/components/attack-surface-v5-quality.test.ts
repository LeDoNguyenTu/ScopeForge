import { describe, expect, it } from "vitest";
import {
  getAttackSurfaceV5QualitySettings,
  selectAttackSurfaceV5Quality,
} from "@/components/landing/attack-surface-v5/quality";

describe("V5.1 Citadel adaptive quality", () => {
  it("keeps a modern high-DPR phone on balanced quality", () => {
    expect(selectAttackSurfaceV5Quality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 8 })).toBe("balanced");
  });

  it("uses cinematic quality on capable desktop hardware", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("cinematic");
  });

  it("respects reduced motion regardless of device power", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: true, deviceMemory: 8 })).toBe("reduced");
  });

  it("prioritizes sharpness and exposes descending Citadel detail budgets", () => {
    const cinematic = getAttackSurfaceV5QualitySettings("cinematic");
    const balanced = getAttackSurfaceV5QualitySettings("balanced");
    const constrained = getAttackSurfaceV5QualitySettings("constrained");
    const reduced = getAttackSurfaceV5QualitySettings("reduced");

    expect(cinematic.dprCap).toBe(2.5);
    expect(balanced.dprCap).toBe(2);
    expect(constrained.dprCap).toBe(1.5);
    expect(reduced.dprCap).toBe(1.5);
    expect(balanced.antialias).toBe(true);
    expect(constrained.bloom).toBe(false);

    expect(cinematic.detailFactor).toBeGreaterThan(balanced.detailFactor);
    expect(balanced.detailFactor).toBeGreaterThan(constrained.detailFactor);
    expect(cinematic.particleFactor).toBeGreaterThan(balanced.particleFactor);
    expect(balanced.particleFactor).toBeGreaterThan(constrained.particleFactor);
    expect(cinematic.hologramFactor).toBeGreaterThan(balanced.hologramFactor);
    expect(balanced.hologramFactor).toBeGreaterThan(constrained.hologramFactor);
  });

  it("downgrades effects when measured frame time is slow", () => {
    expect(selectAttackSurfaceV5Quality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 8, frameTimeMs: 35 })).toBe("constrained");
  });
});
