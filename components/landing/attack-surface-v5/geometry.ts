import * as THREE from "three";
import { createCitadelArm } from "./citadel-arm";
import { createCitadelCompound } from "./citadel-compound";
import { createCitadelCore } from "./citadel-core";
import type { AttackSurfaceV5Model } from "./model";
import type { AttackSurfaceV5Quality } from "./quality";
import { createV5Materials } from "./materials";

export type AttackSurfaceV5GeometryDescription = Readonly<{
  coreRingCount: number;
  coreDeckCount: number;
  armCount: number;
  bridgeSegmentCount: number;
  compoundModuleCount: number;
  towerCount: number;
  riskPathCount: number;
}>;

export function describeAttackSurfaceV5Geometry(model: AttackSurfaceV5Model): AttackSurfaceV5GeometryDescription {
  return Object.freeze({
    coreRingCount: 10,
    coreDeckCount: 4,
    armCount: model.entities.length,
    bridgeSegmentCount: model.entities.length * 3,
    compoundModuleCount: model.entities.length * 8,
    towerCount: model.entities.length,
    riskPathCount: model.entities.filter((entity) => entity.state === "risk").length,
  });
}

export function createAttackSurfaceV5Group(model: AttackSurfaceV5Model, quality: AttackSurfaceV5Quality): THREE.Group {
  const group = new THREE.Group();
  group.name = "attack-surface-v5";

  const materials = createV5Materials();
  const core = createCitadelCore(materials, quality);
  group.add(core);

  const arms: THREE.Group[] = [];
  const compounds: THREE.Group[] = [];
  const riskPaths: THREE.Object3D[] = [];

  model.entities.forEach((entity, index) => {
    const armResult = createCitadelArm(entity, index, model.entities.length, materials, quality);
    arms.push(armResult.group);
    group.add(armResult.group);

    const compound = createCitadelCompound(
      entity,
      index,
      armResult.endpoint,
      armResult.angle,
      materials,
      quality,
    );
    compounds.push(compound);
    group.add(compound);

    const path = armResult.group.getObjectByName(`v5-path-${entity.id}`);
    if (entity.state === "risk" && path) riskPaths.push(path);
  });

  group.userData.v5Core = core;
  group.userData.v5Arms = arms;
  group.userData.v5Compounds = compounds;
  group.userData.v5RiskPaths = riskPaths;
  group.userData.v5Materials = materials;
  group.userData.v5AnimationChannels = [
    "ring-rotation",
    "core-breathing",
    "path-packets",
    "risk-cascade",
    "endpoint-scan",
  ];
  return group;
}
