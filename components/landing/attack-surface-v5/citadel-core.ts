import * as THREE from "three";
import type { AttackSurfaceV5Materials } from "./materials";
import type { AttackSurfaceV5Quality } from "./quality";

export function createCitadelCore(materials: AttackSurfaceV5Materials, quality: AttackSurfaceV5Quality): THREE.Group {
  const core = new THREE.Group();
  core.name = "v5-citadel-core";
  const detailed = quality === "cinematic" || quality === "balanced";

  const decks: THREE.Mesh[] = [];
  const deckSpecs = [
    { top: 4.2, bottom: 4.55, height: 0.34, y: -0.72 },
    { top: 3.8, bottom: 4.15, height: 0.28, y: -0.38 },
    { top: 3.38, bottom: 3.68, height: 0.26, y: -0.08 },
    { top: 2.92, bottom: 3.18, height: 0.24, y: 0.22 },
    { top: 2.38, bottom: 2.62, height: 0.22, y: 0.5 },
  ] as const;

  for (const [index, spec] of deckSpecs.entries()) {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.top, spec.bottom, spec.height, quality === "constrained" || quality === "reduced" ? 32 : 72),
      index % 2 === 0 ? materials.structure : materials.deck,
    );
    deck.position.y = spec.y;
    deck.name = `v5-core-deck-${index}`;
    decks.push(deck);
    core.add(deck);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry((spec.top + spec.bottom) * 0.5, 0.04, 8, quality === "constrained" || quality === "reduced" ? 48 : 112),
      index === deckSpecs.length - 1 ? materials.healthyGlow : materials.deckEdge,
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = spec.y + spec.height * 0.52;
    core.add(edge);
  }

  const underside = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 1.88, 1.18, 56), materials.structure);
  underside.position.y = -1.32;
  core.add(underside);

  const undersideCage = new THREE.Mesh(new THREE.CylinderGeometry(3.34, 2.02, 1.34, 18, 3, true), materials.structureEdge);
  undersideCage.position.y = -1.31;
  core.add(undersideCage);

  const rings: THREE.Mesh[] = [];
  const ringRadii = [0.72, 0.94, 1.18, 1.44, 1.72, 2.02, 2.34, 2.68, 3.02, 3.34, 3.62, 3.88, 4.12, 4.34, 4.54, 4.7];
  ringRadii.forEach((radius, index) => {
    const energetic = index === 0 || index === 3 || index === 7 || index === 11 || index === 15;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, energetic ? 0.078 : 0.036, energetic ? 14 : 8, quality === "constrained" || quality === "reduced" ? 56 : 112),
      energetic ? materials.healthyGlow : index % 2 === 0 ? materials.deckEdge : materials.structureEdge,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.67 + index * 0.014;
    ring.userData.v5RingSpeed = (index % 2 === 0 ? 1 : -1) * (0.026 + index * 0.0048);
    ring.userData.v5RingPhase = index * 0.37;
    rings.push(ring);
    core.add(ring);
  });

  const energyMaterial = materials.healthy.clone();
  energyMaterial.emissiveIntensity = 2.1;
  const energy = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 1.06, 0.72, 56), energyMaterial);
  energy.position.y = 0.7;
  energy.name = "v5-energy-core";
  core.add(energy);

  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.34, 1.28, 36, 1, true), materials.glass);
  chamber.position.y = 0.66;
  core.add(chamber);

  const innerLattice = new THREE.Mesh(new THREE.IcosahedronGeometry(1.36, detailed ? 1 : 0), materials.structureEdge);
  innerLattice.position.y = 0.82;
  innerLattice.name = "v5-core-inner-lattice";
  core.add(innerLattice);

  const energyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.78, 0.2, 48), materials.cyanGlow);
  energyCap.position.y = 1.13;
  core.add(energyCap);

  const haloStack: THREE.Mesh[] = [];
  [0.96, 1.24, 1.58, 1.92].forEach((radius, index) => {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.038 + index * 0.007, 10, 72), index === 2 ? materials.cyanGlow : materials.healthyGlow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.18 + index * 0.1;
    halo.userData.v5HaloPhase = index * 1.45;
    haloStack.push(halo);
    core.add(halo);
  });

  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.84, 0.42, 8), materials.deck);
  crownBase.position.y = 1.42;
  crownBase.rotation.y = Math.PI / 8;
  core.add(crownBase);

  const crownCage = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 2.02, 0.9, 8, 2, true), materials.structureEdge);
  crownCage.position.y = 1.53;
  crownCage.rotation.y = Math.PI / 8;
  core.add(crownCage);

  const crownShield = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), materials.glass);
  crownShield.position.y = 1.82;
  crownShield.rotation.y = Math.PI / 4;
  core.add(crownShield);

  const crownBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), materials.amberGlow);
  crownBeacon.position.y = 1.84;
  crownBeacon.rotation.y = Math.PI / 4;
  crownBeacon.name = "v5-core-beacon";
  core.add(crownBeacon);

  const braceCount = quality === "constrained" || quality === "reduced" ? 10 : 18;
  for (let index = 0; index < braceCount; index += 1) {
    const angle = (index / braceCount) * Math.PI * 2;
    const radius = 3.18;
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.13, 0.16), index % 3 === 0 ? materials.deck : materials.structure);
    brace.position.set(Math.cos(angle) * radius, -0.12, Math.sin(angle) * radius);
    brace.rotation.y = -angle;
    core.add(brace);

    if (detailed) {
      const braceGlow = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.028, 0.038), materials.healthyGlow);
      braceGlow.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
      braceGlow.rotation.y = -angle;
      core.add(braceGlow);
    }
  }

  if (detailed) {
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.15, 0.24), materials.structure);
      pylon.position.set(Math.cos(angle) * 3.72, -0.1, Math.sin(angle) * 3.72);
      pylon.rotation.y = -angle;
      core.add(pylon);

      const pylonCap = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), index % 2 === 0 ? materials.cyanGlow : materials.healthyGlow);
      pylonCap.position.set(Math.cos(angle) * 3.72, 0.56, Math.sin(angle) * 3.72);
      core.add(pylonCap);
    }
  }

  core.userData.v5Rings = rings;
  core.userData.v5EnergyCore = energy;
  core.userData.v5EnergyCap = energyCap;
  core.userData.v5Halos = haloStack;
  core.userData.v5Beacon = crownBeacon;
  core.userData.v5Decks = decks;
  return core;
}
