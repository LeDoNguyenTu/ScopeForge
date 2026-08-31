import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import {
  createAttackSurfaceV5Group,
  describeAttackSurfaceV5Geometry,
} from "@/components/landing/attack-surface-v5/geometry";

describe("V5.1 Citadel geometry composition", () => {
  it("describes a dense radial citadel rather than six simple boxes", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const description = describeAttackSurfaceV5Geometry(model);

    expect(description.coreRingCount).toBeGreaterThanOrEqual(8);
    expect(description.coreDeckCount).toBeGreaterThanOrEqual(4);
    expect(description.armCount).toBe(6);
    expect(description.bridgeSegmentCount).toBeGreaterThanOrEqual(18);
    expect(description.compoundModuleCount).toBeGreaterThanOrEqual(24);
    expect(description.riskPathCount).toBeGreaterThanOrEqual(2);
  });

  it("builds enough real mesh mass to read as an industrial product scene", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    let meshCount = 0;
    group.traverse((object) => {
      if (object.type === "Mesh") meshCount += 1;
    });

    expect(meshCount).toBeGreaterThan(90);
    expect(group.getObjectByName("v5-energy-core")).toBeTruthy();
    expect(group.getObjectByName("v5-citadel-core")).toBeTruthy();
    for (const id of ["web-app", "sandbox", "third-party", "data-store", "identity", "cloud"]) {
      expect(group.getObjectByName(`v5-compound-${id}`)).toBeTruthy();
    }
  });
});
