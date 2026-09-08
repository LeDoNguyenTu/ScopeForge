import { describe, expect, it } from "vitest";
import {
  getAttackSurfaceV5QualitySettings,
  selectAttackSurfaceV5Quality,
} from "@/components/landing/attack-surface-v5/quality";

describe("V5 adaptive quality", () => {
  it("allows a modern high-DPR phone to use balanced quality", () => {
    expect(selectAttackSurfaceV5Quality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 8 })).toBe("balanced");
  });

  it("uses cinematic quality on capable desktop hardware", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("cinematic");
  });

  it("respects reduced motion regardless of device power", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: true, deviceMemory: 8 })).toBe("reduced");
  });

  it("downgrades effects before treating a high-DPR mobile viewport as low quality", () => {
    expect(selectAttackSurfaceV5Quality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 8, frameTimeMs: 35 })).toBe("constrained");
    expect(getAttackSurfaceV5QualitySettings("balanced").antialias).toBe(true);
    expect(getAttackSurfaceV5QualitySettings("balanced").dprCap).toBeGreaterThanOrEqual(1.75);
    expect(getAttackSurfaceV5QualitySettings("constrained").bloom).toBe(false);
  });
});
