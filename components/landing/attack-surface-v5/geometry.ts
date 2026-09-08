import * as THREE from "three";
import type { AttackSurfaceV5Model, AttackSurfaceV5State } from "./model";
import type { AttackSurfaceV5Quality } from "./quality";
import { createV5Materials } from "./materials";

export type AttackSurfaceV5GeometryDescription = Readonly<{
  coreRingCount: number;
  armCount: number;
  towerCount: number;
  riskPathCount: number;
}>;

export function describeAttackSurfaceV5Geometry(model: AttackSurfaceV5Model): AttackSurfaceV5GeometryDescription {
  return Object.freeze({
    coreRingCount: 4,
    armCount: model.entities.length,
    towerCount: model.entities.length,
    riskPathCount: model.entities.filter((entity) => entity.state === "risk").length,
  });
}

function stateMaterial(state: AttackSurfaceV5State, materials: ReturnType<typeof createV5Materials>) {
  if (state === "risk") return materials.risk;
  if (state === "pending") return materials.pending;
  return materials.healthy;
}

function pathMaterial(state: AttackSurfaceV5State, materials: ReturnType<typeof createV5Materials>) {
  return state === "risk" ? materials.pathRisk : materials.pathHealthy;
}

function createCore(materials: ReturnType<typeof createV5Materials>, quality: AttackSurfaceV5Quality) {
  const core = new THREE.Group();
  core.name = "v5-core";

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.42, 0.38, 64), materials.structure);
  base.position.y = -0.28;
  core.add(base);

  const lowerDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.58, 2.85, 0.22, 64), materials.panel);
  lowerDeck.position.y = 0.03;
  core.add(lowerDeck);

  const rings: THREE.Mesh[] = [];
  [1.22, 1.62, 2.06, 2.48].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 0 ? 0.11 : 0.065, 14, quality === "constrained" || quality === "reduced" ? 48 : 96),
      index === 0 ? materials.healthy : materials.structureEdge,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18 + index * 0.035;
    ring.userData.v5RingSpeed = (index % 2 === 0 ? 1 : -1) * (0.045 + index * 0.012);
    rings.push(ring);
    core.add(ring);
  });

  const energy = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 0.44, 48), materials.healthy);
  energy.position.y = 0.28;
  energy.name = "v5-energy-core";
  core.add(energy);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.12, 12, 64), materials.healthyGlow);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.53;
  core.add(halo);

  core.userData.v5Rings = rings;
  return core;
}

function createArm(
  model: AttackSurfaceV5Model,
  entityIndex: number,
  materials: ReturnType<typeof createV5Materials>,
  quality: AttackSurfaceV5Quality,
) {
  const entity = model.entities[entityIndex];
  const count = model.entities.length;
  const angle = (entity.armIndex / count) * Math.PI * 2 - Math.PI / 2;
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const arm = new THREE.Group();
  arm.name = `v5-arm-${entity.id}`;
  arm.userData.v5EntityId = entity.id;
  arm.userData.v5State = entity.state;

  const bridgeLength = 4.65;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(bridgeLength, 0.18, 0.74), materials.structure);
  bridge.position.copy(direction.clone().multiplyScalar(4.7));
  bridge.position.y = -0.02;
  bridge.rotation.y = -angle;
  arm.add(bridge);

  const railOffset = 0.34;
  for (const sign of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bridgeLength, 0.055, 0.045), entity.state === "risk" ? materials.riskGlow : materials.healthyGlow);
    rail.position.copy(direction.clone().multiplyScalar(4.7)).add(side.clone().multiplyScalar(railOffset * sign));
    rail.position.y = 0.16;
    rail.rotation.y = -angle;
    arm.add(rail);
  }

  const endpoint = direction.clone().multiplyScalar(7.05);
  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.02, 0.34, 6), materials.structure);
  towerBase.position.copy(endpoint);
  towerBase.position.y = 0.04;
  arm.add(towerBase);

  const towerHeight = entity.state === "risk" ? 1.95 : 1.55 + (entityIndex % 3) * 0.22;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.95, towerHeight, 0.95), stateMaterial(entity.state, materials));
  tower.position.copy(endpoint);
  tower.position.y = 0.32 + towerHeight / 2;
  tower.rotation.y = -angle + Math.PI / 4;
  tower.name = `v5-tower-${entity.id}`;
  arm.add(tower);

  if (quality !== "reduced") {
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.34, towerHeight + 0.42, 1.34), materials.structureEdge);
    cage.position.copy(tower.position);
    cage.rotation.y = tower.rotation.y;
    arm.add(cage);
  }

  const node = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 32), entity.state === "risk" ? materials.riskGlow : materials.healthyGlow);
  node.position.copy(endpoint);
  node.position.y = towerHeight + 0.58;
  arm.add(node);

  const curve = new THREE.CatmullRomCurve3([
    direction.clone().multiplyScalar(2.65).setY(0.24),
    direction.clone().multiplyScalar(4.25).add(side.clone().multiplyScalar((entityIndex % 2 ? -1 : 1) * 0.28)).setY(0.3),
    endpoint.clone().setY(0.38),
  ]);
  const path = new THREE.Mesh(new THREE.TubeGeometry(curve, quality === "constrained" || quality === "reduced" ? 18 : 32, entity.state === "risk" ? 0.07 : 0.045, 7, false), pathMaterial(entity.state, materials));
  path.name = `v5-path-${entity.id}`;
  arm.add(path);

  const pulse = new THREE.Mesh(new THREE.SphereGeometry(entity.state === "risk" ? 0.16 : 0.12, 12, 12), entity.state === "risk" ? materials.riskGlow : materials.healthyGlow);
  pulse.position.copy(curve.getPoint((entityIndex * 0.13) % 1));
  pulse.name = `v5-pulse-${entity.id}`;
  pulse.userData.v5Curve = curve;
  pulse.userData.v5Offset = (entityIndex * 0.13) % 1;
  arm.add(pulse);

  if (quality === "cinematic" || quality === "balanced") {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9), materials.panel);
    panel.position.copy(endpoint.clone().add(side.clone().multiplyScalar(entityIndex % 2 ? -1.2 : 1.2)));
    panel.position.y = 1.05;
    panel.lookAt(new THREE.Vector3(0, 1.1, 0));
    arm.add(panel);
  }

  return arm;
}

export function createAttackSurfaceV5Group(model: AttackSurfaceV5Model, quality: AttackSurfaceV5Quality): THREE.Group {
  const group = new THREE.Group();
  group.name = "attack-surface-v5";
  const materials = createV5Materials();
  const core = createCore(materials, quality);
  group.add(core);

  const arms = model.entities.map((_, index) => createArm(model, index, materials, quality));
  for (const arm of arms) group.add(arm);

  group.userData.v5Core = core;
  group.userData.v5Arms = arms;
  group.userData.v5Materials = materials;
  return group;
}
