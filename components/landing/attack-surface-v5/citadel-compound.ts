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

function cageMaterial(entity: AttackSurfaceV5Entity, materials: AttackSurfaceV5Materials) {
  return entity.state === "risk" ? materials.riskEdge : materials.structureEdge;
}

function addHolographicCage(
  compound: THREE.Group,
  entity: AttackSurfaceV5Entity,
  height: number,
  materials: AttackSurfaceV5Materials,
): THREE.Group {
  const cage = new THREE.Group();
  cage.name = `v5-holo-cage-${entity.id}`;
  cage.position.y = height;
  const wire = entity.state === "risk" ? materials.riskEdge : materials.deckEdge;
  const glow = glowMaterial(entity, materials);
  const frameSize = entity.state === "risk" ? 1.18 : 1.05;
  const layerYs = [-0.58, 0.0, 0.58];
  let frameIndex = 0;

  layerYs.forEach((layerY, layerIndex) => {
    for (let sideIndex = 0; sideIndex < 4; sideIndex += 1) {
      const horizontal = sideIndex % 2 === 0;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? frameSize : 0.045, 0.045, horizontal ? 0.045 : frameSize),
        wire,
      );
      const side = sideIndex < 2 ? -1 : 1;
      if (horizontal) beam.position.set(0, layerY, side * frameSize * 0.5);
      else beam.position.set(side * frameSize * 0.5, layerY, 0);
      beam.name = `v5-holo-frame-${entity.id}-${frameIndex}`;
      frameIndex += 1;
      cage.add(beam);
    }

    if (layerIndex < layerYs.length - 1) {
      for (const [cornerIndex, corner] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.045), wire);
        upright.position.set(corner[0] * frameSize * 0.5, layerY + 0.31, corner[1] * frameSize * 0.5);
        upright.name = `v5-holo-frame-${entity.id}-${frameIndex + cornerIndex}`;
        cage.add(upright);
      }
      frameIndex += 4;
    }
  });

  const nodePositions: readonly [number, number, number][] = [
    [-0.48, -0.58, -0.48], [0.48, -0.58, 0.48], [-0.48, 0, 0.48],
    [0.48, 0, -0.48], [-0.48, 0.58, -0.48], [0.48, 0.58, 0.48],
    [0, 0.58, 0], [0, -0.58, 0],
  ];
  nodePositions.forEach((position, nodeIndex) => {
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), nodeIndex % 3 === 0 ? glow : materials.cyanGlow);
    node.position.set(position[0] * frameSize, position[1], position[2] * frameSize);
    node.name = `v5-holo-node-${entity.id}-${nodeIndex}`;
    cage.add(node);
  });

  const holoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), wire);
  holoCore.name = `v5-holo-core-${entity.id}`;
  holoCore.rotation.set(Math.PI / 7, Math.PI / 4, Math.PI / 9);
  cage.add(holoCore);

  const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), glow);
  innerCore.name = `v5-holo-energy-${entity.id}`;
  cage.add(innerCore);

  cage.userData.v5HoloCore = holoCore;
  cage.userData.v5HoloEnergy = innerCore;
  compound.add(cage);
  return cage;
}

export function createCitadelCompound(entity: AttackSurfaceV5Entity, index: number, endpoint: THREE.Vector3, angle: number, materials: AttackSurfaceV5Materials, quality: AttackSurfaceV5Quality): THREE.Group {
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

  const towerHeight = entity.state === "risk" ? 1.34 : 1.12 + (index % 3) * 0.1;
  const mainTower = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.82, towerHeight, 8), stateMaterial(entity, materials));
  mainTower.position.set(0, 0.48 + towerHeight / 2, 0);
  mainTower.rotation.y = Math.PI / 8;
  mainTower.name = `v5-tower-${entity.id}`;
  mainTower.userData.v5BaseY = mainTower.position.y;
  compound.add(mainTower);

  const mainCage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.06, towerHeight + 0.28, 8, 2, true), cageMaterial(entity, materials));
  mainCage.position.copy(mainTower.position);
  mainCage.rotation.y = Math.PI / 8;
  compound.add(mainCage);

  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(entity.state === "risk" ? 0.34 : 0.29, 0), glowMaterial(entity, materials));
  crown.position.set(0, towerHeight + 0.58, 0);
  crown.rotation.y = index * 0.34;
  compound.add(crown);

  const pylonRadius = 0.98;
  for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
    const pylonAngle = pylonIndex * Math.PI / 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78 + (pylonIndex % 2) * 0.18, 0.2), entity.state === "risk" && pylonIndex % 2 === 0 ? materials.risk : materials.deck);
    pylon.position.set(Math.cos(pylonAngle) * pylonRadius, 0.74, Math.sin(pylonAngle) * pylonRadius);
    pylon.rotation.y = pylonAngle;
    compound.add(pylon);

    if (detailed) {
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), pylonIndex % 2 === 0 ? glowMaterial(entity, materials) : materials.cyanGlow);
      cap.position.set(Math.cos(pylonAngle) * pylonRadius, 1.22 + (pylonIndex % 2) * 0.1, Math.sin(pylonAngle) * pylonRadius);
      compound.add(cap);
    }
  }

  const satellites = [{ x: -0.72, z: 0.86, h: 0.72 }, { x: 0.72, z: -0.82, h: 0.62 }, { x: 0.84, z: 0.62, h: 0.54 }];
  satellites.forEach((spec, satelliteIndex) => {
    const satellite = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, spec.h + (index % 2) * 0.08, satelliteIndex % 2 === 0 ? 6 : 4), satelliteIndex === 0 && entity.state === "risk" ? materials.risk : materials.deck);
    satellite.position.set(spec.x, 0.48 + spec.h / 2, spec.z);
    satellite.rotation.y = Math.PI / 4 + satelliteIndex * 0.3;
    compound.add(satellite);
  });

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.72, 8), materials.deck);
  antenna.position.set(0, towerHeight + 0.88, 0);
  compound.add(antenna);

  const antennaHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMaterial(entity, materials));
  antennaHead.position.set(0, towerHeight + 1.28, 0);
  antennaHead.name = `v5-antenna-${entity.id}`;
  compound.add(antennaHead);

  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 8, 40), glowMaterial(entity, materials));
  orbit.rotation.x = Math.PI / 2;
  orbit.position.set(0, towerHeight + 0.56, 0);
  orbit.name = `v5-compound-orbit-${entity.id}`;
  compound.add(orbit);

  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 2.75), entity.state === "risk" ? materials.scanRisk : materials.scanTeal);
  scanPlane.rotation.x = -Math.PI / 2;
  scanPlane.position.set(0, 0.66, 0);
  scanPlane.name = `v5-scan-${entity.id}`;
  compound.add(scanPlane);

  if (detailed) {
    const outerCage = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.62, 1.1, 8, 2, true), cageMaterial(entity, materials));
    outerCage.position.y = 0.72;
    outerCage.rotation.y = Math.PI / 8;
    compound.add(outerCage);

    const holoPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.58), entity.state === "risk" ? materials.scanRisk : materials.panel);
    holoPanel.position.set(-1.08, 1.24, 0.76);
    holoPanel.rotation.y = Math.PI / 4;
    holoPanel.name = `v5-hologram-${entity.id}`;
    compound.add(holoPanel);
  }

  const holoCage = addHolographicCage(compound, entity, towerHeight + 1.74, materials);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = `v5-label-anchor-${entity.id}`;
  labelAnchor.position.set(0, towerHeight + 2.72, 0);
  labelAnchor.userData.v5EntityId = entity.id;
  labelAnchor.userData.v5State = entity.state;
  compound.add(labelAnchor);

  compound.userData.v5ScanPlane = scanPlane;
  compound.userData.v5AntennaHead = antennaHead;
  compound.userData.v5Orbit = orbit;
  compound.userData.v5Tower = mainTower;
  compound.userData.v5HoloCage = holoCage;
  compound.userData.v5LabelAnchor = labelAnchor;
  return compound;
}
