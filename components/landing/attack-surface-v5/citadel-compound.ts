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
      for (const [cornerIndex, corner] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
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
  const glow = glowMaterial(entity, materials);
  const wire = cageMaterial(entity, materials);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.72, 0.42, 8), materials.structure);
  base.position.y = 0.05;
  base.rotation.y = Math.PI / 8;
  compound.add(base);

  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.46, 0.24, 8), materials.deck);
  upperBase.position.y = 0.37;
  upperBase.rotation.y = Math.PI / 8;
  compound.add(upperBase);

  const perimeterRing = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 48), glow);
  perimeterRing.rotation.x = Math.PI / 2;
  perimeterRing.position.y = 0.48;
  compound.add(perimeterRing);

  const deckSpecs = [
    { radius: 1.02, bottom: 1.18, height: 0.17, y: 0.6, sides: 8 },
    { radius: 0.8, bottom: 0.98, height: 0.15, y: 0.82, sides: 8 },
    { radius: 0.58, bottom: 0.76, height: 0.13, y: 1.02, sides: 6 },
  ] as const;
  const endpointDecks: THREE.Mesh[] = [];
  deckSpecs.forEach((spec, deckIndex) => {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius, spec.bottom, spec.height, spec.sides),
      deckIndex === 1 ? stateMaterial(entity, materials) : deckIndex === 2 ? materials.panel : materials.deck,
    );
    deck.position.y = spec.y;
    deck.rotation.y = Math.PI / 8 + deckIndex * 0.13;
    deck.name = `v5-endpoint-deck-${entity.id}-${deckIndex}`;
    endpointDecks.push(deck);
    compound.add(deck);
  });

  const crossRailGeometry = new THREE.BoxGeometry(1.7, 0.065, 0.08);
  for (let railIndex = 0; railIndex < 4; railIndex += 1) {
    const rail = new THREE.Mesh(crossRailGeometry, railIndex % 2 === 0 ? wire : materials.deckEdge);
    rail.position.y = 0.92 + (railIndex % 2) * 0.16;
    rail.rotation.y = railIndex * Math.PI / 4 + Math.PI / 8;
    rail.name = `v5-endpoint-rail-${entity.id}-${railIndex}`;
    compound.add(rail);
  }

  const coreHousing = new THREE.Mesh(new THREE.DodecahedronGeometry(0.43, 0), materials.glass);
  coreHousing.position.y = 1.26;
  coreHousing.rotation.set(0.12, index * 0.3, -0.08);
  compound.add(coreHousing);

  const coreEnergy = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow);
  coreEnergy.position.y = 1.26;
  compound.add(coreEnergy);

  const pylonRadius = 1.02;
  for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
    const pylonAngle = pylonIndex * Math.PI / 2 + Math.PI / 4;
    const pylonHeight = 0.48 + (pylonIndex % 2) * 0.12;
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, pylonHeight, 6),
      entity.state === "risk" && pylonIndex % 2 === 0 ? materials.risk : materials.deck,
    );
    pylon.position.set(Math.cos(pylonAngle) * pylonRadius, 0.55 + pylonHeight * 0.5, Math.sin(pylonAngle) * pylonRadius);
    pylon.rotation.y = pylonAngle;
    compound.add(pylon);

    if (detailed) {
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), pylonIndex % 2 === 0 ? glow : materials.cyanGlow);
      cap.position.set(Math.cos(pylonAngle) * pylonRadius, 0.84 + pylonHeight, Math.sin(pylonAngle) * pylonRadius);
      compound.add(cap);
    }
  }

  const satellites = [{ x: -0.78, z: 0.86, h: 0.46 }, { x: 0.76, z: -0.84, h: 0.4 }, { x: 0.88, z: 0.62, h: 0.34 }];
  satellites.forEach((spec, satelliteIndex) => {
    const satellite = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, spec.h, satelliteIndex % 2 === 0 ? 6 : 4),
      satelliteIndex === 0 && entity.state === "risk" ? materials.risk : materials.deck,
    );
    satellite.position.set(spec.x, 0.48 + spec.h / 2, spec.z);
    satellite.rotation.y = Math.PI / 4 + satelliteIndex * 0.3;
    compound.add(satellite);
  });

  const signalMast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.36, 8), materials.deck);
  signalMast.position.set(0.22, 1.5, -0.16);
  compound.add(signalMast);

  const antennaHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glow);
  antennaHead.position.set(0.22, 1.72, -0.16);
  antennaHead.name = `v5-antenna-${entity.id}`;
  compound.add(antennaHead);

  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.028, 8, 40), glow);
  orbit.rotation.x = Math.PI / 2;
  orbit.position.set(0, 1.54, 0);
  orbit.name = `v5-compound-orbit-${entity.id}`;
  compound.add(orbit);

  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 2.75), entity.state === "risk" ? materials.scanRisk : materials.scanTeal);
  scanPlane.rotation.x = -Math.PI / 2;
  scanPlane.position.set(0, 0.66, 0);
  scanPlane.name = `v5-scan-${entity.id}`;
  compound.add(scanPlane);

  if (detailed) {
    const outerCage = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.58, 0.82, 8, 2, true), wire);
    outerCage.position.y = 0.82;
    outerCage.rotation.y = Math.PI / 8;
    compound.add(outerCage);

    const holoPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.5), entity.state === "risk" ? materials.scanRisk : materials.panel);
    holoPanel.position.set(-1.04, 1.12, 0.72);
    holoPanel.rotation.y = Math.PI / 4;
    holoPanel.name = `v5-hologram-${entity.id}`;
    compound.add(holoPanel);
  }

  const holoCage = addHolographicCage(compound, entity, 1.88, materials);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = `v5-label-anchor-${entity.id}`;
  labelAnchor.position.set(0, 3.12, 0);
  labelAnchor.userData.v5EntityId = entity.id;
  labelAnchor.userData.v5State = entity.state;
  compound.add(labelAnchor);

  compound.userData.v5ScanPlane = scanPlane;
  compound.userData.v5AntennaHead = antennaHead;
  compound.userData.v5Orbit = orbit;
  compound.userData.v5HoloCage = holoCage;
  compound.userData.v5EndpointDecks = endpointDecks;
  compound.userData.v5LabelAnchor = labelAnchor;
  return compound;
}
