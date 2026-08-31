import * as THREE from "three";
import type { AttackSurfaceV5Entity } from "./model";
import type { AttackSurfaceV5Materials } from "./materials";
import type { AttackSurfaceV5Quality } from "./quality";

function stateMaterial(entity: AttackSurfaceV5Entity, materials: AttackSurfaceV5Materials) {
  if (entity.state === "risk") return materials.risk;
  if (entity.state === "pending") return materials.pending;
  return materials.healthy;
}

function glowMaterial(entity: AttackSurfaceV5Entity, materials: AttackSurfaceV5Materials) {
  return entity.state === "risk" ? materials.riskGlow : materials.healthyGlow;
}

export function createCitadelCompound(
  entity: AttackSurfaceV5Entity,
  index: number,
  endpoint: THREE.Vector3,
  angle: number,
  materials: AttackSurfaceV5Materials,
  quality: AttackSurfaceV5Quality,
): THREE.Group {
  const compound = new THREE.Group();
  compound.name = `v5-compound-${entity.id}`;
  compound.position.copy(endpoint);
  compound.rotation.y = -angle;
  compound.userData.v5EntityId = entity.id;
  compound.userData.v5State = entity.state;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.42, 0.36, 8),
    materials.structure,
  );
  base.position.y = 0.08;
  base.rotation.y = Math.PI / 8;
  compound.add(base);

  const baseEdge = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.5, 0.42, 8, 1, true),
    materials.structureEdge,
  );
  baseEdge.position.y = 0.1;
  baseEdge.rotation.y = Math.PI / 8;
  compound.add(baseEdge);

  const towerHeight = entity.state === "risk" ? 2.25 : 1.82 + (index % 3) * 0.24;
  const mainTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, towerHeight, 0.82),
    stateMaterial(entity, materials),
  );
  mainTower.position.set(0, 0.3 + towerHeight / 2, 0);
  mainTower.rotation.y = Math.PI / 4;
  mainTower.name = `v5-tower-${entity.id}`;
  compound.add(mainTower);

  const mainCage = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, towerHeight + 0.36, 1.12),
    materials.structureEdge,
  );
  mainCage.position.copy(mainTower.position);
  mainCage.rotation.y = Math.PI / 4;
  compound.add(mainCage);

  const satelliteHeightA = 0.86 + (index % 2) * 0.18;
  const satelliteA = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, satelliteHeightA, 0.58),
    materials.deck,
  );
  satelliteA.position.set(-0.28, 0.32 + satelliteHeightA / 2, 0.86);
  satelliteA.rotation.y = Math.PI / 4;
  compound.add(satelliteA);

  const satelliteHeightB = 0.68 + ((index + 1) % 2) * 0.22;
  const satelliteB = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, satelliteHeightB, 0.5),
    materials.deck,
  );
  satelliteB.position.set(0.28, 0.3 + satelliteHeightB / 2, -0.88);
  satelliteB.rotation.y = Math.PI / 4;
  compound.add(satelliteB);

  const node = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.13, 24),
    glowMaterial(entity, materials),
  );
  node.position.set(0, towerHeight + 0.5, 0);
  compound.add(node);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.76, 8),
    materials.deck,
  );
  antenna.position.set(0, towerHeight + 0.92, 0);
  compound.add(antenna);

  const antennaHead = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    glowMaterial(entity, materials),
  );
  antennaHead.position.set(0, towerHeight + 1.34, 0);
  antennaHead.name = `v5-antenna-${entity.id}`;
  compound.add(antennaHead);

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.025, 8, 32),
    glowMaterial(entity, materials),
  );
  orbit.rotation.x = Math.PI / 2;
  orbit.position.set(0, towerHeight + 0.54, 0);
  orbit.name = `v5-compound-orbit-${entity.id}`;
  compound.add(orbit);

  const scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 2.15),
    entity.state === "risk" ? materials.scanRisk : materials.scanTeal,
  );
  scanPlane.rotation.x = -Math.PI / 2;
  scanPlane.position.set(0, 0.68, 0);
  scanPlane.name = `v5-scan-${entity.id}`;
  compound.add(scanPlane);

  if (quality === "cinematic" || quality === "balanced") {
    const holoPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.5),
      materials.panel,
    );
    holoPanel.position.set(-0.92, 1.12, 0.72);
    holoPanel.rotation.y = Math.PI / 4;
    holoPanel.name = `v5-hologram-${entity.id}`;
    compound.add(holoPanel);

    for (const side of [-1, 1]) {
      const perimeter = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, 1.9),
        side === -1 && entity.state === "risk" ? materials.riskGlow : materials.deckEdge,
      );
      perimeter.position.set(side * 0.98, 0.34, 0);
      compound.add(perimeter);
    }
  }

  compound.userData.v5ScanPlane = scanPlane;
  compound.userData.v5AntennaHead = antennaHead;
  compound.userData.v5Orbit = orbit;
  compound.userData.v5Tower = mainTower;
  return compound;
}
