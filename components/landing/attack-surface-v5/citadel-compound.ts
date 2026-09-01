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
  const detailed = quality === "cinematic" || quality === "balanced";

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.72, 0.42, 8), materials.structure);
  base.position.y = 0.05;
  base.rotation.y = Math.PI / 8;
  compound.add(base);

  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.46, 0.24, 8), materials.deck);
  upperBase.position.y = 0.37;
  upperBase.rotation.y = Math.PI / 8;
  compound.add(upperBase);

  const perimeterRing = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 48), glowMaterial(entity, materials));
  perimeterRing.rotation.x = Math.PI / 2;
  perimeterRing.position.y = 0.48;
  compound.add(perimeterRing);

  const towerHeight = entity.state === "risk" ? 2.55 : 2.0 + (index % 3) * 0.24;
  const mainTower = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, towerHeight, 6), stateMaterial(entity, materials));
  mainTower.position.set(0, 0.48 + towerHeight / 2, 0);
  mainTower.rotation.y = Math.PI / 6;
  mainTower.name = `v5-tower-${entity.id}`;
  mainTower.userData.v5BaseY = mainTower.position.y;
  compound.add(mainTower);

  const mainCage = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.02, towerHeight + 0.34, 6, 3, true), materials.structureEdge);
  mainCage.position.copy(mainTower.position);
  mainCage.rotation.y = Math.PI / 6;
  compound.add(mainCage);

  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(entity.state === "risk" ? 0.42 : 0.34, 0), glowMaterial(entity, materials));
  crown.position.set(0, towerHeight + 0.62, 0);
  crown.rotation.y = index * 0.34;
  compound.add(crown);

  const pylonRadius = 0.98;
  for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
    const pylonAngle = pylonIndex * Math.PI / 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0 + (pylonIndex % 2) * 0.22, 0.2), materials.deck);
    pylon.position.set(Math.cos(pylonAngle) * pylonRadius, 0.86, Math.sin(pylonAngle) * pylonRadius);
    pylon.rotation.y = pylonAngle;
    compound.add(pylon);

    if (detailed) {
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), pylonIndex % 2 === 0 ? glowMaterial(entity, materials) : materials.cyanGlow);
      cap.position.set(Math.cos(pylonAngle) * pylonRadius, 1.45 + (pylonIndex % 2) * 0.12, Math.sin(pylonAngle) * pylonRadius);
      compound.add(cap);
    }
  }

  const satellites = [
    { x: -0.72, z: 0.86, h: 0.96 },
    { x: 0.72, z: -0.82, h: 0.78 },
    { x: 0.84, z: 0.62, h: 0.62 },
  ];
  satellites.forEach((spec, satelliteIndex) => {
    const satellite = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.38, spec.h + (index % 2) * 0.08, satelliteIndex % 2 === 0 ? 6 : 4),
      satelliteIndex === 0 && entity.state === "risk" ? materials.risk : materials.deck,
    );
    satellite.position.set(spec.x, 0.48 + spec.h / 2, spec.z);
    satellite.rotation.y = Math.PI / 4 + satelliteIndex * 0.3;
    compound.add(satellite);
  });

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.92, 8), materials.deck);
  antenna.position.set(0, towerHeight + 1.06, 0);
  compound.add(antenna);

  const antennaHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), glowMaterial(entity, materials));
  antennaHead.position.set(0, towerHeight + 1.58, 0);
  antennaHead.name = `v5-antenna-${entity.id}`;
  compound.add(antennaHead);

  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 8, 40), glowMaterial(entity, materials));
  orbit.rotation.x = Math.PI / 2;
  orbit.position.set(0, towerHeight + 0.66, 0);
  orbit.name = `v5-compound-orbit-${entity.id}`;
  compound.add(orbit);

  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 2.75), entity.state === "risk" ? materials.scanRisk : materials.scanTeal);
  scanPlane.rotation.x = -Math.PI / 2;
  scanPlane.position.set(0, 0.66, 0);
  scanPlane.name = `v5-scan-${entity.id}`;
  compound.add(scanPlane);

  if (detailed) {
    const outerCage = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.62, 1.1, 8, 2, true), materials.structureEdge);
    outerCage.position.y = 0.72;
    outerCage.rotation.y = Math.PI / 8;
    compound.add(outerCage);

    const holoPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.58), materials.panel);
    holoPanel.position.set(-1.08, 1.32, 0.76);
    holoPanel.rotation.y = Math.PI / 4;
    holoPanel.name = `v5-hologram-${entity.id}`;
    compound.add(holoPanel);
  }

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = `v5-label-anchor-${entity.id}`;
  labelAnchor.position.set(0, towerHeight + 1.92, 0);
  labelAnchor.userData.v5EntityId = entity.id;
  labelAnchor.userData.v5State = entity.state;
  compound.add(labelAnchor);

  compound.userData.v5ScanPlane = scanPlane;
  compound.userData.v5AntennaHead = antennaHead;
  compound.userData.v5Orbit = orbit;
  compound.userData.v5Tower = mainTower;
  compound.userData.v5LabelAnchor = labelAnchor;
  return compound;
}
