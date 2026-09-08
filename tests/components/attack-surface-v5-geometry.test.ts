import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import {
  createAttackSurfaceV5Group,
  describeAttackSurfaceV5Geometry,
} from "@/components/landing/attack-surface-v5/geometry";

describe("V5 geometry composition", () => {
  it("contains a layered core and at least six structural arms", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const description = describeAttackSurfaceV5Geometry(model);
    expect(description.coreRingCount).toBeGreaterThanOrEqual(3);
    expect(description.armCount).toBeGreaterThanOrEqual(6);
    expect(description.towerCount).toBeGreaterThanOrEqual(6);
    expect(description.riskPathCount).toBeGreaterThanOrEqual(2);
  });

  it("builds real mesh geometry instead of a line-only canvas graph", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    let meshCount = 0;
    group.traverse((object) => {
      if (object.type === "Mesh") meshCount += 1;
    });
    expect(meshCount).toBeGreaterThan(30);
    expect(group.getObjectByName("v5-energy-core")).toBeTruthy();
    expect(group.getObjectByName("v5-tower-web-app")).toBeTruthy();
  });
});
