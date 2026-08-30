import { describe, expect, it } from "vitest";
import { ATTACK_SURFACE_ARMS, QUALITY_PROFILES, SCENE_VERSION } from "@/components/landing/attack-surface/constants";
import { createAttackSurfaceGeometry } from "@/components/landing/attack-surface/geometry";

describe("attack surface scene contract", () => {
  it("keeps the six-domain command-center topology and versioned cache identity", () => {
    expect(ATTACK_SURFACE_ARMS).toHaveLength(6);
    expect(SCENE_VERSION).toBe("scopeforge-command-center-v4");
  });

  it("scales scene complexity down for mobile without changing topology", () => {
    const high = createAttackSurfaceGeometry(QUALITY_PROFILES.high);
    const mobile = createAttackSurfaceGeometry(QUALITY_PROFILES.mobile);

    expect(high.linePositions.length).toBeGreaterThan(mobile.linePositions.length);
    expect(high.surfacePositions.length).toBeGreaterThan(mobile.surfacePositions.length);
    expect(high.particlePositions.length / 3).toBe(QUALITY_PROFILES.high.particles);
    expect(mobile.particlePositions.length / 3).toBe(QUALITY_PROFILES.mobile.particles);
    expect(mobile.armEndpoints).toHaveLength(6);
  });
});
