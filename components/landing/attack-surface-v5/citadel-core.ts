import * as THREE from "three";
import type { AttackSurfaceV5Materials } from "./materials";
import type { AttackSurfaceV5Quality } from "./quality";

export function createCitadelCore(
  materials: AttackSurfaceV5Materials,
  quality: AttackSurfaceV5Quality,
): THREE.Group {
  const core = new THREE.Group();
  core.name = "v5-citadel-core";

  const decks: THREE.Mesh[] = [];
  const deckSpecs = [
    { top: 3.58, bottom: 3.9, height: 0.34, y: -0.55 },
    { top: 3.18, bottom: 3.48, height: 0.26, y: -0.2 },
    { top: 2.75, bottom: 2.98, height: 0.24, y: 0.1 },
    { top: 2.2, bottom: 2.45, height: 0.22, y: 0.39 },
  ] as const;

  for (const [index, spec] of deckSpecs.entries()) {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.top, spec.bottom, spec.height, quality === "constrained" || quality === "reduced" ? 32 : 64),
      index % 2 === 0 ? materials.structure : materials.deck,
    );
    deck.position.y = spec.y;
    deck.name = `v5-core-deck-${index}`;
    decks.push(deck);
    core.add(deck);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry((spec.top + spec.bottom) * 0.5, 0.035, 8, quality === "constrained" || quality === "reduced" ? 48 : 96),
      index === 3 ? materials.healthyGlow : materials.deckEdge,
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = spec.y + spec.height * 0.52;
    core.add(edge);
  }

  const underside = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 1.82, 0.86, quality === "constrained" || quality === "reduced" ? 24 : 48),
    materials.structure,
  );
  underside.position.y = -1.02;
  core.add(underside);

  const undersideCage = new THREE.Mesh(
    new THREE.CylinderGeometry(2.92, 1.92, 1.02, 16, 2, true),
    materials.structureEdge,
  );
  undersideCage.position.y = -1.02;
  core.add(undersideCage);

  const rings: THREE.Mesh[] = [];
  const ringRadii = [0.82, 1.08, 1.36, 1.66, 1.96, 2.28, 2.62, 2.96, 3.28, 3.56];
  ringRadii.forEach((radius, index) => {
    const energetic = index === 0 || index === 3 || index === 7;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        radius,
        energetic ? 0.075 : 0.042,
        energetic ? 14 : 8,
        quality === "constrained" || quality === "reduced" ? 48 : 96,
      ),
      energetic ? materials.healthyGlow : index % 2 === 0 ? materials.deckEdge : materials.structureEdge,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55 + index * 0.018;
    ring.userData.v5RingSpeed = (index % 2 === 0 ? 1 : -1) * (0.035 + index * 0.0065);
    ring.userData.v5RingPhase = index * 0.41;
    rings.push(ring);
    core.add(ring);
  });

  const energy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.92, 0.62, 48),
    materials.healthy,
  );
  energy.position.y = 0.58;
  energy.name = "v5-energy-core";
  core.add(energy);

  const energyCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.72, 0.18, 48),
    materials.cyanGlow,
  );
  energyCap.position.y = 0.98;
  core.add(energyCap);

  const chamber = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.18, 1.05, 32, 1, true),
    materials.glass,
  );
  chamber.position.y = 0.53;
  core.add(chamber);

  const haloStack: THREE.Mesh[] = [];
  [0.92, 1.18, 1.48].forEach((radius, index) => {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.04 + index * 0.008, 10, 64),
      index === 1 ? materials.cyanGlow : materials.healthyGlow,
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.03 + index * 0.12;
    halo.userData.v5HaloPhase = index * 1.7;
    haloStack.push(halo);
    core.add(halo);
  });

  const crownBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.58, 0.34, 8),
    materials.deck,
  );
  crownBase.position.y = 1.16;
  crownBase.rotation.y = Math.PI / 8;
  core.add(crownBase);

  const crownCage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.72, 0.72, 8, 1, true),
    materials.structureEdge,
  );
  crownCage.position.y = 1.28;
  crownCage.rotation.y = Math.PI / 8;
  core.add(crownCage);

  const crownBeacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34, 0),
    materials.amberGlow,
  );
  crownBeacon.position.y = 1.68;
  crownBeacon.rotation.y = Math.PI / 4;
  crownBeacon.name = "v5-core-beacon";
  core.add(crownBeacon);

  const braceCount = quality === "constrained" || quality === "reduced" ? 8 : 12;
  for (let index = 0; index < braceCount; index += 1) {
    const angle = (index / braceCount) * Math.PI * 2;
    const radius = 2.72;
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.11, 0.13),
      index % 3 === 0 ? materials.deck : materials.structure,
    );
    brace.position.set(Math.cos(angle) * radius, -0.04, Math.sin(angle) * radius);
    brace.rotation.y = -angle;
    core.add(brace);

    if (quality === "cinematic" || quality === "balanced") {
      const braceGlow = new THREE.Mesh(
        new THREE.BoxGeometry(1.62, 0.025, 0.035),
        materials.healthyGlow,
      );
      braceGlow.position.set(Math.cos(angle) * radius, 0.055, Math.sin(angle) * radius);
      braceGlow.rotation.y = -angle;
      core.add(braceGlow);
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
