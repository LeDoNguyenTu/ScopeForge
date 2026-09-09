import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import {
  createAttackSurfaceV5Group,
  describeAttackSurfaceV5Geometry,
} from "@/components/landing/attack-surface-v5/geometry";

describe("V5.2 premium citadel geometry composition", () => {
  it("describes the actual segmented architecture instead of stale tower and torus counts", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const description = describeAttackSurfaceV5Geometry(model);

    expect(description.coreRingCount).toBe(8);
    expect(description.coreDeckCount).toBeGreaterThanOrEqual(5);
    expect(description.armCount).toBe(6);
    expect(description.bridgeSegmentCount).toBeGreaterThanOrEqual(30);
    expect(description.compoundModuleCount).toBeGreaterThanOrEqual(72);
    expect(description.towerCount).toBe(0);
    expect(description.riskPathCount).toBe(2);
  });

  it("builds enough structural mass and one exact label anchor per scene entity", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const group = createAttackSurfaceV5Group(model, "balanced");
    let meshCount = 0;
    group.traverse((object) => {
      if (object.type === "Mesh") meshCount += 1;
    });

    expect(meshCount).toBeGreaterThan(180);
    expect(group.getObjectByName("v5-energy-core")).toBeTruthy();
    expect(group.getObjectByName("v5-citadel-core")).toBeTruthy();

    for (const entity of model.entities) {
      expect(group.getObjectByName(`v5-compound-${entity.id}`)).toBeTruthy();
      const anchor = group.getObjectByName(`v5-label-anchor-${entity.id}`);
      expect(anchor, entity.id).toBeTruthy();
      expect(anchor?.userData.v5EntityId).toBe(entity.id);
      expect(anchor?.userData.v5State).toBe(entity.state);
      expect(group.getObjectByName(`v5-path-${entity.id}`)?.userData.v5State).toBe(entity.state);
    }
  });

  it("uses instanced shared micro-hardware for dense repeated detail", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const hardware = group.getObjectByName("v5-instanced-micro-hardware");

    expect(hardware).toBeInstanceOf(THREE.InstancedMesh);
    expect((hardware as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(96);
    expect((hardware as THREE.InstancedMesh).instanceMatrix.usage).toBe(THREE.StaticDrawUsage);
  });

  it("keeps both vulnerability entities mapped to their own orange risk branches", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    for (const id of ["web-app", "data-store"]) {
      expect(group.getObjectByName(`v5-path-${id}`)?.userData.v5State).toBe("risk");
      expect(group.getObjectByName(`v5-label-anchor-${id}`)?.userData.v5State).toBe("risk");
    }
  });
});
