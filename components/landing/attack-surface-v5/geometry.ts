import * as THREE from "three";
import { createCitadelArm } from "./citadel-arm";
import { createCitadelAtmosphere } from "./atmosphere";
import { createCitadelCompound } from "./citadel-compound";
import { createCitadelCore } from "./citadel-core";
import type { AttackSurfaceV5Model } from "./model";
import type { AttackSurfaceV5Quality } from "./quality";
import { createV5Materials, type AttackSurfaceV5Materials } from "./materials";

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
    coreRingCount: 8,
    coreDeckCount: 5,
    armCount: model.entities.length,
    bridgeSegmentCount: model.entities.length * 5,
    compoundModuleCount: model.entities.length * 16,
    towerCount: 0,
    riskPathCount: model.entities.filter((entity) => entity.state === "risk").length,
  });
}

function createInstancedMicroHardware(model: AttackSurfaceV5Model, materials: AttackSurfaceV5Materials): THREE.InstancedMesh {
  const coreFastenerCount = 48;
  const armFastenersPerEntity = 10;
  const instanceCount = coreFastenerCount + model.entities.length * armFastenersPerEntity;
  const geometry = new THREE.CylinderGeometry(0.05, 0.062, 0.065, 6);
  const hardware = new THREE.InstancedMesh(geometry, materials.deck, instanceCount);
  hardware.name = "v5-instanced-micro-hardware";
  hardware.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  hardware.castShadow = false;
  hardware.receiveShadow = false;

  const transform = new THREE.Object3D();
  let instanceIndex = 0;

  for (let index = 0; index < coreFastenerCount; index += 1) {
    const angle = (index / coreFastenerCount) * Math.PI * 2;
    const radius = index % 2 === 0 ? 3.38 : 4.26;
    transform.position.set(Math.cos(angle) * radius, 0.84 + (index % 3) * 0.018, Math.sin(angle) * radius);
    transform.rotation.set(0, -angle, 0);
    transform.scale.set(1, index % 4 === 0 ? 1.45 : 1, 1);
    transform.updateMatrix();
    hardware.setMatrixAt(instanceIndex, transform.matrix);
    instanceIndex += 1;
  }

  const radialStations = [3.92, 5.28, 6.64, 8, 9.34] as const;
  for (const entity of model.entities) {
    const angle = (entity.armIndex / model.entities.length) * Math.PI * 2 - Math.PI / 2;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-direction.z, 0, direction.x);

    for (const radial of radialStations) {
      for (const sign of [-1, 1] as const) {
        const position = direction.clone().multiplyScalar(radial).add(side.clone().multiplyScalar(sign * 0.37));
        transform.position.set(position.x, 0.31 + (radial > 7 ? 0.025 : 0), position.z);
        transform.rotation.set(0, -angle, sign * 0.04);
        transform.scale.set(0.92, 1.15, 0.92);
        transform.updateMatrix();
        hardware.setMatrixAt(instanceIndex, transform.matrix);
        instanceIndex += 1;
      }
    }
  }

  hardware.instanceMatrix.needsUpdate = true;
  hardware.computeBoundingSphere();
  return hardware;
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

    const compound = createCitadelCompound(entity, index, armResult.endpoint, armResult.angle, materials, quality);
    compounds.push(compound);
    group.add(compound);

    const path = armResult.group.getObjectByName(`v5-path-${entity.id}`);
    if (entity.state === "risk" && path) riskPaths.push(path);
  });

  const microHardware = createInstancedMicroHardware(model, materials);
  group.add(microHardware);

  const atmosphere = createCitadelAtmosphere(quality, materials);
  group.add(atmosphere);

  group.userData.v5Core = core;
  group.userData.v5Arms = arms;
  group.userData.v5Compounds = compounds;
  group.userData.v5RiskPaths = riskPaths;
  group.userData.v5Atmosphere = atmosphere;
  group.userData.v5Materials = materials;
  group.userData.v5MicroHardware = microHardware;
  group.userData.v5AnimationChannels = [
    "ring-rotation",
    "core-breathing",
    "path-packets",
    "risk-cascade",
    "endpoint-scan",
    "atmospheric-drift",
  ];
  return group;
}
